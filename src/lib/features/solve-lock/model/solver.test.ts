import { describe, expect, it } from "vitest";
import { solvePuzzle } from "./solver";
import { applyMove } from "$lib/entities/lock/model/lock";
import type { CouplingMatrix, LockState } from "$lib/entities/lock/model/types";

const noCoupling = (n: number): CouplingMatrix =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

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
