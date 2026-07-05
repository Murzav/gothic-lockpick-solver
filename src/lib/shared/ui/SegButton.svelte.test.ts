import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import SegButton from "./SegButton.svelte";

describe("SegButton", () => {
  it("renders the label", async () => {
    const screen = render(SegButton, {
      value: 4,
      active: false,
      label: "4",
      onSelect: () => {},
    });

    await expect.element(screen.getByRole("button", { name: "4" })).toBeVisible();
  });

  it("reflects active state via aria-pressed when inactive", async () => {
    const screen = render(SegButton, {
      value: 4,
      active: false,
      label: "4",
      onSelect: () => {},
    });
    await expect
      .element(screen.getByRole("button", { name: "4" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("reflects active state via aria-pressed when active", async () => {
    const screen = render(SegButton, {
      value: 4,
      active: true,
      label: "4",
      onSelect: () => {},
    });
    await expect
      .element(screen.getByRole("button", { name: "4" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect with the button value when clicked", async () => {
    const onSelect = vi.fn();
    const screen = render(SegButton, {
      value: 7,
      active: false,
      label: "7",
      onSelect,
    });

    await screen.getByRole("button", { name: "7" }).click();

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(7);
  });
});
