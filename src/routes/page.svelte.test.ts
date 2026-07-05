import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
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
});
