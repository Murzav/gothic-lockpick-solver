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

  it("a superseded solve returns quietly and lets the successor finish the job", async () => {
    lockStore.reset();

    // Two overlapping solves: the second synchronously supersedes the first
    // (kills its worker, rejects it). Everything up to the first `await` is
    // synchronous, so the successor is already in flight when the first settles.
    const first = solveCurrentLock();
    const second = solveCurrentLock();

    // The superseded call resolves — it must not surface the supersede as an
    // error — and must NOT clear `solving`: the successor still owns it.
    await expect(first).resolves.toBeUndefined();
    expect(lockStore.solving).toBe(true);

    // The successor completes the job: clears solving and writes its result.
    await second;
    expect(lockStore.solving).toBe(false);
    expect(lockStore.result?.solvable).toBe(true);
  });
});
