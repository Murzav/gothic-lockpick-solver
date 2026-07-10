import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { encode } from "$lib/entities/lock/lib/share-codec";
import { historyStore, type HistoryEntry } from "../model/history-store.svelte";
import HistorySection from "./HistorySection.svelte";

const STORAGE_KEY = "gls:history:v1";

function codeFor(seed: number): string {
  return encode({
    plateCount: 5,
    positions: [(seed % 7) + 1, 1, 1, 1, 1],
    coupling: Array.from({ length: 5 }, () => Array(5).fill(0)),
    convention: "right-increases",
  });
}

function makeEntry(o: Partial<HistoryEntry> & { id: string }): HistoryEntry {
  return {
    id: o.id,
    name: o.name ?? null,
    code: o.code ?? codeFor(o.id.charCodeAt(0)),
    savedAt: o.savedAt ?? "2023-01-01T00:00:00.000Z",
    moveCount: o.moveCount ?? 3,
    solvable: o.solvable ?? true,
    pinned: o.pinned ?? false,
  };
}

// A real <details> hides its body until open; expand it so playwright can act on
// the rows. Clicking the summary runs the native toggle synchronously.
function openDetails(container: HTMLElement): void {
  container.querySelector("summary")!.click();
  flushSync();
}

describe("HistorySection", () => {
  beforeEach(() => {
    historyStore.entries = [];
    localStorage.removeItem(STORAGE_KEY);
    flushSync();
  });

  afterEach(() => {
    historyStore.entries = [];
    flushSync();
  });

  it("renders rows pinned-first, regardless of save time", () => {
    historyStore.entries = [
      makeEntry({ id: "a", name: "Alpha", pinned: false, savedAt: "2023-06-02T00:00:00.000Z" }),
      makeEntry({ id: "b", name: "Bravo", pinned: true, savedAt: "2023-06-01T00:00:00.000Z" }),
    ];
    flushSync();
    const screen = render(HistorySection, { onrestore: vi.fn() });

    const titles = Array.from(screen.container.querySelectorAll(".hist-title")).map(
      (el) => el.textContent,
    );
    // Bravo is pinned so it leads even though Alpha was saved later.
    expect(titles).toEqual(["Bravo", "Alpha"]);
  });

  it("restores by handing the entry's code to the onrestore callback", async () => {
    const onrestore = vi.fn();
    const code = codeFor(4);
    historyStore.entries = [makeEntry({ id: "a", name: "Alpha", code })];
    flushSync();
    const screen = render(HistorySection, { onrestore });
    openDetails(screen.container);

    await screen.getByRole("button", { name: "Restore this lock" }).click();

    expect(onrestore).toHaveBeenCalledWith(code);
  });

  it("saves a rename on Enter", async () => {
    historyStore.entries = [makeEntry({ id: "a", name: "Alpha" })];
    flushSync();
    const screen = render(HistorySection, { onrestore: vi.fn() });
    openDetails(screen.container);

    await screen.getByRole("button", { name: "Rename" }).click();
    const input = screen.getByPlaceholder("Name this lock");
    await input.fill("Cellar door");
    flushSync();
    input.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    flushSync();

    expect(historyStore.entries[0].name).toBe("Cellar door");
  });

  it("discards a rename on Escape", async () => {
    historyStore.entries = [makeEntry({ id: "a", name: "Alpha" })];
    flushSync();
    const screen = render(HistorySection, { onrestore: vi.fn() });
    openDetails(screen.container);

    await screen.getByRole("button", { name: "Rename" }).click();
    const input = screen.getByPlaceholder("Name this lock");
    await input.fill("Discard me");
    flushSync();
    input.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();

    expect(historyStore.entries[0].name).toBe("Alpha"); // unchanged
  });

  it("removes a lock only on the second (confirming) delete tap", async () => {
    historyStore.entries = [makeEntry({ id: "a", name: "Alpha" })];
    flushSync();
    const screen = render(HistorySection, { onrestore: vi.fn() });
    openDetails(screen.container);

    await screen.getByRole("button", { name: "Remove" }).click();
    expect(historyStore.entries).toHaveLength(1); // first tap only arms

    await screen.getByRole("button", { name: "Remove?" }).click();
    flushSync();
    expect(historyStore.entries).toHaveLength(0); // second tap commits
  });

  it("toggles a pin and persists it to storage", async () => {
    historyStore.entries = [makeEntry({ id: "a", name: "Alpha", pinned: false })];
    flushSync();
    const screen = render(HistorySection, { onrestore: vi.fn() });
    openDetails(screen.container);

    await screen.getByRole("button", { name: "Keep" }).click();
    flushSync();

    expect(historyStore.entries[0].pinned).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      entries: { id: string; pinned: boolean }[];
    };
    expect(stored.entries.find((e) => e.id === "a")?.pinned).toBe(true);
  });
});
