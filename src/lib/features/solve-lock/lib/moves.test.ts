import { describe, it, expect } from "vitest";
import { groupMoves, physicalDirection } from "./moves";
import type { Move, MoveDir } from "$lib/entities/lock/model/types";

// Deterministic PRNG — property-style tests must not depend on Math.random.
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

function randomMoves(rand: () => number, n: number): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < n; i++) {
    const plate = Math.floor(rand() * 4);
    const dir: MoveDir = rand() < 0.5 ? 1 : -1;
    moves.push({ plate, dir });
  }
  return moves;
}

describe("groupMoves", () => {
  it("merges three consecutive identical moves into count:3", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
    ];
    expect(groupMoves(moves)).toEqual([{ plate: 0, dir: 1, count: 3, startIndex: 0 }]);
  });

  it("does not merge alternating moves", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 0, dir: -1 },
      { plate: 0, dir: 1 },
    ];
    expect(groupMoves(moves)).toEqual([
      { plate: 0, dir: 1, count: 1, startIndex: 0 },
      { plate: 0, dir: -1, count: 1, startIndex: 1 },
      { plate: 0, dir: 1, count: 1, startIndex: 2 },
    ]);
  });

  it("does not merge moves on different plates", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 1, dir: 1 },
      { plate: 0, dir: 1 },
    ];
    expect(groupMoves(moves)).toEqual([
      { plate: 0, dir: 1, count: 1, startIndex: 0 },
      { plate: 1, dir: 1, count: 1, startIndex: 1 },
      { plate: 0, dir: 1, count: 1, startIndex: 2 },
    ]);
  });

  it("merges multiple groups correctly with running start indices", () => {
    const moves: Move[] = [
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
      { plate: 1, dir: -1 },
      { plate: 1, dir: -1 },
      { plate: 1, dir: -1 },
    ];
    expect(groupMoves(moves)).toEqual([
      { plate: 0, dir: 1, count: 2, startIndex: 0 },
      { plate: 1, dir: -1, count: 3, startIndex: 2 },
    ]);
  });

  it("startIndex is the running sum of preceding counts; last group ends at moves.length", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rand = mulberry32(seed);
      const n = 1 + Math.floor(rand() * 40);
      const moves = randomMoves(rand, n);
      const grouped = groupMoves(moves);

      let sum = 0;
      for (const g of grouped) {
        expect(g.startIndex).toBe(sum);
        sum += g.count;
      }
      const last = grouped[grouped.length - 1];
      expect(last.startIndex + last.count).toBe(moves.length);
      expect(sum).toBe(moves.length);
    }
  });

  it("returns an empty array for no moves", () => {
    expect(groupMoves([])).toEqual([]);
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
