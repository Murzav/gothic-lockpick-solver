import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import LockForm from "./LockForm.svelte";

describe("LockForm", () => {
  beforeEach(() => {
    lockStore.reset();
    lockStore.setPlateCount(4);
  });

  it("labels each connection with its target plate", async () => {
    const screen = render(LockForm);

    // moving plate 1 right affects plates 2..4 — each labelled by target
    for (const n of [2, 3, 4]) {
      await expect.element(screen.getByText(`P${n}`, { exact: true }).first()).toBeVisible();
    }
  });

  it("renders one position selector per plate", async () => {
    const screen = render(LockForm);

    expect(screen.getByRole("group", { name: /^Position of plate/ }).elements()).toHaveLength(4);
    await expect.element(screen.getByRole("group", { name: "Position of plate 1" })).toBeVisible();
    await expect.element(screen.getByRole("group", { name: "Position of plate 4" })).toBeVisible();
  });

  it("clicking a position chip updates lockStore.positions", async () => {
    const screen = render(LockForm);

    await screen
      .getByRole("group", { name: "Position of plate 1" })
      .getByRole("button", { name: "5" })
      .click();

    expect(lockStore.positions[0]).toBe(5);
  });

  it("clicking a connection chip updates lockStore.coupling", async () => {
    const screen = render(LockForm);

    await screen
      .getByRole("group", { name: "Plate 1 → plate 2" })
      .getByRole("button", { name: "»" })
      .click();

    expect(lockStore.coupling[0][1]).toBe(1);
  });

  it("does not offer a self-connection for a plate", async () => {
    const screen = render(LockForm);

    expect(screen.getByRole("group", { name: "Plate 1 → plate 1" }).elements()).toHaveLength(0);
  });
});
