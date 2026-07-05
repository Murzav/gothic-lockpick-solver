import { beforeEach, describe, expect, it } from "vitest";
import { lockStore } from "./lock-store.svelte";

describe("lockStore", () => {
  beforeEach(() => {
    lockStore.reset();
  });

  it("defaults to a 5-plate lock with unsolved result", () => {
    expect(lockStore.plateCount).toBe(5);
    expect(lockStore.positions).toEqual([1, 1, 1, 1, 1]);
    expect(lockStore.coupling).toEqual([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(lockStore.convention).toBe("right-increases");
    expect(lockStore.viewMode).toBe("board");
    expect(lockStore.result).toBeNull();
    expect(lockStore.solving).toBe(false);
    expect(lockStore.highlightedPlate).toBeNull();
  });

  it("setPlateCount reshapes positions and coupling and clears the result", () => {
    lockStore.setPosition(0, 5);
    lockStore.setCoupling(0, 1, 1);
    lockStore.result = { solvable: true, moves: [], statesExplored: 1 };

    lockStore.setPlateCount(4);

    expect(lockStore.plateCount).toBe(4);
    expect(lockStore.positions).toEqual([1, 1, 1, 1]);
    expect(lockStore.coupling).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(lockStore.result).toBeNull();
  });

  it("setPlateCount grows arrays for a larger plate count", () => {
    lockStore.setPlateCount(7);

    expect(lockStore.plateCount).toBe(7);
    expect(lockStore.positions).toHaveLength(7);
    expect(lockStore.coupling).toHaveLength(7);
    expect(lockStore.coupling.every((row) => row.length === 7)).toBe(true);
  });

  it("setPosition mutates a single plate position", () => {
    lockStore.setPosition(2, 6);

    expect(lockStore.positions).toEqual([1, 1, 6, 1, 1]);
  });

  it("setCoupling mutates a single coupling cell", () => {
    lockStore.setCoupling(1, 3, -1);

    expect(lockStore.coupling[1][3]).toBe(-1);
    expect(lockStore.coupling[0][0]).toBe(0);
  });

  it("editing a position clears a now-stale result and bumps the generation", () => {
    lockStore.result = { solvable: true, moves: [], statesExplored: 1 };
    lockStore.highlightedPlate = 2;
    const before = lockStore.generation;

    lockStore.setPosition(0, 3);

    expect(lockStore.result).toBeNull();
    expect(lockStore.highlightedPlate).toBeNull();
    expect(lockStore.generation).toBe(before + 1);
  });

  it("editing a coupling clears a now-stale result", () => {
    lockStore.result = { solvable: true, moves: [], statesExplored: 1 };

    lockStore.setCoupling(0, 1, 1);

    expect(lockStore.result).toBeNull();
  });

  it("setConvention updates convention and clears the result", () => {
    lockStore.result = { solvable: false, moves: null, statesExplored: 0 };

    lockStore.setConvention("right-decreases");

    expect(lockStore.convention).toBe("right-decreases");
    expect(lockStore.result).toBeNull();
  });

  it("setViewMode switches the view mode", () => {
    lockStore.setViewMode("form");

    expect(lockStore.viewMode).toBe("form");
  });

  it("reset restores default state", () => {
    lockStore.setPlateCount(7);
    lockStore.setPosition(0, 3);
    lockStore.setCoupling(0, 1, 1);
    lockStore.setConvention("right-decreases");
    lockStore.setViewMode("form");
    lockStore.result = { solvable: true, moves: [], statesExplored: 1 };

    lockStore.reset();

    expect(lockStore.plateCount).toBe(5);
    expect(lockStore.positions).toEqual([1, 1, 1, 1, 1]);
    expect(lockStore.coupling).toEqual([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(lockStore.convention).toBe("right-increases");
    expect(lockStore.viewMode).toBe("board");
    expect(lockStore.result).toBeNull();
    expect(lockStore.solving).toBe(false);
    expect(lockStore.highlightedPlate).toBeNull();
  });

  it("snapshotConfig returns a plain, non-reactive copy of the configuration", () => {
    lockStore.setPlateCount(4);
    lockStore.setPosition(0, 5);
    lockStore.setCoupling(0, 1, -1);

    const snap = lockStore.snapshotConfig();

    expect(snap.plateCount).toBe(4);
    expect(snap.start).toEqual([5, 1, 1, 1]);
    expect(snap.coupling[0][1]).toBe(-1);
    // mutating the snapshot must not touch store state
    snap.start[0] = 9;
    expect(lockStore.positions[0]).toBe(5);
  });
});
