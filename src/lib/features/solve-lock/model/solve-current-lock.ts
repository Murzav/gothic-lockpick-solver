import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { runSolver, SolverSupersededError } from "./run-solver";

/**
 * Orchestrates solving the current lock configuration and writes the result
 * back into the store.
 *
 * This lives in the feature layer — not on the entity store — so the FSD
 * import direction stays strictly downward: features may depend on entities,
 * never the reverse. The store owns state; solving is a use-case.
 *
 * A solve can be superseded mid-flight when a newer one starts: `runSolver`
 * kills the old worker and rejects with SolverSupersededError. The successor now
 * owns `lockStore.solving`, so a superseded call returns quietly — it writes no
 * result and leaves `solving` set for the successor's `finally` to clear.
 */
export async function solveCurrentLock(): Promise<void> {
  const generation = lockStore.generation;
  lockStore.solving = true;
  let superseded = false;
  try {
    const { plateCount, start, coupling } = lockStore.snapshotConfig();
    const result = await runSolver(plateCount, start, coupling);
    // If the lock was edited while the worker ran, this answer is stale —
    // the edit already cleared the result, so don't resurrect it.
    if (lockStore.generation === generation) {
      lockStore.result = result;
    }
  } catch (err) {
    if (!(err instanceof SolverSupersededError)) throw err;
    superseded = true;
  } finally {
    // The successor's own `finally` clears `solving`; don't race it to false.
    if (!superseded) lockStore.solving = false;
  }
}
