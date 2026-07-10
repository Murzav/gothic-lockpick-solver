<script lang="ts">
  import { onMount } from "svelte";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { crackCounter } from "$lib/features/solve-lock/model/crack-counter.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // onMount is client-only, so the "once per page load" GET never runs during
  // prerender.
  onMount(() => {
    crackCounter.refresh();
  });

  // Group digits in the reader's own locale. Null until the first successful
  // read (or forever, offline) — we render nothing then, no placeholder jump.
  const formatted = $derived(
    crackCounter.total === null
      ? null
      : new Intl.NumberFormat(getLocale()).format(crackCounter.total),
  );
</script>

{#if formatted !== null}
  <span class="crack-counter">{m.footer_cracked({ count: formatted })}</span>
{/if}

<style>
  .crack-counter {
    color: var(--text-muted);
    font-size: 0.9rem;
  }
</style>
