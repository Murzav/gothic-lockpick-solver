import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
import { speaker } from "$lib/shared/lib/speech";
import VoiceSettings from "./VoiceSettings.svelte";
import type { Solution } from "$lib/entities/lock/model/types";

const RATE_STORAGE_KEY = "gls:playback-speech-rate:v1";
// Spying replaces speak wholesale, so headless-chromium voice availability never
// reaches the real engine — assertions pin the request (text + langs + rate).
const EN_LANGS = ["en-US", "en"];

// `speaker.supported` is a plain (readonly-typed) data property, so a narrow cast
// lets a test flip it to exercise the unsupported branch. Captured once and
// restored in afterEach so no test leaks the override.
const REAL_SUPPORTED = speaker.supported;
function setSupported(value: boolean): void {
  (speaker as { supported: boolean }).supported = value;
}

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

describe("VoiceSettings", () => {
  beforeEach(() => {
    lockStore.reset();
    playbackStore.voiceEnabled = false;
    playbackStore.voiceRate = 0.9;
    playbackStore.stepIndex = 0;
    flushSync();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setSupported(REAL_SUPPORTED);
  });

  it("renders no card when speech is unsupported", () => {
    setSupported(false);
    const screen = render(VoiceSettings);
    // No checkbox, no rate buttons — the whole card is absent.
    expect(screen.container.querySelector("input")).toBeNull();
    expect(screen.container.querySelector("button")).toBeNull();
  });

  it("does not speak when enabled with no solve result (guards the Done phrase)", async () => {
    const speak = vi.spyOn(speaker, "speak");
    // No result → grouped is empty, so index 0 === grouped.length. Announcing
    // here would speak "Lock open" before any solve; the active guard forbids it.
    const screen = render(VoiceSettings);

    await screen.getByRole("checkbox", { name: "Speak steps" }).click();
    flushSync();
    expect(playbackStore.voiceEnabled).toBe(true);
    expect(speak).not.toHaveBeenCalled();
  });

  it("speaks the current step at rate 0.9 when enabled with an active result", async () => {
    const speak = vi.spyOn(speaker, "speak");
    setResult(TWO_GROUPS);
    const screen = render(VoiceSettings);

    await screen.getByRole("checkbox", { name: "Speak steps" }).click();
    flushSync();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith({
      text: "Plate 1. Right.",
      langs: EN_LANGS,
      rate: 0.9,
    });
  });

  it("persists the Fast rate and re-speaks the step at 1.1 with voice on", async () => {
    const speak = vi.spyOn(speaker, "speak");
    playbackStore.voiceEnabled = true;
    setResult(TWO_GROUPS);
    const screen = render(VoiceSettings);
    speak.mockClear();

    await screen.getByRole("button", { name: "Fast" }).click();
    flushSync();
    expect(playbackStore.voiceRate).toBe(1.1);
    expect(localStorage.getItem(RATE_STORAGE_KEY)).toBe("1.1");
    expect(speak).toHaveBeenLastCalledWith({
      text: "Plate 1. Right.",
      langs: EN_LANGS,
      rate: 1.1,
    });
  });

  it("shows the no-voice hint when voice is on and no voice matches the language", async () => {
    vi.spyOn(speaker, "hasVoiceFor").mockReturnValue(false);
    playbackStore.voiceEnabled = true;
    flushSync();
    const screen = render(VoiceSettings);

    await expect.element(screen.getByText("No voice for this language")).toBeVisible();
  });
});
