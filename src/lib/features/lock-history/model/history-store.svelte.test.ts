import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { encode } from "$lib/entities/lock/lib/share-codec";
import { historyStore } from "./history-store.svelte";
import type { Solution } from "$lib/entities/lock/model/types";

const STORAGE_KEY = "gls:history:v1";

// A distinct, decodable code per seed. The seed is spread across three plates in
// base 7 (7^3 = 343 combos), so every seed 0..342 is a genuinely different lock —
// a single-plate scheme would alias seeds that share a plate-0 position.
function codeFor(seed: number): string {
  const positions = [
    (seed % 7) + 1,
    (Math.floor(seed / 7) % 7) + 1,
    (Math.floor(seed / 49) % 7) + 1,
    1,
    1,
  ];
  return encode({
    plateCount: 5,
    positions,
    coupling: Array.from({ length: 5 }, () => Array(5).fill(0)),
    convention: "right-increases",
  });
}

// Mirrors the playback-store test helper: assign a result and let the
// auto-record effect (in the store's $effect.root) settle.
function setResult(sol: Solution): void {
  lockStore.result = sol;
  flushSync();
}

describe("historyStore", () => {
  beforeEach(() => {
    lockStore.reset();
    flushSync(); // drain the result→null pass before wiping the list
    historyStore.entries = [];
    localStorage.removeItem(STORAGE_KEY);
    flushSync();
  });

  it("records a lock so it becomes present", () => {
    historyStore.record({ code: codeFor(1), moveCount: 3, solvable: true });

    expect(historyStore.entries).toHaveLength(1);
    expect(historyStore.entries[0]).toMatchObject({
      code: codeFor(1),
      moveCount: 3,
      solvable: true,
      name: null,
      pinned: false,
    });
    expect(typeof historyStore.entries[0].id).toBe("string");
  });

  it("dedupes by code: bump preserves name+pinned, refreshes savedAt, moves to top", () => {
    historyStore.record({ code: codeFor(1), moveCount: 3, solvable: true });
    const id = historyStore.entries[0].id;
    historyStore.rename(id, "Front gate");
    historyStore.togglePin(id);
    historyStore.record({ code: codeFor(2), moveCount: 1, solvable: true });
    // Force the first row's timestamp into the past so the refresh is observable.
    historyStore.entries = historyStore.entries.map((e) =>
      e.id === id ? { ...e, savedAt: "2000-01-01T00:00:00.000Z" } : e,
    );

    // codeFor(1) currently sits below codeFor(2).
    expect(historyStore.entries[0].code).toBe(codeFor(2));

    historyStore.record({ code: codeFor(1), moveCount: 9, solvable: false });

    expect(historyStore.entries).toHaveLength(2);
    const bumped = historyStore.entries[0];
    expect(bumped.id).toBe(id); // same row, not a duplicate
    expect(bumped.code).toBe(codeFor(1));
    expect(bumped.name).toBe("Front gate"); // preserved
    expect(bumped.pinned).toBe(true); // preserved
    expect(bumped.moveCount).toBe(9); // refreshed
    expect(bumped.solvable).toBe(false); // refreshed
    expect(bumped.savedAt > "2000-01-01T00:00:00.000Z").toBe(true); // refreshed
  });

  it("caps unpinned at 20, evicting the oldest, while pinned rows survive", () => {
    // Two pinned locks recorded first (so they are the oldest by savedAt).
    historyStore.record({ code: codeFor(100), moveCount: 1, solvable: true });
    const pinnedIdA = historyStore.entries[0].id;
    historyStore.togglePin(pinnedIdA);
    historyStore.record({ code: codeFor(200), moveCount: 1, solvable: true });
    const pinnedIdB = historyStore.entries[0].id;
    historyStore.togglePin(pinnedIdB);

    // 21 distinct unpinned locks; the first of these is the oldest unpinned.
    const oldestUnpinned = codeFor(0);
    for (let seed = 0; seed < 21; seed++) {
      historyStore.record({ code: codeFor(seed), moveCount: seed, solvable: true });
    }

    const unpinned = historyStore.entries.filter((e) => !e.pinned);
    expect(unpinned).toHaveLength(20); // capped
    expect(unpinned.some((e) => e.code === oldestUnpinned)).toBe(false); // oldest gone
    // Both pins ride out the flood on their own, roomier budget.
    expect(historyStore.entries.some((e) => e.id === pinnedIdA)).toBe(true);
    expect(historyStore.entries.some((e) => e.id === pinnedIdB)).toBe(true);
  });

  it("renames (empty → null), toggles pin, and removes", () => {
    historyStore.record({ code: codeFor(1), moveCount: 3, solvable: true });
    const id = historyStore.entries[0].id;

    historyStore.rename(id, "  Cellar  ");
    expect(historyStore.entries[0].name).toBe("Cellar"); // trimmed

    historyStore.rename(id, "   ");
    expect(historyStore.entries[0].name).toBeNull(); // blank → null

    historyStore.togglePin(id);
    expect(historyStore.entries[0].pinned).toBe(true);
    historyStore.togglePin(id);
    expect(historyStore.entries[0].pinned).toBe(false);

    historyStore.remove(id);
    expect(historyStore.entries).toHaveLength(0);
  });

  it("reads corrupt localStorage as an empty history without throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => historyStore.loadFromStorage()).not.toThrow();
    expect(historyStore.entries).toEqual([]);

    // A well-formed blob from another schema is ignored too.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, entries: [{ id: "x" }] }));
    historyStore.loadFromStorage();
    expect(historyStore.entries).toEqual([]);
  });

  it("drops a type-shaped entry whose savedAt is not a parseable date", () => {
    // Every field passes the typeof checks, but the date is garbage — rendering
    // it through Intl.DateTimeFormat would throw, so the row must be filtered.
    const bad = {
      id: "bad",
      name: null,
      code: codeFor(1),
      savedAt: "not-a-date",
      moveCount: 3,
      solvable: true,
      pinned: false,
    };
    const good = { ...bad, id: "good", savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, entries: [bad, good] }));
    historyStore.loadFromStorage();
    expect(historyStore.entries.map((e) => e.id)).toEqual(["good"]);
  });

  it("auto-records the current lock when a fresh solve result appears", () => {
    lockStore.setPosition(0, 5); // give the lock some content to encode
    flushSync();
    const expectedCode = encode(lockStore.serialize());

    setResult({
      solvable: true,
      moves: [
        { plate: 0, dir: 1 },
        { plate: 0, dir: 1 },
      ],
      statesExplored: 4,
    });

    const entry = historyStore.entries.find((e) => e.code === expectedCode);
    expect(entry).toBeDefined();
    expect(entry?.solvable).toBe(true);
    expect(entry?.moveCount).toBe(2); // RAW move count, not grouped steps
  });
});

describe("historyStore persistence", () => {
  beforeEach(() => {
    lockStore.reset();
    flushSync();
    historyStore.entries = [];
    localStorage.removeItem(STORAGE_KEY);
    flushSync();
  });

  afterEach(() => {
    historyStore.entries = [];
    flushSync();
  });

  it("persists the versioned list under its own key on change", () => {
    historyStore.record({ code: codeFor(1), moveCount: 3, solvable: true });
    flushSync();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      v: number;
      entries: { code: string }[];
    };
    expect(stored.v).toBe(1);
    expect(stored.entries).toHaveLength(1);
    expect(stored.entries[0].code).toBe(codeFor(1));
  });
});
