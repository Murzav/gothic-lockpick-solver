import { describe, it, expect } from "vitest";
import { groupMoves, physicalDirection } from "./moves";
import type { Move } from "$lib/entities/lock/model/types";

describe("groupMoves", () => {
  it("merges three consecutive identical moves into count:3", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
    ];
    const result = groupMoves(moves);
    expect(result).toEqual([{ plate: 0, dir: 1, count: 3 }]);
  });

  it("does not merge alternating moves", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 0, dir: -1 },
      { plate: 0, dir: 1 },
    ];
    const result = groupMoves(moves);
    expect(result).toEqual([
      { plate: 0, dir: 1, count: 1 },
      { plate: 0, dir: -1, count: 1 },
      { plate: 0, dir: 1, count: 1 },
    ]);
  });

  it("does not merge moves on different plates", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 1, dir: 1 },
      { plate: 0, dir: 1 },
    ];
    const result = groupMoves(moves);
    expect(result).toEqual([
      { plate: 0, dir: 1, count: 1 },
      { plate: 1, dir: 1, count: 1 },
      { plate: 0, dir: 1, count: 1 },
    ]);
  });

  it("merges multiple groups correctly", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
      { plate: 1, dir: -1 },
      { plate: 1, dir: -1 },
      { plate: 1, dir: -1 },
    ];
    const result = groupMoves(moves);
    expect(result).toEqual([
      { plate: 0, dir: 1, count: 2 },
      { plate: 1, dir: -1, count: 3 },
    ]);
  });
});

describe("physicalDirection", () => {
  it("maps dir 1 to right when convention is right-increases", () => {
    expect(physicalDirection(1, "right-increases")).toBe("right");
  });

  it("maps dir 1 to left when convention is right-decreases", () => {
    expect(physicalDirection(1, "right-decreases")).toBe("left");
  });

  it("maps dir -1 to left when convention is right-increases", () => {
    expect(physicalDirection(-1, "right-increases")).toBe("left");
  });

  it("maps dir -1 to right when convention is right-decreases", () => {
    expect(physicalDirection(-1, "right-decreases")).toBe("right");
  });
});
