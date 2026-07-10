<script lang="ts">
  import "../app.css";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import LanguageSwitcher from "$lib/features/switch-language/ui/LanguageSwitcher.svelte";
  import CrackCounter from "$lib/features/solve-lock/ui/CrackCounter.svelte";

  let { children } = $props();

  // Keep the document language in sync with the active locale for a11y and
  // correct hyphenation. Runs on the client (the app is a client-only SPA).
  $effect(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<div class="lang-switcher">
  <LanguageSwitcher />
</div>

{@render children()}

<footer class="site-footer">
  <a
    class="gh-link"
    href="https://github.com/Murzav/gothic-lockpick-solver"
    target="_blank"
    rel="noopener noreferrer"
  >
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
    <span>GitHub</span>
  </a>
  <CrackCounter />
</footer>

<style>
  .lang-switcher {
    position: fixed;
    top: 0.85rem;
    right: 0.85rem;
    z-index: 60;
  }

  @media (min-width: 60rem) {
    .lang-switcher {
      top: 1.25rem;
      right: 1.25rem;
    }
  }

  .site-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 1rem;
    padding: 1.5rem 1rem 2.5rem;
  }

  .gh-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .gh-link:hover {
    color: var(--ember);
  }
</style>
