import { describe, expect, it } from "vitest";
import { applyMove, clampPosition, encodeState, isGoalState } from "./lock";
import type { CouplingMatrix, LockState } from "./types";

const noCoupling = (n: number): CouplingMatrix =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => 0));

describe("clampPosition", () => {
  it("clamps into [1,7]", () => {
    expect(clampPosition(0)).toBe(1);
    expect(clampPosition(8)).toBe(7);
    expect(clampPosition(4)).toBe(4);
  });
});

describe("isGoalState", () => {
  it("true only when every plate is at 4", () => {
    expect(isGoalState([4, 4, 4])).toBe(true);
    expect(isGoalState([4, 4, 3])).toBe(false);
  });
});

describe("encodeState", () => {
  it("is unique per distinct state of equal length", () => {
    const seen = new Set<number>();
    for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) seen.add(encodeState([a, b]));
    expect(seen.size).toBe(49);
  });
});

describe("applyMove", () => {
  it("moves the pressed plate by +1 with no coupling", () => {
    const s: LockState = [3, 3];
    expect(applyMove(s, 0, 1, noCoupling(2))).toEqual([4, 3]);
  });

  it("LEFT is the exact mirror of RIGHT", () => {
    const c: CouplingMatrix = [
      [0, 1],
      [0, 0],
    ];
    expect(applyMove([3, 3], 0, 1, c)).toEqual([4, 4]); // right: plate1 +1, plate2 +1
    expect(applyMove([3, 3], 0, -1, c)).toEqual([2, 2]); // left: mirror
  });

  it("handles asymmetric coupling (A→B ≠ B→A)", () => {
    const c: CouplingMatrix = [
      [0, 1],
      [0, 0],
    ]; // moving 0 affects 1; moving 1 affects nothing
    expect(applyMove([3, 3], 0, 1, c)).toEqual([4, 4]);
    expect(applyMove([3, 3], 1, 1, c)).toEqual([3, 4]);
  });

  it("rejects the WHOLE move atomically if the pressed plate hits a wall", () => {
    const s: LockState = [7, 3];
    expect(applyMove(s, 0, 1, noCoupling(2))).toBe(s); // same reference, unchanged
  });

  it("rejects the whole move if a LINKED plate hits a wall (nothing moves)", () => {
    const c: CouplingMatrix = [
      [0, 1],
      [0, 0],
    ];
    const s: LockState = [3, 7]; // plate0 could move, but linked plate1 is at wall
    expect(applyMove(s, 0, 1, c)).toBe(s);
  });
});
