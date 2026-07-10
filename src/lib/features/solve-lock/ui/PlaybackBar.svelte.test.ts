import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
import { speaker } from "$lib/shared/lib/speech";
import PlaybackBar from "./PlaybackBar.svelte";
import type { Solution } from "$lib/entities/lock/model/types";

function setResult(sol: Solution): void {
  lockStore.result = sol;
  flushSync();
}

const TWO_GROUPS: Solution = {
  solvable: true,
  moves: [
    { plate: 0, dir: 1 },
    { plate: 1, dir: 1 },
  ],
  statesExplored: 3,
};

describe("PlaybackBar", () => {
  beforeEach(() => {
    playbackStore.pause(); // drop any dwell timer a prior test left running
    lockStore.reset();
    playbackStore.followBoard = true;
    playbackStore.voiceEnabled = false;
    playbackStore.voiceRate = 0.9;
    playbackStore.stepIndex = 0;
    flushSync();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides when inactive and shows when active", async () => {
    const screen = render(PlaybackBar);
    expect(screen.container.querySelector(".bar")).toBeNull();

    setResult(TWO_GROUPS);
    await expect.element(screen.getByRole("button", { name: "Next →" })).toBeVisible();
  });

  it("advances, rewinds and restarts via the nav buttons", async () => {
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);

    await screen.getByRole("button", { name: "Next →" }).click();
    expect(playbackStore.stepIndex).toBe(1);

    await screen.getByRole("button", { name: "← Back" }).click();
    expect(playbackStore.stepIndex).toBe(0);

    await screen.getByRole("button", { name: "Next →" }).click();
    await screen.getByRole("button", { name: "Restart" }).click();
    expect(playbackStore.stepIndex).toBe(0);
  });

  it("shows the done state and disables next at the end", async () => {
    setResult({ solvable: true, moves: [{ plate: 0, dir: 1 }], statesExplored: 2 });
    playbackStore.next(); // grouped length 1 -> stepIndex 1 = Done
    const screen = render(PlaybackBar);

    await expect.element(screen.getByText(/Lock open/)).toBeVisible();
    const next = screen.container.querySelector<HTMLButtonElement>("button.primary");
    expect(next?.disabled).toBe(true);
  });

  it("reflects step position in the progress bar width", () => {
    setResult(TWO_GROUPS);
    playbackStore.next(); // stepIndex 1 of 2 groups
    const screen = render(PlaybackBar);
    const bar = screen.container.querySelector<HTMLElement>(".progress");
    expect(bar?.style.width).toBe("50%");
  });

  it("maps keyboard keys to playback and guards repeat/modifier/target", async () => {
    setResult(TWO_GROUPS);
    render(PlaybackBar);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }));
    expect(playbackStore.stepIndex).toBe(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", cancelable: true }));
    expect(playbackStore.stepIndex).toBe(2); // Done

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true }));
    expect(playbackStore.stepIndex).toBe(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", cancelable: true }));
    expect(playbackStore.stepIndex).toBe(0);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "End", cancelable: true }));
    expect(playbackStore.stepIndex).toBe(1); // last instruction step

    // repeat is ignored
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: true, cancelable: true }),
    );
    expect(playbackStore.stepIndex).toBe(1);

    // modifiers are ignored
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", metaKey: true, cancelable: true }),
    );
    expect(playbackStore.stepIndex).toBe(1);

    // events from a typing target are ignored
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
    );
    expect(playbackStore.stepIndex).toBe(1);
    input.remove();
  });

  it("prevents default for playback keys even at a dead stop", () => {
    setResult({ solvable: true, moves: [{ plate: 0, dir: 1 }], statesExplored: 2 });
    render(PlaybackBar); // stepIndex 0

    const ev = new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true });
    window.dispatchEvent(ev);
    expect(playbackStore.stepIndex).toBe(0); // dead stop
    expect(ev.defaultPrevented).toBe(true); // playback still owns the key
  });

  it("removes the key listener after unmount", async () => {
    setResult(TWO_GROUPS);
    const { unmount } = render(PlaybackBar);
    await unmount();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true }));
    expect(playbackStore.stepIndex).toBe(0);
  });

  // Spying replaces speak/cancel wholesale, so headless-chromium voice
  // availability never reaches the real engine — the assertions pin the
  // Speaker interface calls (text + language chain) rather than audio.
  const EN_LANGS = ["en-US", "en"];

  it("stays silent while voice is off (the default)", async () => {
    const speak = vi.spyOn(speaker, "speak");
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);

    await screen.getByRole("button", { name: "Next →" }).click();
    flushSync();
    expect(playbackStore.stepIndex).toBe(1);
    expect(speak).not.toHaveBeenCalled();
  });

  it("announces the next step (correct langs + rate) when advancing with voice on", async () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = true;
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);
    speak.mockClear();

    await screen.getByRole("button", { name: "Next →" }).click();
    flushSync();
    expect(playbackStore.stepIndex).toBe(1);
    expect(speak).toHaveBeenLastCalledWith({
      text: "Plate 2. Right.",
      langs: EN_LANGS,
      rate: 0.9,
    });
  });

  it("speaks the done phrase on reaching the end with voice on", async () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = true;
    setResult({ solvable: true, moves: [{ plate: 0, dir: 1 }], statesExplored: 2 });
    const screen = render(PlaybackBar);
    speak.mockClear();

    await screen.getByRole("button", { name: "Next →" }).click(); // one group → Done
    flushSync();
    expect(playbackStore.atDone).toBe(true);
    expect(speak).toHaveBeenLastCalledWith({ text: "Lock open", langs: EN_LANGS, rate: 0.9 });
  });

  it("calls speak per rapid step — coalescing lives inside the speaker", async () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = true;
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);
    speak.mockClear();

    const next = screen.getByRole("button", { name: "Next →" });
    await next.click();
    await next.click();
    flushSync();
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it("cancels speech on unmount", async () => {
    const cancel = vi.spyOn(speaker, "cancel");
    setResult(TWO_GROUPS);
    const { unmount } = render(PlaybackBar);
    cancel.mockClear();

    await unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("does not speak on the first render of an active bar", () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = true;
    setResult(TWO_GROUPS);
    render(PlaybackBar);
    flushSync();

    expect(speak).not.toHaveBeenCalled();
  });

  it("swaps the transport button label between Play and Pause", async () => {
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);

    await expect.element(screen.getByRole("button", { name: "Play" })).toBeVisible();
    await screen.getByRole("button", { name: "Play" }).click();
    await expect.element(screen.getByRole("button", { name: "Pause" })).toBeVisible();
    await screen.getByRole("button", { name: "Pause" }).click();
    await expect.element(screen.getByRole("button", { name: "Play" })).toBeVisible();
    playbackStore.pause();
  });

  it("toggles play/pause with the p key", () => {
    setResult(TWO_GROUPS);
    render(PlaybackBar);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", cancelable: true }));
    flushSync();
    expect(playbackStore.isPlaying).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", cancelable: true }));
    flushSync();
    expect(playbackStore.isPlaying).toBe(false);
    playbackStore.pause();
  });

  it("kickoff: pressing Play at step 0 speaks that step exactly once (voice on)", async () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = true;
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);
    speak.mockClear();

    await screen.getByRole("button", { name: "Play" }).click();
    flushSync();
    expect(playbackStore.isPlaying).toBe(true);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith({
      text: "Plate 1. Right.",
      langs: EN_LANGS,
      rate: 0.9,
    });
    playbackStore.pause();
  });

  it("plays silently when voice is off — advances with no speech", () => {
    const speak = vi.spyOn(speaker, "speak");
    setResult(TWO_GROUPS);
    render(PlaybackBar);
    speak.mockClear();

    // Only the dwell timer is faked; the kickoff/step effect still flushes.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      playbackStore.play();
      flushSync();
      expect(playbackStore.isPlaying).toBe(true);

      vi.advanceTimersToNextTimer(); // one dwell elapses
      flushSync();
      expect(playbackStore.stepIndex).toBe(1);
      expect(speak).not.toHaveBeenCalled();
    } finally {
      playbackStore.pause();
      vi.useRealTimers();
    }
  });

  it("repeats the current step with the r key even when voice is off", () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = false;
    setResult(TWO_GROUPS);
    render(PlaybackBar);
    speak.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", cancelable: true }));
    flushSync();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith({
      text: "Plate 1. Right.",
      langs: EN_LANGS,
      rate: 0.9,
    });
  });

  it("repeats the done phrase with the r key at Done", () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    setResult({ solvable: true, moves: [{ plate: 0, dir: 1 }], statesExplored: 2 });
    playbackStore.next(); // one group → Done
    flushSync();
    render(PlaybackBar);
    speak.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", cancelable: true }));
    flushSync();
    expect(playbackStore.atDone).toBe(true);
    expect(speak).toHaveBeenLastCalledWith({ text: "Lock open", langs: EN_LANGS, rate: 0.9 });
  });

  it("ignores the r key while the bar is inactive", () => {
    const speak = vi.spyOn(speaker, "speak");
    render(PlaybackBar); // no result → inactive
    speak.mockClear();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", cancelable: true }));
    flushSync();
    expect(speak).not.toHaveBeenCalled();
  });

  it("speaks the current step when the Repeat button is clicked", async () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(true);
    const speak = vi.spyOn(speaker, "speak");
    setResult(TWO_GROUPS);
    const screen = render(PlaybackBar);
    speak.mockClear();

    await screen.getByRole("button", { name: "Repeat step" }).click();
    flushSync();
    expect(speak).toHaveBeenLastCalledWith({
      text: "Plate 1. Right.",
      langs: EN_LANGS,
      rate: 0.9,
    });
  });
});
