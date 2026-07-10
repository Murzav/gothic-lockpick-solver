import { browser } from "$app/environment";
import { untrack } from "svelte";
import { encode } from "$lib/entities/lock/lib/share-codec";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";

const STORAGE_KEY = "gls:history:v1";
const SCHEMA_VERSION = 1;
/** Two caps, not one: a pin is a promise to keep, so pinned locks get their own
 * roomier budget and are never crowded out by a burst of casual solves. */
const UNPINNED_CAP = 20;
const PINNED_CAP = 50;

/**
 * One saved lock. `code` (the share-codec string) is the identity: the same lock
 * always encodes to the same code, so re-solving it bumps the existing row
 * instead of piling up duplicates. `solvable` is nullable because
 * `snapshotCurrent` can file a lock that was never solved (null = unknown), and
 * `moveCount` is the RAW move count — the grouped "N steps" figure lives in
 * solve-lock and importing it here would break the feature-slice boundary.
 */
export interface HistoryEntry {
  id: string;
  name: string | null;
  code: string;
  savedAt: string;
  moveCount: number | null;
  solvable: boolean | null;
  pinned: boolean;
}

/** The fresh-solve/snapshot payload; identity and bookkeeping fields are the
 * store's own to assign, so callers only supply what a lock actually is. */
interface RecordInput {
  code: string;
  moveCount: number | null;
  solvable: boolean | null;
}

/** A stored row we trust enough to render. A single malformed entry is dropped
 * rather than nuking the whole history, so one bad write never costs the rest. */
function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    (e.name === null || typeof e.name === "string") &&
    typeof e.code === "string" &&
    // A parseable date, not just any string: the UI feeds savedAt to
    // Intl.DateTimeFormat, which throws a RangeError on an Invalid Date — one
    // garbage row must not crash the whole section.
    typeof e.savedAt === "string" &&
    !Number.isNaN(Date.parse(e.savedAt)) &&
    (e.moveCount === null || typeof e.moveCount === "number") &&
    (e.solvable === null || typeof e.solvable === "boolean") &&
    typeof e.pinned === "boolean"
  );
}

/**
 * The list of saved locks, persisted under "gls:history:v1". `entries` is held
 * newest-record-first (record always moves a lock to the front and stamps it
 * `savedAt = now`), so the array order is itself a valid recency order — which
 * is why eviction can trust it and `ordered` only has to lift pins to the top.
 */
class HistoryStore {
  entries = $state<HistoryEntry[]>([]);

  /** Display order: pinned first, then most-recently-saved. Kept separate from
   * the storage order so pinning never reshuffles the recency the caps rely on. */
  ordered = $derived(
    this.entries.toSorted((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.savedAt.localeCompare(a.savedAt);
    }),
  );

  /**
   * File a solved (or snapshotted) lock. Re-recording a known code refreshes its
   * stats and floats it to the top but keeps the visitor's name and pin — those
   * are their labels, not the solver's, and a re-solve must not wipe them.
   */
  record(input: RecordInput): void {
    const now = new Date().toISOString();
    const index = this.entries.findIndex((e) => e.code === input.code);
    if (index >= 0) {
      const existing = this.entries[index];
      const updated: HistoryEntry = {
        ...existing,
        savedAt: now,
        moveCount: input.moveCount,
        solvable: input.solvable,
      };
      this.entries = [updated, ...this.entries.slice(0, index), ...this.entries.slice(index + 1)];
    } else {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        name: null,
        code: input.code,
        savedAt: now,
        moveCount: input.moveCount,
        solvable: input.solvable,
        pinned: false,
      };
      this.entries = [entry, ...this.entries];
    }
    this.evict();
  }

  /**
   * Snapshot the lock currently on the board, solve or no solve. The route glue
   * calls this before an imported link overwrites the board so in-progress work
   * is never silently lost; stats come from the live result when one exists,
   * else null (this lock was never run).
   */
  snapshotCurrent(): void {
    const result = lockStore.result;
    this.record({
      code: encode(lockStore.serialize()),
      moveCount: result?.moves?.length ?? null,
      solvable: result?.solvable ?? null,
    });
  }

  /** Empty name → null so the row falls back to its meta as a title; an
   * all-whitespace name is treated as empty too. */
  rename(id: string, name: string): void {
    const next = name.trim() || null;
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, name: next } : e));
  }

  // The pinned cap is deliberately NOT enforced here: evicting some other
  // pinned entry the moment a user pins one more would silently destroy
  // something they explicitly kept. The soft cap self-heals on the next
  // record(), and fifty pinned locks is beyond anything the game contains.
  togglePin(id: string): void {
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e));
  }

  remove(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  /** Load once at module init; any corruption or schema mismatch resets to an
   * empty history rather than throwing on the first render. */
  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        (parsed as { v?: unknown }).v !== SCHEMA_VERSION ||
        !Array.isArray((parsed as { entries?: unknown }).entries)
      ) {
        return;
      }
      this.entries = (parsed as { entries: unknown[] }).entries.filter(isHistoryEntry);
    } catch {
      this.entries = [];
    }
  }

  /** Enforce the two caps after every record. Survivors keep their storage
   * order, so recency is untouched — only the oldest overflow rows are dropped. */
  private evict(): void {
    const pinned = this.entries.filter((e) => e.pinned);
    const unpinned = this.entries.filter((e) => !e.pinned);
    if (pinned.length <= PINNED_CAP && unpinned.length <= UNPINNED_CAP) return; // nothing overflowed
    const survivors = new Set<string>();
    for (const kept of this.keepNewest(pinned, PINNED_CAP)) survivors.add(kept.id);
    for (const kept of this.keepNewest(unpinned, UNPINNED_CAP)) survivors.add(kept.id);
    this.entries = this.entries.filter((e) => survivors.has(e.id));
  }

  /** The `cap` newest rows of a group. Stable sort over an already-recency-ordered
   * list means same-instant saves fall back to storage order, so eviction stays
   * deterministic even when several locks share a savedAt millisecond. */
  private keepNewest(list: HistoryEntry[], cap: number): HistoryEntry[] {
    if (list.length <= cap) return list;
    return list.toSorted((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, cap);
  }
}

export const historyStore = new HistoryStore();

// Client-only wiring, mirroring the persistence pattern in
// playback-store.svelte.ts:187-246. localStorage does not exist during prerender.
if (browser) {
  historyStore.loadFromStorage();

  $effect.root(() => {
    // Persist the whole list on any change, versioned so a future schema can
    // reject old blobs in loadFromStorage.
    $effect(() => {
      const snapshot = JSON.stringify({
        v: SCHEMA_VERSION,
        entries: $state.snapshot(historyStore.entries),
      });
      try {
        localStorage.setItem(STORAGE_KEY, snapshot);
      } catch {
        // storage may be unavailable (private mode); ignore
      }
    });

    // Auto-record every fresh solve. Reading lockStore.result is an entity
    // import (legal); the recording itself is untracked so this effect fires
    // only when a NEW result lands, never because writing our own entries looked
    // like a dependency. The config read here is the exact lock that was solved
    // (an edit would have nulled the result first).
    $effect(() => {
      const result = lockStore.result;
      if (!result) return;
      untrack(() => {
        historyStore.record({
          code: encode(lockStore.serialize()),
          moveCount: result.moves?.length ?? null,
          solvable: result.solvable,
        });
      });
    });
  });
}
