import { describe, expect, it } from "vitest";
import { solvePuzzle } from "./solver";
import { applyMove, encodeState } from "$lib/entities/lock/model/lock";
import { decode } from "$lib/entities/lock/lib/share-codec";
import { GOAL_POS } from "$lib/shared/config";
import type { CouplingMatrix, LockState, Move, MoveDir } from "$lib/entities/lock/model/types";

const noCoupling = (n: number): CouplingMatrix =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

const DIRS: MoveDir[] = [1, -1];

// Deterministic PRNG — property-style tests must not depend on Math.random.
// Same generator the moves.test.ts suite uses.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random lock: positions in 1..7 and a sparse off-diagonal coupling matrix. */
function randomLock(rand: () => number, n: number): { start: LockState; coupling: CouplingMatrix } {
  const start: LockState = Array.from({ length: n }, () => 1 + Math.floor(rand() * 7));
  const coupling = noCoupling(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      // Keep couplings sparse so the corpus is a healthy mix of solvable and
      // unsolvable locks rather than mostly-jammed ones.
      if (rand() < 0.3) coupling[i]![j] = rand() < 0.5 ? 1 : -1;
    }
  }
  return { start, coupling };
}

/** Number of plate switches in a move list (first move counts as zero). */
function switchCount(moves: Move[]): number {
  let c = 0;
  for (let i = 1; i < moves.length; i++) {
    if (moves[i]!.plate !== moves[i - 1]!.plate) c++;
  }
  return c;
}

/** Replay a move list; throws on any wall hit (no-op), returns the final state. */
function replay(start: LockState, moves: Move[], coupling: CouplingMatrix): LockState {
  let s = start;
  for (const m of moves) {
    const ns = applyMove(s, m.plate, m.dir, coupling);
    if (ns === s) throw new Error(`no-op move ${m.plate}/${m.dir} at ${JSON.stringify(s)}`);
    s = ns;
  }
  return s;
}

const goalOf = (n: number): LockState => Array.from({ length: n }, () => GOAL_POS);

/**
 * Independent plain-BFS reference over base lock states — the shape of the old
 * solver. Yields only shortest move count and solvability, no switch awareness.
 */
function referenceBfs(
  n: number,
  start: LockState,
  coupling: CouplingMatrix,
): { solvable: boolean; moveCount: number | null } {
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

/**
 * Independent brute-force minimum switch count among ALL shortest solutions.
 *
 * First a plain BFS labels every reachable state with its shortest distance
 * from the start; then a memoized DFS walks only shortest-path edges
 * (dist increases by exactly one) from the start toward the goal, minimizing
 * switches. Memo key is (stateKey, lastPlate) — the only context the remaining
 * switch cost depends on. This is a separate implementation from the solver, so
 * agreement cross-checks the solver's own relaxation. Returns null if unsolvable.
 */
function bruteMinSwitches(n: number, start: LockState, coupling: CouplingMatrix): number | null {
  const SENTINEL = n;
  const goalKey = encodeState(goalOf(n));
  const startKey = encodeState(start);
  if (startKey === goalKey) return 0;

  const dist = new Map<number, number>([[startKey, 0]]);
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
          if (!dist.has(nk)) {
            dist.set(nk, depth);
            next.push(ns);
          }
        }
      }
    }
    frontier = next;
  }
  if (!dist.has(goalKey)) return null;

  const memo = new Map<string, number>();
  const rec = (state: LockState, stateKey: number, lastPlate: number): number => {
    if (stateKey === goalKey) return 0;
    const key = `${stateKey}:${lastPlate}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = Number.POSITIVE_INFINITY;
    const here = dist.get(stateKey)!;
    for (let i = 0; i < n; i++) {
      for (const dir of DIRS) {
        const ns = applyMove(state, i, dir, coupling);
        if (ns === state) continue;
        const nk = encodeState(ns);
        // Only follow shortest-path edges (one step closer to the goal length).
        if (dist.get(nk) !== here + 1) continue;
        const switchCost = lastPlate === SENTINEL || lastPlate === i ? 0 : 1;
        const sub = rec(ns, nk, i);
        if (sub !== Number.POSITIVE_INFINITY) best = Math.min(best, switchCost + sub);
      }
    }
    memo.set(key, best);
    return best;
  };
  return rec(start, startKey, SENTINEL);
}

describe("solvePuzzle", () => {
  it("returns 0 moves when already solved", () => {
    const r = solvePuzzle(3, [4, 4, 4], noCoupling(3));
    expect(r).toEqual({ solvable: true, moves: [], statesExplored: 1 });
  });

  it("solves an independent-plates lock with the shortest sequence", () => {
    // each plate one step from center, no coupling → 3 moves
    const r = solvePuzzle(3, [3, 3, 3], noCoupling(3));
    expect(r.solvable).toBe(true);
    expect(r.moves).toHaveLength(3);
  });

  it("produces a solution whose moves never hit a wall when replayed", () => {
    const c: CouplingMatrix = [
      [0, 1, 0],
      [0, 0, -1],
      [0, 0, 0],
    ];
    const start: LockState = [2, 5, 6];
    const r = solvePuzzle(3, start, c);
    expect(r.solvable).toBe(true);
    // replay: every move must actually change the state (no rejected/no-op move)
    let s: LockState = start;
    for (const m of r.moves!) {
      const ns = applyMove(s, m.plate, m.dir, c);
      expect(ns).not.toBe(s); // reference changed ⇒ move applied, no wall hit
      s = ns;
    }
    expect(s).toEqual([4, 4, 4]);
  });

  it("reports unsolvable honestly", () => {
    // plate 0 and 1 rigidly locked so both can never both reach 4 from this start
    const c: CouplingMatrix = [
      [0, 1],
      [1, 0],
    ];
    const r = solvePuzzle(2, [3, 5], c); // moving either keeps their sum offset
    expect(r.solvable).toBe(false);
    expect(r.moves).toBeNull();
  });

  it("solves a golden 4-plate lock with partial coupling", () => {
    // plate 0 also drags plate 1; plates 2 and 3 are independent
    const c: CouplingMatrix = [
      [0, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const start: LockState = [3, 3, 5, 6];
    const r = solvePuzzle(4, start, c);
    expect(r.solvable).toBe(true);
    let s: LockState = start;
    for (const m of r.moves!) {
      const ns = applyMove(s, m.plate, m.dir, c);
      expect(ns).not.toBe(s);
      s = ns;
    }
    expect(s).toEqual([4, 4, 4, 4]);
  });
});

describe("solvePuzzle — replay validity", () => {
  it("replays fixed hand-built locks to all-goal with zero no-ops", () => {
    const cases: Array<{ n: number; start: LockState; coupling: CouplingMatrix }> = [
      { n: 3, start: [3, 3, 3], coupling: noCoupling(3) },
      { n: 4, start: [1, 7, 1, 7], coupling: noCoupling(4) },
      {
        n: 3,
        start: [2, 5, 6],
        coupling: [
          [0, 1, 0],
          [0, 0, -1],
          [0, 0, 0],
        ],
      },
    ];
    for (const { n, start, coupling } of cases) {
      const r = solvePuzzle(n, start, coupling);
      expect(r.solvable).toBe(true);
      expect(replay(start, r.moves!, coupling)).toEqual(goalOf(n));
    }
  });

  it("replays every solvable seeded random 4–6 plate lock to all-goal", () => {
    let solvableSeen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const rand = mulberry32(seed);
      const n = 4 + (seed % 3); // cycles 4, 5, 6
      const { start, coupling } = randomLock(rand, n);
      const r = solvePuzzle(n, start, coupling);
      if (!r.solvable) {
        expect(r.moves).toBeNull();
        continue;
      }
      solvableSeen++;
      // No move may hit a wall, and the replay must land exactly on the goal.
      expect(replay(start, r.moves!, coupling)).toEqual(goalOf(n));
    }
    // Sanity: the corpus actually exercised solvable locks.
    expect(solvableSeen).toBeGreaterThan(0);
  });
});

describe("solvePuzzle — move-count equality vs reference BFS", () => {
  it("matches a plain BFS on solvability and shortest length across seeded locks", () => {
    let solvable = 0;
    let unsolvable = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const rand = mulberry32(seed * 7 + 1);
      const n = 4 + (seed % 3); // cycles 4, 5, 6
      const { start, coupling } = randomLock(rand, n);

      const solver = solvePuzzle(n, start, coupling);
      const ref = referenceBfs(n, start, coupling);

      expect(solver.solvable).toBe(ref.solvable);
      if (solver.solvable) {
        solvable++;
        expect(solver.moves!.length).toBe(ref.moveCount);
      } else {
        unsolvable++;
      }
    }
    // The corpus must cover both branches to make the agreement meaningful.
    expect(solvable).toBeGreaterThan(0);
    expect(unsolvable).toBeGreaterThan(0);
  });
});

describe("solvePuzzle — minimum switches (brute-force cross-check)", () => {
  it("emits the true minimum switch count among shortest solutions on 3-plate locks", () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rand = mulberry32(seed * 13 + 5);
      const n = 3; // 7^3 = 343 states — brute force is cheap
      const { start, coupling } = randomLock(rand, n);

      const solver = solvePuzzle(n, start, coupling);
      const brute = bruteMinSwitches(n, start, coupling);

      if (brute === null) {
        expect(solver.solvable).toBe(false);
        continue;
      }
      expect(solver.solvable).toBe(true);
      // Move count is shortest (matches independent BFS) …
      expect(solver.moves!.length).toBe(referenceBfs(n, start, coupling).moveCount);
      // … and, among all shortest solutions, switches are truly minimal.
      expect(switchCount(solver.moves!)).toBe(brute);
      // Emitted path must actually solve the lock.
      expect(replay(start, solver.moves!, coupling)).toEqual(goalOf(n));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("solvePuzzle — benchmark lock regression", () => {
  const CODE = "GgiECjKooqkyqqg";

  it("solves the reference lock in 30 moves / 8 switches, replays, deterministically", () => {
    const lock = decode(CODE);
    expect("error" in lock).toBe(false);
    if ("error" in lock) return; // narrows the type for the compiler
    const { plateCount, positions, coupling } = lock;

    const r1 = solvePuzzle(plateCount, positions, coupling);
    expect(r1.solvable).toBe(true);
    expect(r1.moves).toHaveLength(30);
    expect(switchCount(r1.moves!)).toBe(8);
    expect(replay(positions, r1.moves!, coupling)).toEqual(goalOf(plateCount));

    // Determinism: an identical input yields an identical move array.
    const r2 = solvePuzzle(plateCount, positions, coupling);
    expect(r2.moves).toEqual(r1.moves);
    expect(r2.statesExplored).toBe(r1.statesExplored);
  });
});

describe("solvePuzzle — result shapes", () => {
  it("already-solved returns the exact zero-move shape", () => {
    const r = solvePuzzle(5, goalOf(5), noCoupling(5));
    expect(r).toEqual({ solvable: true, moves: [], statesExplored: 1 });
  });

  it("unsolvable returns the exact null-moves shape", () => {
    // plates 0 and 1 rigidly coupled +1, unequal start → never both reach goal
    const c: CouplingMatrix = [
      [0, 1],
      [1, 0],
    ];
    const r = solvePuzzle(2, [3, 5], c);
    expect(r.solvable).toBe(false);
    expect(r.moves).toBeNull();
    expect(typeof r.statesExplored).toBe("number");
    expect(r.statesExplored).toBeGreaterThanOrEqual(1);
  });
});
