import { describe, expect, it, vi } from "vitest";
import { runSolver, SolverSupersededError } from "./run-solver";

const noCoupling = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

describe("runSolver", () => {
  it("resolves a solved lock via the worker", async () => {
    const solution = await runSolver(3, [3, 3, 3], noCoupling);
    expect(solution.solvable).toBe(true);
    expect(solution.moves).toHaveLength(3);
  });

  it("terminates the still-in-flight previous worker when a new solve starts", async () => {
    const terminateSpy = vi.spyOn(Worker.prototype, "terminate");
    try {
      // Kick off a solve but do NOT await it: everything up to the next await is
      // synchronous, and a worker can only post back on a later task, so this
      // worker is guaranteed still active (module-scoped) on the next line.
      const first = runSolver(3, [3, 3, 3], noCoupling);
      const before = terminateSpy.mock.calls.length;

      // Starting a second solve must terminate that active previous worker.
      const second = runSolver(3, [3, 3, 3], noCoupling);
      expect(terminateSpy.mock.calls.length).toBe(before + 1);

      // The superseded solve must reject so a caller awaiting it resumes instead
      // of hanging forever on a worker that will never post back.
      await expect(first).rejects.toBeInstanceOf(SolverSupersededError);

      // Draining the live one keeps the suite clean.
      await second;
    } finally {
      terminateSpy.mockRestore();
    }
  });
});
