import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import DpadIcon from "./DpadIcon.svelte";

describe("DpadIcon", () => {
  it("renders an aria-hidden svg at the default size", () => {
    const screen = render(DpadIcon, { direction: "right" });
    const svg = screen.container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("honours the size prop", () => {
    const screen = render(DpadIcon, { direction: "right", size: 40 });
    const svg = screen.container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("40");
  });

  it("does not mirror the active arm for the right direction", () => {
    const screen = render(DpadIcon, { direction: "right" });
    const arm = screen.container.querySelector(".dpad-arm");
    expect(arm?.getAttribute("transform")).toBeNull();
  });

  it("mirrors the active arm for the left direction", () => {
    const screen = render(DpadIcon, { direction: "left" });
    const arm = screen.container.querySelector(".dpad-arm");
    expect(arm?.getAttribute("transform")).toContain("scale(-1");
  });
});
