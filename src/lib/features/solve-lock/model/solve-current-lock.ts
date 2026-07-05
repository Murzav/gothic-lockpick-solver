import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { runSolver } from "./run-solver";

/**
 * Orchestrates solving the current lock configuration and writes the result
 * back into the store.
 *
 * This lives in the feature layer — not on the entity store — so the FSD
 * import direction stays strictly downward: features may depend on entities,
 * never the reverse. The store owns state; solving is a use-case.
 */
export async function solveCurrentLock(): Promise<void> {
  const generation = lockStore.generation;
  lockStore.solving = true;
  try {
    const { plateCount, start, coupling } = lockStore.snapshotConfig();
    const result = await runSolver(plateCount, start, coupling);
    // If the lock was edited while the worker ran, this answer is stale —
    // the edit already cleared the result, so don't resurrect it.
    if (lockStore.generation === generation) {
      lockStore.result = result;
    }
  } finally {
    lockStore.solving = false;
  }
}
