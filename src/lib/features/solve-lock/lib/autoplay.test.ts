import { describe, expect, it } from "vitest";
import { AUTOPLAY, computeAutoplayDwell } from "./autoplay";

describe("computeAutoplayDwell", () => {
  it("adds one press-time per extra press (count scaling)", () => {
    const one = computeAutoplayDwell(1, { speaking: false, voiceRate: 0.9 });
    const two = computeAutoplayDwell(2, { speaking: false, voiceRate: 0.9 });
    const three = computeAutoplayDwell(3, { speaking: false, voiceRate: 0.9 });
    expect(two - one).toBe(AUTOPLAY.PER_PRESS_MS);
    expect(three - two).toBe(AUTOPLAY.PER_PRESS_MS);
  });

  it("scales the speech estimate inversely with voiceRate (slower voice waits longer)", () => {
    const slow = computeAutoplayDwell(1, { speaking: true, voiceRate: 0.75 });
    const normal = computeAutoplayDwell(1, { speaking: true, voiceRate: 0.9 });
    const fast = computeAutoplayDwell(1, { speaking: true, voiceRate: 1.1 });
    expect(slow).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(fast);
    // Exact: only the SPEECH_BASE term is rate-dependent.
    expect(slow).toBe(AUTOPLAY.SPEECH_BASE_MS / 0.75 + AUTOPLAY.PER_PRESS_MS + AUTOPLAY.SLACK_MS);
    expect(fast).toBe(AUTOPLAY.SPEECH_BASE_MS / 1.1 + AUTOPLAY.PER_PRESS_MS + AUTOPLAY.SLACK_MS);
  });

  it("uses the speech branch when speaking and the silent-read branch otherwise", () => {
    const speaking = computeAutoplayDwell(1, { speaking: true, voiceRate: 0.9 });
    const silent = computeAutoplayDwell(1, { speaking: false, voiceRate: 0.9 });
    // Same count and slack, so the only difference is the read term.
    expect(speaking - silent).toBe(AUTOPLAY.SPEECH_BASE_MS / 0.9 - AUTOPLAY.SILENT_READ_MS);
    expect(silent).toBe(AUTOPLAY.SILENT_READ_MS + AUTOPLAY.PER_PRESS_MS + AUTOPLAY.SLACK_MS);
  });

  it("never dips below the MIN_DWELL_MS floor", () => {
    // The floor is a safety net for future tuning; assert it always holds, even
    // for the smallest realistic input.
    const dwells = [
      computeAutoplayDwell(1, { speaking: false, voiceRate: 1.1 }),
      computeAutoplayDwell(1, { speaking: true, voiceRate: 1.1 }),
      computeAutoplayDwell(5, { speaking: true, voiceRate: 0.75 }),
    ];
    for (const dwell of dwells) {
      expect(dwell).toBeGreaterThanOrEqual(AUTOPLAY.MIN_DWELL_MS);
    }
  });
});
