import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
import { solveCurrentLock } from "$lib/features/solve-lock/model/solve-current-lock";
import LockBoard from "./LockBoard.svelte";

// Browser mode cannot redefine a live ES-module export (vi.spyOn throws), so the
// whole solve module is mocked; Enter's only observable effect is this call.
vi.mock("$lib/features/solve-lock/model/solve-current-lock", () => ({
  solveCurrentLock: vi.fn(() => Promise.resolve()),
}));

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

// A plate-block is the roving keyboard stop; the accelerator listens on the
// board wrapper, so events must bubble and be cancelable to observe both the
// mutation and preventDefault.
function block(screen: ReturnType<typeof render>, i: number): HTMLElement {
  return screen.container.querySelectorAll<HTMLElement>(".plate-block")[i];
}

function press(el: Element, init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  el.dispatchEvent(e);
  flushSync();
  return e;
}

describe("LockBoard keyboard entry", () => {
  beforeEach(() => {
    lockStore.reset();
    lockStore.setPlateCount(4);
    playbackStore.followBoard = false;
    playbackStore.stepIndex = 0;
    vi.clearAllMocks();
    flushSync();
  });

  it("sets the focused plate's position from a Digit and a Numpad code", async () => {
    const screen = render(LockBoard);

    press(block(screen, 0), { key: "3", code: "Digit3" });
    expect(lockStore.positions[0]).toBe(3);

    press(block(screen, 0), { key: "5", code: "Numpad5" });
    expect(lockStore.positions[0]).toBe(5);
  });

  it("Shift+digit cycles the coupling none → same → opposite (nextCoupling order)", async () => {
    const screen = render(LockBoard);

    press(block(screen, 0), { key: "2", code: "Digit2", shiftKey: true });
    expect(lockStore.coupling[0][1]).toBe(1); // same

    press(block(screen, 0), { key: "2", code: "Digit2", shiftKey: true });
    expect(lockStore.coupling[0][1]).toBe(-1); // opposite

    press(block(screen, 0), { key: "2", code: "Digit2", shiftKey: true });
    expect(lockStore.coupling[0][1]).toBe(0); // none
  });

  it("Shift+digit of the focused plate itself is a no-op (the ⊙ self cell)", async () => {
    const screen = render(LockBoard);

    press(block(screen, 0), { key: "1", code: "Digit1", shiftKey: true });
    expect(lockStore.coupling[0][0]).toBe(0);
  });

  it("Arrow keys move the roving cursor and clamp at both ends", async () => {
    const screen = render(LockBoard);

    // ArrowUp at the top stays on plate 1 (no wrap).
    press(block(screen, 0), { key: "ArrowUp", code: "ArrowUp" });
    expect(block(screen, 0).tabIndex).toBe(0);

    // ArrowDown moves the cursor: the next digit lands on plate 2.
    press(block(screen, 0), { key: "ArrowDown", code: "ArrowDown" });
    expect(block(screen, 1).tabIndex).toBe(0);
    press(block(screen, 1), { key: "5", code: "Digit5" });
    expect(lockStore.positions[1]).toBe(5);

    // ArrowDown past the last plate clamps to plate 4 (no wrap).
    press(block(screen, 1), { key: "ArrowDown", code: "ArrowDown" });
    press(block(screen, 2), { key: "ArrowDown", code: "ArrowDown" });
    press(block(screen, 3), { key: "ArrowDown", code: "ArrowDown" });
    expect(block(screen, 3).tabIndex).toBe(0);
  });

  it("Enter solves once, and never while a solve is already running", async () => {
    const solve = vi.mocked(solveCurrentLock);
    const screen = render(LockBoard);

    press(block(screen, 0), { key: "Enter", code: "Enter" });
    expect(solve).toHaveBeenCalledTimes(1);

    lockStore.solving = true;
    press(block(screen, 0), { key: "Enter", code: "Enter" });
    expect(solve).toHaveBeenCalledTimes(1); // no second solve stacked
    lockStore.solving = false;
  });

  it("ignores digits with Ctrl or Meta held, and while following a solution", async () => {
    const screen = render(LockBoard);

    press(block(screen, 0), { key: "3", code: "Digit3", ctrlKey: true });
    press(block(screen, 0), { key: "3", code: "Digit3", metaKey: true });
    expect(lockStore.positions[0]).toBe(1); // untouched

    // Follow mode makes the board read-only; a digit must not mutate the lock.
    enterFollow();
    press(block(screen, 0), { key: "3", code: "Digit3" });
    expect(lockStore.positions[0]).toBe(1);
  });

  it("calls preventDefault on the arrows and digits it handles", async () => {
    const screen = render(LockBoard);

    expect(press(block(screen, 0), { key: "ArrowDown", code: "ArrowDown" }).defaultPrevented).toBe(
      true,
    );
    expect(press(block(screen, 1), { key: "4", code: "Digit4" }).defaultPrevented).toBe(true);
  });

  it("announces each edit in the live region", async () => {
    const screen = render(LockBoard);
    const live = () => screen.container.querySelector(".sr-only")?.textContent;

    press(block(screen, 0), { key: "3", code: "Digit3" });
    expect(live()).toBe("Plate 1, position 3");

    press(block(screen, 0), { key: "2", code: "Digit2", shiftKey: true });
    expect(live()).toBe("Plate 1 to plate 2: same direction");
  });

  it("keeps exactly one plate in the tab order (roving tabindex)", async () => {
    const screen = render(LockBoard);

    expect(block(screen, 0).tabIndex).toBe(0);
    for (const i of [1, 2, 3]) expect(block(screen, i).tabIndex).toBe(-1);
  });

  it("does NOT solve when Enter fires from inside an inner pin button", async () => {
    const solve = vi.mocked(solveCurrentLock);
    const screen = render(LockBoard);

    const pin = screen.container.querySelector<HTMLButtonElement>("button.pin-slot");
    expect(pin).not.toBeNull();
    press(pin as HTMLButtonElement, { key: "Enter", code: "Enter" });

    expect(solve).not.toHaveBeenCalled();
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
