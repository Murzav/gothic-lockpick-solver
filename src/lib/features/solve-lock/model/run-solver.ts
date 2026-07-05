// oxlint-disable-next-line import/default -- Vite's `?worker` suffix has no static default export the linter can resolve
import SolverWorker from "./solver.worker?worker";
import type { CouplingMatrix, LockState, Solution } from "$lib/entities/lock/model/types";

export function runSolver(
  plateCount: number,
  start: LockState,
  coupling: CouplingMatrix,
): Promise<Solution> {
  return new Promise((resolve, reject) => {
    const worker = new SolverWorker();
    worker.onmessage = (e: MessageEvent<Solution>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage({ plateCount, start, coupling });
  });
}
