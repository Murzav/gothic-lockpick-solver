import { getLocale } from "$lib/paraglide/runtime.js";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
import { speechLangs, stepPhrase, donePhrase } from "$lib/features/solve-lock/lib/tts";
import { speaker } from "$lib/shared/lib/speech";

/**
 * Speak the grouped step at `index` (the Done phrase past the last group) at the
 * user's chosen rate. Sole entry point for both the playback bar's step effect
 * and the voice-settings card, so the two can never drift in wording or speed.
 * Silently skips a stale index — on a fresh solve this can run before the store
 * resets to 0, leaving grouped[index] undefined; the next run speaks the real step.
 */
export function announceStep(index: number): void {
  const langs = speechLangs(getLocale());
  const rate = playbackStore.voiceRate;
  if (index === playbackStore.grouped.length) {
    speaker.speak({ text: donePhrase(), langs, rate });
    return;
  }
  const step = playbackStore.grouped[index];
  if (!step) return;
  speaker.speak({ text: stepPhrase(step, lockStore.convention), langs, rate });
}
