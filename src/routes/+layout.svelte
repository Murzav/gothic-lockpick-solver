<script lang="ts">
  import "../app.css";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import LanguageSwitcher from "$lib/features/switch-language/ui/LanguageSwitcher.svelte";

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
</style>
