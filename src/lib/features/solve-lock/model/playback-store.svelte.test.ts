import { beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "./playback-store.svelte";
import type { Solution } from "$lib/entities/lock/model/types";

const STORAGE_KEY = "gls:playback:v1";
const SPEECH_STORAGE_KEY = "gls:playback-speech:v1";

// Assign a fabricated solver result and let the fresh-result effect settle
// (it resets stepIndex to 0).
function setResult(sol: Solution): void {
  lockStore.result = sol;
  flushSync();
}

describe("playbackStore", () => {
  beforeEach(() => {
    lockStore.reset();
    localStorage.removeItem(STORAGE_KEY);
    playbackStore.loadFollowBoard();
    playbackStore.stepIndex = 0;
    flushSync();
  });

  it("groups the current solution and reports it active", () => {
    setResult({
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 0, dir: 1 },
      ],
      statesExplored: 3,
    });
    expect(playbackStore.grouped).toEqual([{ plate: 0, dir: 1, count: 2, startIndex: 0 }]);
    expect(playbackStore.active).toBe(true);
  });

  it("is inactive for an unsolvable or already-open lock", () => {
    setResult({ solvable: false, moves: null, statesExplored: 9 });
    expect(playbackStore.active).toBe(false);

    setResult({ solvable: true, moves: [], statesExplored: 1 });
    expect(playbackStore.active).toBe(false);
  });

  it("folds applyMove over the raw-move prefix for positionsBeforeStep", () => {
    lockStore.setPlateCount(2); // [1,1], zero coupling
    setResult({
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 0, dir: 1 },
        { plate: 1, dir: 1 },
      ],
      statesExplored: 4,
    });
    // grouped: [{0,+1,count 2,start 0}, {1,+1,count 1,start 2}]

    playbackStore.stepIndex = 0;
    expect(playbackStore.positionsBeforeStep).toEqual([1, 1]); // before group 0

    playbackStore.stepIndex = 1;
    expect(playbackStore.positionsBeforeStep).toEqual([3, 1]); // moves[0..2)

    playbackStore.stepIndex = 2; // Done
    expect(playbackStore.atDone).toBe(true);
    expect(playbackStore.positionsBeforeStep).toEqual([3, 2]); // all moves
  });

  it("returns live board positions when inactive", () => {
    lockStore.setPosition(0, 5);
    setResult({ solvable: false, moves: null, statesExplored: 1 });
    expect(playbackStore.positionsBeforeStep).toEqual(lockStore.positions);
  });

  it("next/prev dead-stop at both ends and reach the Done pseudo-step", () => {
    setResult({
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 1, dir: 1 },
      ],
      statesExplored: 3,
    });
    expect(playbackStore.stepIndex).toBe(0);

    playbackStore.prev();
    expect(playbackStore.stepIndex).toBe(0); // dead stop

    playbackStore.next();
    playbackStore.next();
    expect(playbackStore.stepIndex).toBe(2); // Done
    expect(playbackStore.atDone).toBe(true);

    playbackStore.next();
    expect(playbackStore.stepIndex).toBe(2); // dead stop at Done
  });

  it("restart/toFirst reset; toLast lands on the last instruction step", () => {
    setResult({
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 1, dir: 1 },
      ],
      statesExplored: 3,
    });
    playbackStore.next();
    playbackStore.restart();
    expect(playbackStore.stepIndex).toBe(0);

    playbackStore.toLast();
    expect(playbackStore.stepIndex).toBe(1); // grouped.length - 1, NOT Done

    playbackStore.toFirst();
    expect(playbackStore.stepIndex).toBe(0);
  });

  it("mirrors the current plate onto the board highlight and clears it at Done", () => {
    setResult({
      solvable: true,
      moves: [
        { plate: 2, dir: 1 },
        { plate: 0, dir: 1 },
      ],
      statesExplored: 3,
    });
    flushSync();
    expect(lockStore.highlightedPlate).toBe(2);

    playbackStore.next();
    flushSync();
    expect(lockStore.highlightedPlate).toBe(0);

    playbackStore.next(); // Done
    flushSync();
    expect(lockStore.highlightedPlate).toBeNull();
  });

  it("resets to step 0 when a fresh result arrives", () => {
    setResult({
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 1, dir: 1 },
      ],
      statesExplored: 3,
    });
    playbackStore.next();
    expect(playbackStore.stepIndex).toBe(1);

    setResult({ solvable: true, moves: [{ plate: 0, dir: 1 }], statesExplored: 2 });
    expect(playbackStore.stepIndex).toBe(0);
  });

  it("hydrates followBoard to true when unset and persists changes", () => {
    localStorage.removeItem(STORAGE_KEY);
    playbackStore.loadFollowBoard();
    expect(playbackStore.followBoard).toBe(true);

    localStorage.setItem(STORAGE_KEY, "false");
    playbackStore.loadFollowBoard();
    expect(playbackStore.followBoard).toBe(false);

    playbackStore.followBoard = true;
    flushSync();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");

    playbackStore.followBoard = false;
    flushSync();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
  });

  it("keeps voiceEnabled off by default, hydrates from storage, and persists changes", () => {
    localStorage.removeItem(SPEECH_STORAGE_KEY);
    playbackStore.loadVoiceEnabled();
    expect(playbackStore.voiceEnabled).toBe(false); // opt-in: silent unless asked

    localStorage.setItem(SPEECH_STORAGE_KEY, "true");
    playbackStore.loadVoiceEnabled();
    expect(playbackStore.voiceEnabled).toBe(true);

    // A corrupt value must never surface as surprise audio.
    localStorage.setItem(SPEECH_STORAGE_KEY, "{not json");
    playbackStore.loadVoiceEnabled();
    expect(playbackStore.voiceEnabled).toBe(false);

    playbackStore.voiceEnabled = true;
    flushSync();
    expect(localStorage.getItem(SPEECH_STORAGE_KEY)).toBe("true");

    playbackStore.voiceEnabled = false;
    flushSync();
    expect(localStorage.getItem(SPEECH_STORAGE_KEY)).toBe("false");
  });
});
