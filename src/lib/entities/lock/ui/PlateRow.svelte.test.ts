import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import PlateRow from "./PlateRow.svelte";

describe("PlateRow", () => {
  it("renders 7 pin slots as a radiogroup", async () => {
    const screen = render(PlateRow, { index: 0, position: 1, onSelect: () => {} });

    await expect.element(screen.getByRole("radiogroup")).toBeVisible();
    await expect.element(screen.getByRole("radio", { name: "1" })).toBeVisible();
    await expect.element(screen.getByRole("radio", { name: "7" })).toBeVisible();
    expect(screen.getByRole("radio").elements()).toHaveLength(7);
  });

  it("marks slot 4 as the goal", async () => {
    const screen = render(PlateRow, { index: 0, position: 1, onSelect: () => {} });

    await expect
      .element(screen.getByRole("radio", { name: "4" }))
      .toHaveAttribute("data-goal", "true");
  });

  it("marks the active slot with aria-checked", async () => {
    const screen = render(PlateRow, { index: 0, position: 3, onSelect: () => {} });

    await expect
      .element(screen.getByRole("radio", { name: "3" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("radio", { name: "1" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("applies the goal-reached accent when the active slot is the goal", async () => {
    const screen = render(PlateRow, { index: 0, position: 4, onSelect: () => {} });

    await expect
      .element(screen.getByRole("radio", { name: "4" }))
      .toHaveAttribute("data-goal-reached", "true");
  });

  it("calls onSelect with the clicked slot value", async () => {
    const onSelect = vi.fn();
    const screen = render(PlateRow, { index: 2, position: 1, onSelect });

    await screen.getByRole("radio", { name: "5" }).click();

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(5);
  });
});
