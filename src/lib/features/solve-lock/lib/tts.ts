import { m } from "$lib/paraglide/messages.js";
import { getLocale } from "$lib/paraglide/runtime.js";
import { physicalDirection } from "$lib/features/solve-lock/lib/moves";
import { countPhrase } from "$lib/features/solve-lock/lib/count-phrase";
import type { GroupedMove, DirectionConvention } from "$lib/entities/lock/model/types";

// Voice preference chains per app locale. Near-language fallbacks are
// deliberate: a Czech voice reads Slovak intelligibly, Central Catalan stands
// in for Valencian (no Valencian voice is reachable via Web Speech anywhere),
// and each chain ends broad so a regionless voice still resolves.
const LANG_CHAINS: Record<string, readonly string[]> = {
  en: ["en-US", "en"],
  de: ["de-DE", "de"],
  fr: ["fr-FR", "fr"],
  es: ["es-ES", "es"],
  "es-419": ["es-MX", "es-US", "es", "es-ES"],
  ca: ["ca-ES", "ca"],
  "ca-ES-valencia": ["ca-ES", "ca"],
  pt: ["pt-PT", "pt", "pt-BR"],
  "pt-BR": ["pt-BR", "pt", "pt-PT"],
  it: ["it-IT", "it"],
  nl: ["nl-NL", "nl"],
  pl: ["pl-PL", "pl"],
  cs: ["cs-CZ", "cs"],
  sk: ["sk-SK", "sk", "cs-CZ", "cs"],
  uk: ["uk-UA", "uk"],
  ru: ["ru-RU", "ru"],
  ro: ["ro-RO", "ro"],
  hu: ["hu-HU", "hu"],
  tr: ["tr-TR", "tr"],
  zh: ["zh-CN", "zh"],
};

/** Ordered voice-language chain for a locale; unknown locales try the tag itself. */
export function speechLangs(locale: string): readonly string[] {
  return LANG_CHAINS[locale] ?? [locale];
}

/** Uppercase the first character in a locale-aware way (no-op for Han). */
function capitalize(text: string, locale: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/**
 * The spoken instruction for one grouped step, using the exact terminology the
 * UI shows (plate name, right/left). Prosody is the point: periods force a long
 * pause, the comma a short one, so a listener can act between fields. The count
 * is dropped when it is 1 (the UI does the same). Chinese uses full-width
 * punctuation and no comma — ASCII punctuation between Han characters may not
 * pause. Symbols like ×, →, x are never emitted; they read as noise.
 */
export function stepPhrase(step: GroupedMove, convention: DirectionConvention): string {
  const locale = getLocale();
  const plate = m.plate_name({ n: step.plate + 1 });
  const word = physicalDirection(step.dir, convention) === "right" ? m.dir_right() : m.dir_left();
  const direction = capitalize(word, locale);
  const count = step.count > 1 ? countPhrase(locale, step.count) : "";

  if (locale === "zh") {
    return count ? `${plate}。${direction} ${count}。` : `${plate}。${direction}。`;
  }
  return count ? `${plate}. ${direction}, ${count}.` : `${plate}. ${direction}.`;
}

/** Spoken confirmation that the lock is open — matches the UI's Done label. */
export function donePhrase(): string {
  return m.playback_done();
}
