import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
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

// Enter follow mode at the Done step so the board shows a fully-applied
// solution: plate 1 moves 1 -> 3 while the store's positions stay at 1.
function enterFollow(): void {
  lockStore.result = {
    solvable: true,
    moves: [
      { plate: 0, dir: 1 },
      { plate: 0, dir: 1 },
    ],
    statesExplored: 3,
  };
  flushSync(); // stepIndex -> 0
  playbackStore.followBoard = true;
  playbackStore.next(); // single group -> stepIndex 1 = Done -> [3,1,1,1,1]
  flushSync();
}

describe("LockBoard follow mode", () => {
  beforeEach(() => {
    lockStore.reset();
    playbackStore.stepIndex = 0;
    playbackStore.followBoard = true;
    flushSync();
  });

  it("shows playback positions and disables all controls while following", async () => {
    enterFollow();
    const screen = render(LockBoard);

    await expect.element(screen.getByText("· 3")).toBeVisible();
    expect(lockStore.positions[0]).toBe(1); // store untouched by the replay

    const pins = screen.container.querySelectorAll<HTMLButtonElement>("button.pin-slot");
    expect(pins.length).toBeGreaterThan(0);
    expect([...pins].every((b) => b.disabled)).toBe(true);

    const conns = screen.container.querySelectorAll<HTMLButtonElement>("button.conn-toggle");
    expect(conns.length).toBeGreaterThan(0);
    expect([...conns].every((b) => b.disabled)).toBe(true);
  });

  it("unlocks the board via the banner edit link", async () => {
    enterFollow();
    const screen = render(LockBoard);

    await screen.getByRole("button", { name: "Edit lock" }).click();

    expect(playbackStore.followBoard).toBe(false);
    expect(screen.container.querySelector(".follow-banner")).toBeNull();
    await expect.element(screen.getByText("· 1").first()).toBeVisible(); // live positions again

    const pins = screen.container.querySelectorAll<HTMLButtonElement>("button.pin-slot");
    expect([...pins].every((b) => !b.disabled)).toBe(true);
  });
});
