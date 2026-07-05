import { render } from "vitest-browser-svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import ResultPanel from "./ResultPanel.svelte";

describe("ResultPanel", () => {
  beforeEach(() => {
    lockStore.reset();
  });

  it("renders a grouped move list item per grouped move", async () => {
    lockStore.result = {
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 0, dir: 1 },
        { plate: 1, dir: -1 },
      ],
      statesExplored: 12,
    };
    const screen = render(ResultPanel);

    const items = screen.getByRole("listitem");
    await expect.element(items.first()).toBeVisible();
    expect(items.elements()).toHaveLength(2);
    await expect.element(screen.getByText("Plate 1 → right ×2")).toBeVisible();
    await expect.element(screen.getByText("Plate 2 → left")).toBeVisible();
  });

  it("renders an already-open note when the solution has zero moves", async () => {
    lockStore.result = { solvable: true, moves: [], statesExplored: 1 };
    const screen = render(ResultPanel);

    await expect.element(screen.getByText(/already open/i)).toBeVisible();
  });

  it("renders the corrected Master-perk copy for an unsolvable lock, without framing it as a plain bug", async () => {
    lockStore.result = { solvable: false, moves: null, statesExplored: 340 };
    const screen = render(ResultPanel);

    const body = screen.container.textContent ?? "";
    expect(body).not.toMatch(/\bbug\b/i);
    expect(body).toMatch(/shortcut/i);
  });
});
