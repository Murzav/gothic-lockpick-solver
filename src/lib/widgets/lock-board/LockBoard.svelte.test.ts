import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import LockBoard from "./LockBoard.svelte";

describe("LockBoard", () => {
  beforeEach(() => {
    lockStore.reset();
    lockStore.setPlateCount(4);
  });

  it("renders one plate row per plate", async () => {
    const screen = render(LockBoard);

    expect(screen.getByRole("radiogroup").elements()).toHaveLength(4);
    await expect.element(screen.getByRole("radiogroup", { name: "Plate 1" })).toBeVisible();
    await expect.element(screen.getByRole("radiogroup", { name: "Plate 4" })).toBeVisible();
  });

  it("clicking a slot updates lockStore.positions", async () => {
    const screen = render(LockBoard);

    await screen
      .getByRole("radiogroup", { name: "Plate 1" })
      .getByRole("radio", { name: "5" })
      .click();

    expect(lockStore.positions[0]).toBe(5);
  });

  it("setting a connection updates lockStore.coupling", async () => {
    const screen = render(LockBoard);

    // One click cycles the toggle none → same (+1).
    await screen.getByRole("button", { name: /Plate 1 → plate 2/ }).click();

    expect(lockStore.coupling[0][1]).toBe(1);
  });

  it("does not offer a self-connection for a plate", async () => {
    const screen = render(LockBoard);

    expect(screen.getByRole("group", { name: "Plate 1 → plate 1" }).elements()).toHaveLength(0);
  });
});
