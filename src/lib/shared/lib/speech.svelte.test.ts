import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSpeaker, type Speaker } from "./speech";

// Named *.svelte.test.ts so it runs in the browser project: the speaker is
// feature-detected against real window globals, which the node project lacks.
// The engine itself is stubbed — these tests pin the wrapper's scheduling and
// drop-recovery contract, not Chromium's audio behavior.

interface StubUtterance {
  text: string;
  voice: unknown;
  lang: string;
  rate: number;
  onstart: (() => void) | null;
}

const FAKE_VOICE = {
  lang: "en-US",
  localService: true,
  voiceURI: "stub-voice",
  name: "Stub",
  default: true,
} as SpeechSynthesisVoice;

function makeEngine() {
  return {
    spoken: [] as StubUtterance[],
    speaking: false,
    pending: false,
    speak: vi.fn(function (this: void, u: StubUtterance) {
      engine.spoken.push(u);
    }),
    cancel: vi.fn(),
    getVoices: () => [FAKE_VOICE],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

let engine: ReturnType<typeof makeEngine>;
let speaker: Speaker;
let originalSynth: PropertyDescriptor | undefined;
let originalUtterance: typeof SpeechSynthesisUtterance;

class FakeUtterance {
  voice: unknown = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  constructor(public text: string) {}
}

describe("speaker drop-recovery watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    engine = makeEngine();
    originalSynth = Object.getOwnPropertyDescriptor(window, "speechSynthesis");
    originalUtterance = window.SpeechSynthesisUtterance;
    Object.defineProperty(window, "speechSynthesis", {
      value: engine,
      configurable: true,
    });
    window.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    speaker = createSpeaker();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalSynth) Object.defineProperty(window, "speechSynthesis", originalSynth);
    window.SpeechSynthesisUtterance = originalUtterance;
  });

  it("resubmits once when the engine swallows the utterance without 'start'", () => {
    speaker.speak({ text: "Plate 5. Right, 2 times.", langs: ["en-US"] });
    vi.advanceTimersByTime(80); // idle-engine delay
    expect(engine.speak).toHaveBeenCalledTimes(1);

    // No onstart arrives — the documented Chromium drop. Watchdog must reset
    // the queue and hand the same phrase over exactly once more.
    vi.advanceTimersByTime(500);
    expect(engine.cancel).toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(engine.speak).toHaveBeenCalledTimes(2);
    expect(engine.spoken[1].text).toBe("Plate 5. Right, 2 times.");

    // The retry is not watchdogged again — no infinite loop.
    vi.advanceTimersByTime(2000);
    expect(engine.speak).toHaveBeenCalledTimes(2);
  });

  it("stands down when 'start' fires in time", () => {
    speaker.speak({ text: "Plate 1. Right.", langs: ["en-US"] });
    vi.advanceTimersByTime(80);
    engine.spoken[0].onstart?.();

    vi.advanceTimersByTime(2000);
    expect(engine.speak).toHaveBeenCalledTimes(1);
    expect(engine.cancel).not.toHaveBeenCalled(); // idle engine was never disturbed
  });

  it("a superseding speak() makes the old watchdog inert", () => {
    speaker.speak({ text: "old", langs: ["en-US"] });
    vi.advanceTimersByTime(80); // old submitted, watchdog armed
    speaker.speak({ text: "new", langs: ["en-US"] });
    vi.advanceTimersByTime(80); // new submitted
    engine.spoken[1].onstart?.();

    // Old watchdog window elapses: it must not cancel or resubmit anything.
    vi.advanceTimersByTime(2000);
    expect(engine.spoken.map((u) => u.text)).toEqual(["old", "new"]);
  });

  it("interrupting active speech cancels first and waits the longer teardown delay", () => {
    engine.speaking = true;
    speaker.speak({ text: "interrupt", langs: ["en-US"] });
    expect(engine.cancel).toHaveBeenCalledTimes(1); // teardown of the live phrase

    vi.advanceTimersByTime(80);
    expect(engine.speak).not.toHaveBeenCalled(); // busy tier waits longer
    vi.advanceTimersByTime(70);
    expect(engine.speak).toHaveBeenCalledTimes(1);
  });

  it("cancel() disarms both the pending submit and the watchdog", () => {
    speaker.speak({ text: "doomed", langs: ["en-US"] });
    vi.advanceTimersByTime(80); // submitted, watchdog armed
    speaker.cancel();

    vi.advanceTimersByTime(2000);
    expect(engine.speak).toHaveBeenCalledTimes(1); // no retry after cancel
  });
});
