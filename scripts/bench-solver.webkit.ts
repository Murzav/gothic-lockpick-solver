/**
 * WebKit wall-time gate for the switch-aware solver (C5-v3), driving the REAL
 * solver.worker via a `?worker` import inside a headless WebKit page — the
 * closest stand-in for the production Cloudflare-hosted SPA.
 *
 * This file is NOT part of the default test globs. Run it explicitly:
 *   bunx vitest run --config vitest.bench.config.ts
 *
 * Protocol per case: 1 cold worker round-trip (discarded) + 5 warm; gate on the
 * MEDIAN warm wall. Thresholds are looser than the bun gate to absorb WebKit +
 * Web Worker postMessage overhead: benchmark ≤250 ms, hardest-solvable N=7
 * ≤2.5 s, unsolvable N=7 ≤1.5 s. The worst-case lock is the frozen
 * HARDEST_SOLVABLE_N7 constant from ./bench-shared (the bun gate asserts that
 * constant still matches its corpus), so both gates measure the same puzzles.
 */
import { describe, expect, it } from "vitest";
// oxlint-disable-next-line import/default -- Vite's `?worker` suffix has no static default export the linter can resolve
import SolverWorker from "$lib/features/solve-lock/model/solver.worker?worker";
import type { Solution } from "$lib/entities/lock/model/types";
import {
  benchmarkLock,
  HARDEST_SOLVABLE_N7,
  type Lock,
  median,
  unsolvableN7,
} from "./bench-shared";

/** One solve as a worker round-trip: post the lock, resolve on the reply. */
function solveViaWorker(worker: Worker, lock: Lock): Promise<Solution> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<Solution>) => resolve(e.data);
    worker.onerror = (err) => reject(err);
    worker.postMessage({ plateCount: lock.n, start: lock.start, coupling: lock.coupling });
  });
}

/** 1 cold + 5 warm round-trips; returns cold, median warm, max warm walls (ms). */
async function timeViaWorker(
  lock: Lock,
): Promise<{ cold: number; median: number; max: number; solution: Solution }> {
  const worker = new SolverWorker();
  try {
    const once = async () => {
      const t = performance.now();
      const sol = await solveViaWorker(worker, lock);
      return { wall: performance.now() - t, sol };
    };
    const first = await once();
    const warm: number[] = [];
    let last = first.sol;
    for (let k = 0; k < 5; k++) {
      const r = await once();
      warm.push(r.wall);
      last = r.sol;
    }
    return { cold: first.wall, median: median(warm), max: Math.max(...warm), solution: last };
  } finally {
    worker.terminate();
  }
}

describe("WebKit bench gate — real solver.worker", () => {
  it("benchmark lock solves within 250 ms (median warm)", async () => {
    const lock = benchmarkLock();
    const t = await timeViaWorker(lock);
    // eslint-disable-next-line no-console
    console.log(
      `[webkit] benchmark N=${lock.n}: cold=${t.cold.toFixed(1)} median=${t.median.toFixed(1)} max=${t.max.toFixed(1)} ms (thr 250)`,
    );
    expect(t.solution.solvable).toBe(true);
    expect(t.solution.moves!.length).toBe(30);
    expect(t.median).toBeLessThanOrEqual(250);
  }, 120_000);

  it("hardest-solvable N=7 solves within 2.5 s (median warm)", async () => {
    const lock = HARDEST_SOLVABLE_N7;
    const t = await timeViaWorker(lock);
    // eslint-disable-next-line no-console
    console.log(
      `[webkit] hardest N=7: cold=${t.cold.toFixed(1)} median=${t.median.toFixed(1)} max=${t.max.toFixed(1)} ms (thr 2500)`,
    );
    expect(t.solution.solvable).toBe(true);
    expect(t.median).toBeLessThanOrEqual(2500);
  }, 120_000);

  it("unsolvable N=7 drains within 1.5 s (median warm)", async () => {
    const lock = unsolvableN7();
    const t = await timeViaWorker(lock);
    // eslint-disable-next-line no-console
    console.log(
      `[webkit] unsolvable N=7: cold=${t.cold.toFixed(1)} median=${t.median.toFixed(1)} max=${t.max.toFixed(1)} ms (thr 1500)`,
    );
    expect(t.solution.solvable).toBe(false);
    expect(t.median).toBeLessThanOrEqual(1500);
  }, 120_000);
});
