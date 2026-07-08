import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import ConnectionToggle from "./ConnectionToggle.svelte";

describe("ConnectionToggle", () => {
  it("is enabled by default", () => {
    const screen = render(ConnectionToggle, { label: "P1 -> P2", value: 0, onChange: () => {} });
    const btn = screen.container.querySelector<HTMLButtonElement>("button.conn-toggle");
    expect(btn?.disabled).toBe(false);
  });

  it("renders a disabled button when disabled", () => {
    const screen = render(ConnectionToggle, {
      label: "P1 -> P2",
      value: 0,
      onChange: () => {},
      disabled: true,
    });
    const btn = screen.container.querySelector<HTMLButtonElement>("button.conn-toggle");
    expect(btn?.disabled).toBe(true);
  });
});
