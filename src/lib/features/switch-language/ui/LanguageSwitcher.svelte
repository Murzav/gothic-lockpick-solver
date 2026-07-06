<script lang="ts">
  import { locales, getLocale, setLocale } from "$lib/paraglide/runtime.js";
  import { m } from "$lib/paraglide/messages.js";

  // Endonyms (each language named in itself) so people recognise their own
  // language regardless of the current UI locale, plus a flag. Region/country
  // flags are emoji; Catalonia has no reliably-rendered flag emoji (the
  // subdivision tag sequence falls back to a black flag on most platforms),
  // so it ships as an inline SVG Senyera instead.
  const CA_SENYERA =
    '<svg viewBox="0 0 30 20" aria-hidden="true">' +
    '<rect width="30" height="20" fill="#FCDD09"/>' +
    '<rect y="2.22" width="30" height="2.22" fill="#DA121A"/>' +
    '<rect y="6.66" width="30" height="2.22" fill="#DA121A"/>' +
    '<rect y="11.1" width="30" height="2.22" fill="#DA121A"/>' +
    '<rect y="15.56" width="30" height="2.22" fill="#DA121A"/></svg>';

  // Valencian ships the Reial Senyera, not the plain Senyera: the Catalan
  // stripes with a blue crowned band (the "tafatà") at the hoist. It is the
  // official flag of the Valencian Community and is culturally distinct —
  // reusing the Catalan flag here would be wrong. Colours, the 2:1 ratio and
  // proportions follow the official Senyera Coronada (blue #0072BC, red
  // #DA121A, gold #FCDD09); the crown is a simplified glyph, since the full
  // 84-path original is illegible at this icon size. No emoji renders it, so
  // it is inline SVG.
  const VA_SENYERA =
    '<svg viewBox="0 0 30 15" aria-hidden="true">' +
    '<rect width="30" height="15" fill="#FCDD09"/>' +
    '<rect x="7.33" y="1.667" width="22.67" height="1.667" fill="#DA121A"/>' +
    '<rect x="7.33" y="5" width="22.67" height="1.667" fill="#DA121A"/>' +
    '<rect x="7.33" y="8.333" width="22.67" height="1.667" fill="#DA121A"/>' +
    '<rect x="7.33" y="11.667" width="22.67" height="1.667" fill="#DA121A"/>' +
    '<rect width="7.5" height="15" fill="#0072BC"/>' +
    '<rect x="5.85" width="1.66" height="15" fill="#DA121A"/>' +
    '<rect x="0.8" y="9" width="4.3" height="0.9" fill="#FCDD09"/>' +
    '<path d="M0.8 9 0.8 5.4 1.875 6.9 2.95 4.6 4.025 6.9 5.1 5.4 5.1 9Z" fill="#FCDD09"/></svg>';

  const LANGUAGES: Record<
    string,
    { name: string; flag: string; flagSvg?: string }
  > = {
    en: { name: "English", flag: "🇬🇧" },
    ru: { name: "Русский", flag: "🇷🇺" },
    uk: { name: "Українська", flag: "🇺🇦" },
    es: { name: "Español", flag: "🇪🇸" },
    de: { name: "Deutsch", flag: "🇩🇪" },
    pt: { name: "Português", flag: "🇵🇹" },
    "pt-BR": { name: "Português (Brasil)", flag: "🇧🇷" },
    "es-419": { name: "Español (Latinoamérica)", flag: "🌎" },
    fr: { name: "Français", flag: "🇫🇷" },
    pl: { name: "Polski", flag: "🇵🇱" },
    nl: { name: "Nederlands", flag: "🇳🇱" },
    cs: { name: "Čeština", flag: "🇨🇿" },
    sk: { name: "Slovenčina", flag: "🇸🇰" },
    hu: { name: "Magyar", flag: "🇭🇺" },
    ro: { name: "Română", flag: "🇷🇴" },
    it: { name: "Italiano", flag: "🇮🇹" },
    tr: { name: "Türkçe", flag: "🇹🇷" },
    zh: { name: "简体中文", flag: "🇨🇳" },
    ca: { name: "Català", flag: "", flagSvg: CA_SENYERA },
    "ca-ES-valencia": { name: "Valencià", flag: "", flagSvg: VA_SENYERA },
  };

  const active = getLocale();
  const current = LANGUAGES[active] ?? LANGUAGES.en;

  let open = $state(false);

  function choose(loc: string): void {
    open = false;
    if (loc !== getLocale()) {
      // setLocale persists to localStorage and reloads so every message
      // re-renders in the chosen language.
      setLocale(loc as (typeof locales)[number]);
    }
  }
</script>

{#snippet flagIcon(entry: { flag: string; flagSvg?: string } | undefined)}
  {#if entry?.flagSvg}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <span class="flag flag-svg">{@html entry.flagSvg}</span>
  {:else}
    <span class="flag">{entry?.flag || "🏳️"}</span>
  {/if}
{/snippet}

<div class="lang" class:open>
  <button
    type="button"
    class="trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={m.language_label()}
    onclick={() => (open = !open)}
  >
    {@render flagIcon(current)}
    <span class="name">{current.name}</span>
    <span class="chevron" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="backdrop" onclick={() => (open = false)}></div>
    <ul class="menu" role="listbox" aria-label={m.language_label()}>
      {#each locales as loc (loc)}
        <li role="option" aria-selected={loc === active}>
          <button
            type="button"
            class="option"
            class:active={loc === active}
            onclick={() => choose(loc)}
          >
            {@render flagIcon(LANGUAGES[loc])}
            <span class="name">{LANGUAGES[loc]?.name ?? loc}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .lang {
    position: relative;
    font-family: var(--font-body);
  }

  .trigger,
  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    cursor: pointer;
  }

  .trigger {
    font-size: 0.85rem;
    border-radius: 8px;
    padding: 0.4rem 0.6rem;
  }

  .trigger:hover,
  .lang.open .trigger {
    border-color: var(--brass);
  }

  .trigger .chevron {
    color: var(--text-muted);
    font-size: 0.7rem;
    transition: transform var(--transition-fast);
  }

  .lang.open .trigger .chevron {
    transform: rotate(180deg);
  }

  .flag {
    font-size: 1.05rem;
    line-height: 1;
  }

  .flag-svg {
    display: inline-flex;
    align-items: center;
  }

  .flag-svg :global(svg) {
    display: block;
    width: 1.35em;
    height: auto;
    border-radius: 2px;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 20%);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: 50;
    min-width: 12.5rem;
    max-height: 70vh;
    overflow-y: auto;
    margin: 0;
    padding: 0.35rem;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 12px 30px rgb(0 0 0 / 45%);
  }

  .menu li {
    margin: 0;
  }

  .option {
    width: 100%;
    font-size: 0.9rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0.45rem 0.55rem;
    text-align: left;
  }

  .option:hover {
    background: color-mix(in oklch, var(--surface) 60%, var(--brass) 18%);
  }

  .option.active {
    color: var(--ember);
    border-color: color-mix(in oklch, var(--ember) 45%, var(--border));
  }

  :focus-visible {
    outline: 2px solid var(--brass);
    outline-offset: 2px;
  }
</style>
