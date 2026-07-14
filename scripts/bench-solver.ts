/**
 * Release-blocking wall-time + memory gate for the switch-aware solver (C5-v3).
 *
 * NOT wired into `bun run test` — this is a standalone gate. Run it with:
 *   bun scripts/bench-solver.ts
 * Exit code 0 = PASS, 1 = FAIL. The full results table is printed to stdout;
 * redirect it to a file if you want to keep it for the release notes.
 *
 * Protocol per timed case: 1 cold run (discarded) + 5 warm runs; we gate on the
 * MEDIAN warm wall and also report cold and max. Move-count equality against an
 * independent plain BFS is asserted across the entire corpus, so a regression
 * that quietly returns non-shortest paths fails the gate too.
 *
 * The process has three roles, selected at startup:
 *   - worker (node:worker_threads, !isMainThread): runs ONE solve and reports
 *     its own isolate's heap+external delta. A synchronous CPU-bound solve
 *     cannot be sampled from another isolate for V8/JSC heap, so the solve runs
 *     here and reports its own peak.
 *   - memory child (--mem-child): a FRESH process that receives the worst-case
 *     lock on argv (so its maxRSS baseline is not polluted by corpus work),
 *     spawns the worker, samples process-wide RSS every 30 ms during the solve,
 *     and reports the numbers as JSON on stdout.
 *   - orchestrator (default): builds the corpus, runs the wall gate, spawns the
 *     memory child, prints the table, and sets the exit code.
 */
import { spawnSync } from "node:child_process";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { solvePuzzle } from "$lib/features/solve-lock/model/solver";
import type { Solution } from "$lib/entities/lock/model/types";
import {
  benchmarkLock,
  HARDEST_SOLVABLE_N7,
  type Lock,
  median,
  mulberry32,
  randomLock,
  referenceBfs,
  switchCount,
  unsolvableN7,
} from "./bench-shared";

const MiB = 1024 * 1024;

// Thresholds (release-blocking).
const THRESHOLDS = {
  benchmarkMs: 150,
  hardestN7Ms: 1500,
  unsolvableN7Ms: 1000,
  heapExtMiB: 110,
  maxRssMiB: 160,
};

// ---------------------------------------------------------------------------
// Corpus. Deterministic helpers (mulberry32, randomLock, referenceBfs, …) and
// the fixed locks (unsolvableN7, benchmarkLock, HARDEST_SOLVABLE_N7) are shared
// with the webkit gate — see ./bench-shared.
// ---------------------------------------------------------------------------
interface CorpusEntry {
  lock: Lock;
  solution: Solution;
  wall: number;
}

/**
 * Collect the first 15 solvable random locks for a plate count, deterministically.
 * Each entry carries the very solve that qualified it (and that solve's wall
 * time) so the corpus stats phase reuses it instead of solving a second time.
 */
function corpusFor(n: number): CorpusEntry[] {
  const out: CorpusEntry[] = [];
  let seed = 1;
  while (out.length < 15) {
    const lock = randomLock(mulberry32(seed * 7 + n), n);
    seed++;
    const t = performance.now();
    const solution = solvePuzzle(n, lock.start, lock.coupling);
    const wall = performance.now() - t;
    if (solution.solvable) out.push({ lock, solution, wall });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Timing.
// ---------------------------------------------------------------------------
interface Timing {
  cold: number;
  median: number;
  max: number;
}

/** 1 cold run (discarded) + `warm` warm runs; returns cold, median, max walls. */
function timeSolve(lock: Lock, warm: number): Timing {
  const run = () => {
    const t = performance.now();
    solvePuzzle(lock.n, lock.start, lock.coupling);
    return performance.now() - t;
  };
  const cold = run();
  const runs: number[] = [];
  for (let k = 0; k < warm; k++) runs.push(run());
  return { cold, median: median(runs), max: Math.max(...runs) };
}

// ---------------------------------------------------------------------------
// Role: worker — run ONE solve, report this isolate's heap+external delta.
// ---------------------------------------------------------------------------
if (!isMainThread) {
  const lock = workerData as Lock;
  const base = process.memoryUsage();
  const t0 = performance.now();
  const r = solvePuzzle(lock.n, lock.start, lock.coupling);
  const ms = performance.now() - t0;
  // Read immediately after the solve returns: JSC frees the large typed-array
  // backing stores lazily (no GC is triggered by the tight synchronous loop),
  // so this reading still reflects the solve's live peak.
  const after = process.memoryUsage();
  const heapExtDelta =
    after.heapUsed +
    after.external +
    after.arrayBuffers -
    base.heapUsed -
    base.external -
    base.arrayBuffers;
  parentPort!.postMessage({ heapExtDelta, ms, statesExplored: r.statesExplored });
}

// ---------------------------------------------------------------------------
// Role: memory child — fresh process, worst-case lock on argv, spawn worker.
// ---------------------------------------------------------------------------
interface MemResult {
  heapExtMiB: number;
  maxRssDeltaMiB: number;
  peakRssDeltaMiB: number;
  maxRssIsKb: boolean;
  solveMs: number;
  statesExplored: number;
}

async function runMemoryChild(lock: Lock): Promise<void> {
  // Empirically detect the maxRSS unit: Node docs claim kilobytes, but bun on
  // macOS returns RAW BYTES. Compare its magnitude to memoryUsage().rss (always
  // bytes) — if maxRSS is far smaller it is in KiB (Linux), otherwise bytes.
  const rssBytes = process.memoryUsage().rss;
  const rawMaxRss = process.resourceUsage().maxRSS;
  const maxRssIsKb = rawMaxRss < rssBytes / 16;
  const toBytes = (v: number) => (maxRssIsKb ? v * 1024 : v);

  const baseMaxRss = toBytes(process.resourceUsage().maxRSS);
  const baseRss = process.memoryUsage().rss;
  let peakRss = baseRss;

  const result = await new Promise<MemResult>((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: lock });
    // Sample process-wide RSS during the worker's synchronous solve. RSS is a
    // process-wide figure, observable across isolates (unlike the per-isolate
    // heap), so this captures the live high-water while the solve runs.
    const timer = setInterval(() => {
      const rss = process.memoryUsage().rss;
      if (rss > peakRss) peakRss = rss;
    }, 30);
    worker.on("message", (m: { heapExtDelta: number; ms: number; statesExplored: number }) => {
      clearInterval(timer);
      const afterMaxRss = toBytes(process.resourceUsage().maxRSS);
      resolve({
        heapExtMiB: m.heapExtDelta / MiB,
        maxRssDeltaMiB: (afterMaxRss - baseMaxRss) / MiB,
        peakRssDeltaMiB: (peakRss - baseRss) / MiB,
        maxRssIsKb,
        solveMs: m.ms,
        statesExplored: m.statesExplored,
      });
      worker.terminate();
    });
    worker.on("error", (err) => {
      clearInterval(timer);
      reject(err);
    });
  });

  process.stdout.write(JSON.stringify(result));
}

// ---------------------------------------------------------------------------
// Role: orchestrator — build corpus, run the gate, print the table.
// ---------------------------------------------------------------------------
interface Row {
  name: string;
  n: number;
  states: number | string;
  cold: number;
  median: number;
  max: number;
  thresholdMs: number | null;
  pass: boolean;
}

function fmtMs(v: number): string {
  return v.toFixed(1).padStart(8);
}

async function runOrchestrator(): Promise<void> {
  const scriptPath = fileURLToPath(import.meta.url);
  console.log("Switch-aware solver — bench gate (C5-v3)\n");

  let gatePass = true;
  const failures: string[] = [];

  // 1) Corpus: 15 solvable locks per N, move-count equality vs reference BFS.
  console.log("Building corpus and checking move-count equality vs reference BFS…");
  const perN: Record<number, { locks: Lock[]; states: number[]; walls: number[] }> = {};
  const hardestByN: Record<number, { lock: Lock; states: number }> = {};
  let corpusChecked = 0;

  for (const n of [4, 5, 6, 7]) {
    const entries = corpusFor(n);
    perN[n] = { locks: entries.map((e) => e.lock), states: [], walls: [] };
    for (const { lock, solution: sol, wall } of entries) {
      const ref = referenceBfs(lock);
      // Cross-check: solvability agreement and shortest move count.
      if (sol.solvable !== ref.solvable) {
        gatePass = false;
        failures.push(
          `corpus N=${n}: solvability mismatch (solver=${sol.solvable}, ref=${ref.solvable})`,
        );
      }
      if (sol.solvable && sol.moves!.length !== ref.moveCount) {
        gatePass = false;
        failures.push(
          `corpus N=${n}: move-count mismatch (solver=${sol.moves!.length}, ref=${ref.moveCount})`,
        );
      }
      corpusChecked++;
      perN[n]!.states.push(sol.statesExplored);
      perN[n]!.walls.push(wall);
      if (!hardestByN[n] || sol.statesExplored > hardestByN[n]!.states) {
        hardestByN[n] = { lock, states: sol.statesExplored };
      }
    }
  }
  console.log(`  ${corpusChecked} corpus locks checked — move counts match reference BFS.\n`);

  // 2) Timed gate cases (1 cold + 5 warm, gate on median warm).
  const bench = benchmarkLock();
  const benchRef = referenceBfs(bench);
  const benchSol = solvePuzzle(bench.n, bench.start, bench.coupling);
  if (benchSol.moves!.length !== 30 || switchCount(benchSol.moves!) !== 8) {
    gatePass = false;
    failures.push(
      `benchmark lock: expected 30 moves / 8 switches, got ${benchSol.moves!.length} moves / ${switchCount(benchSol.moves!)} switches`,
    );
  }
  if (benchSol.moves!.length !== benchRef.moveCount) {
    gatePass = false;
    failures.push(
      `benchmark lock: move count ${benchSol.moves!.length} != reference ${benchRef.moveCount}`,
    );
  }

  const hardest = hardestByN[7]!;
  // Drift guard: HARDEST_SOLVABLE_N7 is frozen in bench-shared so the webkit gate
  // need not re-derive it. If the corpus procedure ever changes what it produces,
  // the two gates would silently measure different puzzles — fail loudly instead.
  if (JSON.stringify(hardest.lock) !== JSON.stringify(HARDEST_SOLVABLE_N7)) {
    gatePass = false;
    failures.push(
      `hardest-solvable N=7 drift: corpus derived ${JSON.stringify(hardest.lock)}, ` +
        `HARDEST_SOLVABLE_N7 constant is ${JSON.stringify(HARDEST_SOLVABLE_N7)}`,
    );
  }

  const unsolvable = unsolvableN7();
  const unsolvableRef = referenceBfs(unsolvable);
  const unsolvableSol = solvePuzzle(7, unsolvable.start, unsolvable.coupling);
  if (unsolvableSol.solvable || unsolvableRef.solvable) {
    gatePass = false;
    failures.push(
      `unsolvable N=7: expected unsolvable (solver=${unsolvableSol.solvable}, ref=${unsolvableRef.solvable})`,
    );
  }

  const rows: Row[] = [];
  const addTimed = (name: string, lock: Lock, states: number | string, thresholdMs: number) => {
    const t = timeSolve(lock, 5);
    const pass = t.median <= thresholdMs;
    if (!pass) {
      gatePass = false;
      failures.push(`${name}: median ${t.median.toFixed(1)} ms > ${thresholdMs} ms`);
    }
    rows.push({
      name,
      n: lock.n,
      states,
      cold: t.cold,
      median: t.median,
      max: t.max,
      thresholdMs,
      pass,
    });
  };

  addTimed("benchmark lock", bench, benchSol.statesExplored, THRESHOLDS.benchmarkMs);
  addTimed("hardest-solvable N=7", hardest.lock, hardest.states, THRESHOLDS.hardestN7Ms);
  addTimed("unsolvable N=7", unsolvable, unsolvableSol.statesExplored, THRESHOLDS.unsolvableN7Ms);

  // 3) Memory: isolated child process running the hardest-solvable N=7.
  console.log("Measuring memory in an isolated child process (hardest-solvable N=7)…\n");
  const child = spawnSync("bun", [scriptPath, "--mem-child", JSON.stringify(hardest.lock)], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (child.status !== 0) {
    gatePass = false;
    failures.push(`memory child exited with status ${child.status}: ${child.stderr}`);
  }
  let mem: MemResult | null = null;
  try {
    mem = JSON.parse(child.stdout.trim()) as MemResult;
  } catch {
    gatePass = false;
    failures.push(`memory child produced no parseable result: ${child.stdout} ${child.stderr}`);
  }

  // ---- Print the report (stdout is the artifact; redirect it if you want a file) ----
  console.log("## Wall-time gate (median of 5 warm after 1 cold)\n");
  console.log("| Case | N | states | cold ms | median ms | max ms | threshold | verdict |");
  console.log("|------|---|--------|---------|-----------|--------|-----------|---------|");
  for (const r of rows) {
    console.log(
      `| ${r.name} | ${r.n} | ${r.states} | ${fmtMs(r.cold).trim()} | ${fmtMs(r.median).trim()} | ${fmtMs(r.max).trim()} | ${r.thresholdMs} ms | ${r.pass ? "PASS" : "FAIL"} |`,
    );
  }

  console.log("\n## Corpus wall summary (single warm run per lock, context only — not gated)\n");
  console.log("| N | locks | max states | median wall ms | max wall ms |");
  console.log("|---|-------|-----------|----------------|-------------|");
  for (const n of [4, 5, 6, 7]) {
    const w = perN[n]!.walls;
    console.log(
      `| ${n} | ${perN[n]!.locks.length} | ${Math.max(...perN[n]!.states)} | ${median(w).toFixed(1)} | ${Math.max(...w).toFixed(1)} |`,
    );
  }

  console.log("\n## Memory gate (isolated child, hardest-solvable N=7)\n");
  if (mem) {
    const heapPass = mem.heapExtMiB <= THRESHOLDS.heapExtMiB;
    const rssPass = mem.maxRssDeltaMiB <= THRESHOLDS.maxRssMiB;
    if (!heapPass) {
      gatePass = false;
      failures.push(
        `memory heap+external ${mem.heapExtMiB.toFixed(1)} MiB > ${THRESHOLDS.heapExtMiB} MiB`,
      );
    }
    if (!rssPass) {
      gatePass = false;
      failures.push(
        `memory maxRSS delta ${mem.maxRssDeltaMiB.toFixed(1)} MiB > ${THRESHOLDS.maxRssMiB} MiB`,
      );
    }
    console.log("| Metric | value | threshold | verdict |");
    console.log("|--------|-------|-----------|---------|");
    console.log(
      `| heapUsed+arrayBuffers+external peak delta | ${mem.heapExtMiB.toFixed(1)} MiB | ${THRESHOLDS.heapExtMiB} MiB | ${heapPass ? "PASS" : "FAIL"} |`,
    );
    console.log(
      `| maxRSS high-water delta (before/after) | ${mem.maxRssDeltaMiB.toFixed(1)} MiB | ${THRESHOLDS.maxRssMiB} MiB | ${rssPass ? "PASS" : "FAIL"} |`,
    );
    console.log(
      `| RSS peak delta (sampled every 30 ms during solve) | ${mem.peakRssDeltaMiB.toFixed(1)} MiB | (context) | — |`,
    );
    console.log(
      `\nmaxRSS unit detected empirically as ${mem.maxRssIsKb ? "KiB (×1024 applied)" : "raw bytes"}; child solve ${mem.solveMs.toFixed(1)} ms, ${mem.statesExplored} states explored.`,
    );
  } else {
    console.log("Memory measurement FAILED — see failures below.");
  }

  console.log(`\n## Verdict: ${gatePass ? "PASS" : "FAIL"}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  process.exit(gatePass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Dispatch (worker role already handled above by falling through).
// ---------------------------------------------------------------------------
if (isMainThread) {
  const memChildIdx = process.argv.indexOf("--mem-child");
  if (memChildIdx !== -1) {
    const lock = JSON.parse(process.argv[memChildIdx + 1]!) as Lock;
    await runMemoryChild(lock);
  } else {
    await runOrchestrator();
  }
}
