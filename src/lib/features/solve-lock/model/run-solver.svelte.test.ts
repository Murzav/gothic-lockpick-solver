import { describe, expect, it } from "vitest";
import { runSolver } from "./run-solver";

describe("runSolver", () => {
  it("resolves a solved lock via the worker", async () => {
    const noCoupling = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const solution = await runSolver(3, [3, 3, 3], noCoupling);
    expect(solution.solvable).toBe(true);
    expect(solution.moves).toHaveLength(3);
  });
});
