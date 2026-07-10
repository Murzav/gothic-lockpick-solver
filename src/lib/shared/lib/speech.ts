import { browser } from "$app/environment";

/** A request to speak some text, resolved against an ordered language chain. */
export interface SpeakRequest {
  text: string;
  /** Ordered preference chain, e.g. ["sk-SK", "sk", "cs-CZ", "cs"]. */
  langs: readonly string[];
  /** Playback rate; slightly slow (0.9) reads clearer by ear. */
  rate?: number;
}

/** The public surface of a speaker; every method is a silent no-op when unsupported. */
export interface Speaker {
  readonly supported: boolean;
  speak(req: SpeakRequest): void;
  cancel(): void;
  hasVoiceFor(langs: readonly string[]): boolean;
  /** Subscribe to voice-list updates; returns an unsubscribe function. */
  onVoicesChanged(cb: () => void): () => void;
}

// Chrome+Firefox silently drop an utterance passed to speak() right after
// cancel() (Mozilla #1522074), so we always schedule the real speak a beat
// later. The same gap debounces rapid stepping — no second debounce is needed.
const SPEAK_DELAY_MS = 80;
// Some engines never emit 'voiceschanged'; re-query once after a short wait.
const VOICES_FALLBACK_MS = 1500;

/** Normalize a BCP-47 tag for comparison: lowercase, '_' treated as '-'. */
function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace(/_/g, "-");
}

/** Best voice within a set: prefer a local one (Chrome M130 made remote
 * voices unstable), otherwise the first match. */
function pickPreferred(matches: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (matches.length === 0) return null;
  return matches.find((v) => v.localService) ?? matches[0];
}

/**
 * Web Speech wrapper mirroring wake-lock's philosophy: feature-detected, a
 * silent no-op where the engine is unavailable, so callers never branch on
 * support. It resolves voices lazily (the list loads asynchronously on most
 * engines) and refuses to speak when no voice matches the requested language
 * chain — letting the engine fall back to an English default garbles foreign
 * text far worse than saying nothing.
 */
export function createSpeaker(): Speaker {
  const supported =
    browser &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  let voices: SpeechSynthesisVoice[] = [];
  let voicesSignature = "";
  let voicesInitialized = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  const subscribers = new Set<() => void>();

  function notify(): void {
    for (const cb of subscribers) cb();
  }

  function refreshVoices(): void {
    if (!supported) return;
    try {
      const list = window.speechSynthesis.getVoices();
      // Compare by identity, not length: engines can swap entries in place
      // (e.g. a remote voice replaced by a local one of the same language),
      // while the fallback timer and 'voiceschanged' can also re-fire for the
      // same population — only a genuine change should re-notify.
      const signature = list.map((v) => v.voiceURI).join("|");
      if (signature !== voicesSignature) {
        voicesSignature = signature;
        voices = list;
        notify();
      }
    } catch {
      // engine access can throw in odd teardown states — stay silent
    }
  }

  function ensureVoicesInit(): void {
    if (!supported || voicesInitialized) return;
    voicesInitialized = true;
    refreshVoices();
    try {
      // Keep reacting to later changes: voices can load after first use, and
      // the user may install more while the tab is open.
      window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    } catch {
      // some engines lack addEventListener on the synth — ignore
    }
    if (voices.length === 0) {
      setTimeout(refreshVoices, VOICES_FALLBACK_MS);
    }
  }

  /**
   * Resolve the first candidate in the chain that yields a voice: exact
   * lang match first, then a prefix match (voice.lang starts with
   * "candidate-"). The first candidate producing any voice wins.
   */
  function resolveVoice(langs: readonly string[]): SpeechSynthesisVoice | null {
    ensureVoicesInit();
    if (voices.length === 0) return null;
    for (const candidate of langs) {
      const cand = normalizeLang(candidate);
      const exact = pickPreferred(voices.filter((v) => normalizeLang(v.lang) === cand));
      if (exact) return exact;
      const prefix = pickPreferred(
        voices.filter((v) => normalizeLang(v.lang).startsWith(cand + "-")),
      );
      if (prefix) return prefix;
    }
    return null;
  }

  function clearPending(): void {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function cancel(): void {
    if (!supported) return;
    clearPending();
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore engine errors
    }
  }

  function speak(req: SpeakRequest): void {
    if (!supported) return;
    // A new request always supersedes the previous one — cancel current and
    // pending speech FIRST, even if this request turns out unspeakable: a
    // stale instruction firing later is worse guidance than silence. A fresh
    // speak() or cancel() in the 80ms window clears the timer, so rapid-fire
    // calls coalesce to the last one.
    clearPending();
    try {
      window.speechSynthesis.cancel();
    } catch {
      return;
    }

    const voice = resolveVoice(req.langs);
    // No voice for this chain → say nothing (never let the engine read foreign
    // text with an English default).
    if (!voice) return;
    const { text } = req;
    const rate = req.rate ?? 0.9;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      try {
        // Utterances are single-use — build a fresh one every time and do not
        // retain it (holding finished utterances leaks).
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        window.speechSynthesis.speak(utterance);
      } catch {
        // engine can throw if torn down mid-flight — stay silent
      }
    }, SPEAK_DELAY_MS);
  }

  function hasVoiceFor(langs: readonly string[]): boolean {
    if (!supported) return false;
    return resolveVoice(langs) !== null;
  }

  function onVoicesChanged(cb: () => void): () => void {
    subscribers.add(cb);
    // Kick off lazy init so a "no voice" hint can settle without a speak call.
    ensureVoicesInit();
    return () => {
      subscribers.delete(cb);
    };
  }

  return { supported, speak, cancel, hasVoiceFor, onVoicesChanged };
}

/**
 * Shared singleton. Its methods are plain object properties (not prototype
 * methods) so a test can `vi.spyOn(speaker, "speak")`.
 */
export const speaker = createSpeaker();
