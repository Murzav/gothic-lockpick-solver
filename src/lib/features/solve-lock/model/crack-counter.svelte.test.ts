import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "./playback-store.svelte";
import { crackCounter } from "./crack-counter.svelte";
import type { Solution } from "$lib/entities/lock/model/types";

// A distinct object per solve: the store dedupes on the result *reference*, so
// reusing one literal across tests would wrongly read as "already counted".
function makeResult(): Solution {
  return {
    solvable: true,
    moves: [
      { plate: 0, dir: 1 },
      { plate: 1, dir: 1 },
    ],
    statesExplored: 3,
  };
}

// grouped.length is 2 for makeResult(), so stepIndex 2 is the Done pseudo-step.
const DONE = 2;

function setResult(sol: Solution): void {
  lockStore.result = sol;
  flushSync(); // let the fresh-result effect reset stepIndex to 0
}

let fetchMock: ReturnType<typeof vi.fn>;

function postCalls(): number {
  return fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
    .length;
}

describe("crackCounter Done → POST", () => {
  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ n: 1 }) }));
    vi.stubGlobal("fetch", fetchMock);
    lockStore.reset();
    playbackStore.pause();
    playbackStore.stepIndex = 0;
    crackCounter.total = null;
    flushSync(); // normalise the transition guard: done is false before each test
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires exactly one POST when the replay reaches Done", async () => {
    setResult(makeResult());
    playbackStore.stepIndex = DONE;
    flushSync();

    await vi.waitFor(() => expect(postCalls()).toBe(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/cracked");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("does not double-count when stepping back and forth over Done", async () => {
    setResult(makeResult());
    playbackStore.stepIndex = DONE;
    flushSync();
    await vi.waitFor(() => expect(postCalls()).toBe(1));

    playbackStore.prev(); // leave Done
    flushSync();
    playbackStore.next(); // re-enter Done for the same result
    flushSync();
    await Promise.resolve();

    expect(postCalls()).toBe(1);
  });

  it("counts a second crack for a fresh result", async () => {
    setResult(makeResult());
    playbackStore.stepIndex = DONE;
    flushSync();
    await vi.waitFor(() => expect(postCalls()).toBe(1));

    setResult(makeResult()); // new reference re-arms the one-shot
    playbackStore.stepIndex = DONE;
    flushSync();

    await vi.waitFor(() => expect(postCalls()).toBe(2));
  });

  it("folds the server total in from the POST response", async () => {
    fetchMock.mockReturnValue(Promise.resolve({ json: () => Promise.resolve({ n: 777 }) }));
    setResult(makeResult());
    playbackStore.stepIndex = DONE;
    flushSync();

    await vi.waitFor(() => expect(crackCounter.total).toBe(777));
  });

  it("tolerates a fetch rejection without throwing or blanking the total", async () => {
    crackCounter.total = 500; // an already-shown number
    fetchMock.mockReturnValue(Promise.reject(new Error("offline")));

    setResult(makeResult());
    playbackStore.stepIndex = DONE;
    flushSync();

    await vi.waitFor(() => expect(postCalls()).toBe(1));
    await Promise.resolve();
    expect(crackCounter.total).toBe(500); // untouched, no throw surfaced
  });
});
