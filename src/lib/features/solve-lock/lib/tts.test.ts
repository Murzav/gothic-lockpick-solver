import { describe, it, expect } from "vitest";
import { speechLangs, stepPhrase, donePhrase } from "./tts";
import type { GroupedMove } from "$lib/entities/lock/model/types";

describe("speechLangs", () => {
  it("spot-checks the deliberate fallback chains", () => {
    expect(speechLangs("es-419")).toEqual(["es-MX", "es-US", "es", "es-ES"]);
    expect(speechLangs("sk")).toEqual(["sk-SK", "sk", "cs-CZ", "cs"]);
    expect(speechLangs("ca-ES-valencia")).toEqual(["ca-ES", "ca"]);
    expect(speechLangs("zh")).toEqual(["zh-CN", "zh"]);
    expect(speechLangs("en")).toEqual(["en-US", "en"]);
  });

  it("unknown locale tries the tag itself", () => {
    expect(speechLangs("xx-YY")).toEqual(["xx-YY"]);
  });
});

// getLocale() resolves to the base locale "en" in the node project, so these
// assertions read against English terminology.
describe("stepPhrase (en default locale)", () => {
  const base: GroupedMove = { plate: 5, dir: 1, count: 3, startIndex: 0 };

  it("assembles plate, direction and count with pausing punctuation", () => {
    expect(stepPhrase(base, "right-increases")).toBe("Plate 6. Right, 3 times.");
  });

  it("omits the count when it is 1", () => {
    expect(stepPhrase({ ...base, count: 1 }, "right-increases")).toBe("Plate 6. Right.");
  });

  it("respects the direction convention", () => {
    expect(stepPhrase({ ...base, count: 1 }, "right-decreases")).toBe("Plate 6. Left.");
  });

  it("emits no ×/→/x symbols", () => {
    const phrase = stepPhrase(base, "right-increases");
    expect(phrase).not.toMatch(/[×→x]/);
  });
});

describe("donePhrase", () => {
  it("matches the UI Done label", () => {
    expect(donePhrase()).toBe("Lock open");
  });
});
