import { describe, it, expect } from "vitest";
import { createSpeaker, speaker } from "./speech";

// The node project has no speechSynthesis; the module must import cleanly and
// every method must be an inert no-op. Real voice resolution and the
// cancel/speak race are exercised in the chromium component stage.
describe("speech (unsupported environment)", () => {
  it("reports no support without a speech engine", () => {
    expect(speaker.supported).toBe(false);
    expect(createSpeaker().supported).toBe(false);
  });

  it("no-ops without throwing", () => {
    expect(() => speaker.speak({ text: "hi", langs: ["en-US", "en"] })).not.toThrow();
    expect(() => speaker.cancel()).not.toThrow();
    expect(speaker.hasVoiceFor(["en-US", "en"])).toBe(false);
  });

  it("subscribing returns an unsubscribe that is safe to call", () => {
    const unsubscribe = speaker.onVoicesChanged(() => {});
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
