import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import PinSlot from "./PinSlot.svelte";

describe("PinSlot", () => {
  it("renders an enabled button by default", () => {
    const screen = render(PinSlot, { value: 3, active: false, isGoal: false, onSelect: () => {} });
    const btn = screen.container.querySelector<HTMLButtonElement>("button.pin-slot");
    expect(btn?.disabled).toBe(false);
  });

  it("renders a disabled button when disabled", () => {
    const screen = render(PinSlot, {
      value: 3,
      active: false,
      isGoal: false,
      onSelect: () => {},
      disabled: true,
    });
    const btn = screen.container.querySelector<HTMLButtonElement>("button.pin-slot");
    expect(btn?.disabled).toBe(true);
  });

  it("marks the active slot with the active class", () => {
    const screen = render(PinSlot, { value: 3, active: true, isGoal: false, onSelect: () => {} });
    expect(screen.container.querySelector(".pin-slot.active")).not.toBeNull();
  });
});
