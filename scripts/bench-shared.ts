/**
 * Shared corpus, cross-check, and timing helpers for the two switch-aware solver
 * bench gates: scripts/bench-solver.ts (bun, in-process) and
 * scripts/bench-solver.webkit.ts (WebKit, real worker). Both import from here so
 * the two gates measure identical puzzles and can never drift apart.
 *
 * Plain relative import (`./bench-shared`) resolves in both environments: bun
 * runs bench-solver.ts directly, and vite/vitest bundles the webkit script.
 */
import { applyMove, encodeState } from "$lib/entities/lock/model/lock";
import { decode } from "$lib/entities/lock/lib/share-codec";
import { GOAL_POS } from "$lib/shared/config";
import type { CouplingMatrix, LockState, Move, MoveDir } from "$lib/entities/lock/model/types";

const DIRS: MoveDir[] = [1, -1];
const BENCHMARK_CODE = "GgiECjKooqkyqqg";

export interface Lock {
  n: number;
  start: LockState;
  coupling: CouplingMatrix;
}

// ---------------------------------------------------------------------------
// Deterministic corpus helpers (mulberry32, same generator as the test suite).
// ---------------------------------------------------------------------------
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random lock: positions 1..7 and a sparse off-diagonal coupling matrix. */
export function randomLock(rand: () => number, n: number): Lock {
  const start: LockState = Array.from({ length: n }, () => 1 + Math.floor(rand() * 7));
  const coupling: CouplingMatrix = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (rand() < 0.3) coupling[i]![j] = rand() < 0.5 ? 1 : -1;
    }
  }
  return { n, start, coupling };
}

export const goalOf = (n: number): LockState => Array.from({ length: n }, () => GOAL_POS);

/** Number of plate switches in a move list (first move counts as zero). */
export function switchCount(moves: Move[]): number {
  let c = 0;
  for (let i = 1; i < moves.length; i++) if (moves[i]!.plate !== moves[i - 1]!.plate) c++;
  return c;
}

/**
 * Independent plain BFS over base lock states — the shape of the old solver.
 * Yields only shortest move count and solvability; it is the cross-check the
 * switch-aware solver's move count must match on every corpus lock.
 */
export function referenceBfs(lock: Lock): { solvable: boolean; moveCount: number | null } {
  const { n, start, coupling } = lock;
  const goalKey = encodeState(goalOf(n));
  const startKey = encodeState(start);
  if (startKey === goalKey) return { solvable: true, moveCount: 0 };

  const visited = new Set<number>([startKey]);
  let frontier: LockState[] = [start];
  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next: LockState[] = [];
    for (const state of frontier) {
      for (let i = 0; i < n; i++) {
        for (const dir of DIRS) {
          const ns = applyMove(state, i, dir, coupling);
          if (ns === state) continue;
          const nk = encodeState(ns);
          if (nk === goalKey) return { solvable: true, moveCount: depth };
          if (!visited.has(nk)) {
            visited.add(nk);
            next.push(ns);
          }
        }
      }
    }
    frontier = next;
  }
  return { solvable: false, moveCount: null };
}

/** The constructed unsolvable N=7: plates 0 and 1 rigidly coupled +1, unequal start. */
export function unsolvableN7(): Lock {
  const n = 7;
  const coupling: CouplingMatrix = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  coupling[0]![1] = 1;
  coupling[1]![0] = 1;
  return { n, start: [3, 5, 1, 7, 2, 6, 4], coupling };
}

export function benchmarkLock(): Lock {
  const d = decode(BENCHMARK_CODE);
  if ("error" in d) throw new Error(`benchmark code failed to decode: ${d.error}`);
  return { n: d.plateCount, start: d.positions, coupling: d.coupling };
}

/**
 * Hardest-solvable N=7 lock, precomputed (404,717 states explored). Derivation:
 * take the first 15 solvable locks from `randomLock(mulberry32(seed * 7 + 7), 7)`
 * for seed = 1, 2, 3, … and pick the one with the most states explored. This is
 * the same corpus procedure `corpusFor(7)` runs in bench-solver.ts, which asserts
 * its derived lock deep-equals this constant — so if the corpus procedure ever
 * changes, the bun gate fails loudly instead of the two gates silently measuring
 * different puzzles. Frozen here as a literal so the webkit gate need not re-run
 * 15 N=7 solves on the page's main thread just to rediscover it.
 */
export const HARDEST_SOLVABLE_N7: Lock = {
  n: 7,
  start: [6, 5, 6, 7, 4, 5, 3],
  coupling: [
    [0, 0, 0, 0, -1, -1, 1],
    [0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, -1, -1, 0, -1, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
    [0, -1, -1, 0, 0, 0, 0],
    [0, 0, -1, 0, 0, 0, 0],
  ],
};

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
