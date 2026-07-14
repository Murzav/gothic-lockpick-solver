// oxlint-disable-next-line import/default -- Vite's `?worker` suffix has no static default export the linter can resolve
import SolverWorker from "./solver.worker?worker";
import type { CouplingMatrix, LockState, Solution } from "$lib/entities/lock/model/types";

/** Rejects a superseded solve's promise when a newer solve terminates its worker. */
export class SolverSupersededError extends Error {
  constructor(message = "solve superseded by a newer lock") {
    super(message);
    this.name = "SolverSupersededError";
  }
}

// Only the most recent solve matters. A worker from a superseded lock is dead
// weight — it keeps a core busy and would deliver an answer for a lock the user
// already edited away. We hold the in-flight worker module-scoped and kill it
// the moment a newer solve starts.
let activeWorker: Worker | null = null;
// Reject handle paired with `activeWorker`: superseding settles the old promise
// so callers awaiting it resume instead of hanging on a dead worker forever.
let activeReject: ((err: Error) => void) | null = null;

export function runSolver(
  plateCount: number,
  start: LockState,
  coupling: CouplingMatrix,
): Promise<Solution> {
  if (activeWorker) {
    activeWorker.terminate();
    activeReject?.(new SolverSupersededError());
    activeWorker = null;
    activeReject = null;
  }
  return new Promise((resolve, reject) => {
    const worker = new SolverWorker();
    activeWorker = worker;
    activeReject = reject;
    const finish = () => {
      worker.terminate();
      if (activeWorker === worker) {
        activeWorker = null;
        activeReject = null;
      }
    };
    worker.onmessage = (e: MessageEvent<Solution>) => {
      resolve(e.data);
      finish();
    };
    worker.onerror = (err) => {
      reject(err);
      finish();
    };
    worker.postMessage({ plateCount, start, coupling });
  });
}
