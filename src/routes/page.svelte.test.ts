import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
import Page from "./+page.svelte";

describe("+page", () => {
  beforeEach(() => {
    lockStore.reset();
    lockStore.setPlateCount(4);
  });

  it("switching from board to form view keeps entered positions", async () => {
    const screen = render(Page);

    await screen
      .getByRole("radiogroup", { name: "Plate 1" })
      .getByRole("radio", { name: "5" })
      .click();

    expect(lockStore.positions[0]).toBe(5);

    await screen.getByRole("radio", { name: "Table" }).click();

    await expect
      .element(
        screen
          .getByRole("group", { name: "Position of plate 1" })
          .getByRole("button", { name: "5" }),
      )
      .toHaveAttribute("aria-pressed", "true");
  });

  it('clicking "Solve" renders a result panel', async () => {
    const screen = render(Page);

    await screen.getByRole("button", { name: "Solve" }).click();

    await expect.element(screen.getByText("Result")).toBeVisible();
  });

  it("offers plate counts 4–7 (never 3) from a shared control in board view", async () => {
    const screen = render(Page);
    const group = screen.getByRole("group", { name: "Plates" });

    expect(group.getByRole("button", { name: "3" }).elements()).toHaveLength(0);
    for (const n of [4, 5, 6, 7]) {
      await expect.element(group.getByRole("button", { name: String(n) })).toBeVisible();
    }
  });

  it("changing the plate count from the shared control updates the store", async () => {
    const screen = render(Page);

    await screen.getByRole("group", { name: "Plates" }).getByRole("button", { name: "6" }).click();

    expect(lockStore.plateCount).toBe(6);
    expect(lockStore.positions).toHaveLength(6);
  });

  it('"Reset" restores the default lock', async () => {
    const screen = render(Page);
    lockStore.setPlateCount(7);
    lockStore.setPosition(0, 5);

    await screen.getByRole("button", { name: "Reset" }).click();

    expect(lockStore.plateCount).toBe(5);
    expect(lockStore.positions).toEqual([1, 1, 1, 1, 1]);
  });

  // The keyboard contract: board entry and playback own disjoint keys, so with
  // the playback bar up and a plate focused, ArrowRight drives the transport
  // while a bare digit still edits the lock (which then hides the bar).
  it("board entry and playback own disjoint keys", async () => {
    const screen = render(Page);
    lockStore.setViewMode("board"); // a prior test may have left form view active
    playbackStore.pause();
    playbackStore.followBoard = false; // edit the lock while the bar is visible
    lockStore.result = {
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 0, dir: 1 },
      ],
      statesExplored: 2,
    };
    flushSync();

    await expect.element(screen.getByRole("button", { name: "Next →" })).toBeVisible();

    const block = screen.container.querySelector<HTMLElement>(".plate-block");
    expect(block).not.toBeNull();
    block?.focus();

    // ArrowRight belongs to playback: the board ignores it, the transport advances.
    block?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    expect(playbackStore.stepIndex).toBe(1);

    // A bare digit belongs to entry: it edits the lock, invalidating the result
    // and hiding the bar.
    block?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "5",
        code: "Digit5",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    expect(lockStore.positions[0]).toBe(5);
    expect(lockStore.result).toBeNull();
    expect(screen.container.querySelector(".bar")).toBeNull();
  });
});
