import { afterEach, describe, expect, it } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { solveCurrentLock } from "./solve-current-lock";

describe("solveCurrentLock", () => {
  afterEach(() => lockStore.reset());

  it("toggles solving and stores the solver result on the store", async () => {
    // default 5-plate lock, every pin at position 1, no coupling → solvable
    lockStore.reset();

    const promise = solveCurrentLock();
    expect(lockStore.solving).toBe(true);

    await promise;

    expect(lockStore.solving).toBe(false);
    expect(lockStore.result).not.toBeNull();
    expect(lockStore.result?.solvable).toBe(true);
  });
});
