import { browser } from "$app/environment";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "./playback-store.svelte";
import type { Solution } from "$lib/entities/lock/model/types";

const ENDPOINT = "/api/cracked";

/**
 * The global "locks cracked with this tool" vanity total. A GET on mount
 * hydrates it; reaching the Done step of a playback POSTs one increment and
 * folds the fresh total back in. Offline/adblock is silently tolerated — the
 * total simply stays null (nothing rendered) or unchanged.
 */
class CrackCounter {
  total = $state<number | null>(null);

  /** Fetch the current total once. Browser-only; caller owns the "once per
   * page load" cadence (the footer component calls this on mount). */
  refresh(): void {
    if (!browser) return;
    void fetch(ENDPOINT)
      .then((res) => res.json() as Promise<{ n: number | null }>)
      .then((data) => this.apply(data.n))
      .catch(() => {
        // offline / blocked: keep whatever we have (null → render nothing)
      });
  }

  /** Fold a server-reported total in, ignoring the null the server sends when
   * D1 is unavailable so a transient failure never blanks an existing number. */
  apply(n: number | null): void {
    if (typeof n === "number") this.total = n;
  }
}

export const crackCounter = new CrackCounter();

// Non-reactive one-shot guards, read/written only inside the effect below.
// `countedResult` is the exact `lockStore.result` reference we have already
// counted a crack for: stepping back and forth over Done keeps that reference,
// so it dedupes re-entry within one solve. `prevDone` gates on the genuine
// false→true transition into Done, which makes the count robust to effect
// ordering — a fresh result that momentarily still reads atDone (before the
// playback store resets stepIndex) never counts, because prevDone was already
// true. Together: exactly one POST per solved lock actually replayed to Done.
let countedResult: Solution | null = null;
let prevDone = false;

/** Fire-and-forget the increment; keepalive lets it survive a tab close right
 * after the lock opens. Parse + fold the new total; swallow all failures. */
function postCrack(): void {
  void fetch(ENDPOINT, { method: "POST", keepalive: true })
    .then((res) => res.json() as Promise<{ n: number | null }>)
    .then((data) => crackCounter.apply(data.n))
    .catch(() => {
      // a missed vanity increment is not worth surfacing
    });
}

// Client-only wiring, mirroring the persistence pattern in
// playback-store.svelte.ts. There is no fetch/localStorage during prerender.
if (browser) {
  $effect.root(() => {
    $effect(() => {
      const result = lockStore.result;
      const done = playbackStore.atDone;
      const entered = done && !prevDone;
      prevDone = done;
      if (entered && result !== countedResult) {
        countedResult = result;
        postCrack();
      }
    });
  });
}
