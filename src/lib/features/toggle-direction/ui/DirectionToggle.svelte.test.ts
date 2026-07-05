import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import DirectionToggle from "./DirectionToggle.svelte";

describe("DirectionToggle", () => {
  beforeEach(() => {
    lockStore.reset();
  });

  it("renders both convention options", async () => {
    const screen = render(DirectionToggle);

    await expect
      .element(screen.getByRole("radio", { name: "Right = number goes up" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("radio", { name: "Right = number goes down" }))
      .toBeVisible();
  });

  it("reflects the active convention", async () => {
    lockStore.setConvention("right-increases");
    const screen = render(DirectionToggle);

    await expect
      .element(screen.getByRole("radio", { name: "Right = number goes up" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("radio", { name: "Right = number goes down" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("calls setConvention and clears a stale result when switching", async () => {
    lockStore.setConvention("right-increases");
    lockStore.result = { solvable: true, moves: [], statesExplored: 1 };
    const screen = render(DirectionToggle);

    await screen.getByRole("radio", { name: "Right = number goes down" }).click();

    expect(lockStore.convention).toBe("right-decreases");
    expect(lockStore.result).toBeNull();
  });
});
