<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    children: Snippet;
  }

  const { title, children }: Props = $props();
</script>

<section class="card">
  {#if title}
    <h2 class="card-title">{title}</h2>
  {/if}
  <div class="card-body">
    {@render children()}
  </div>
</section>

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem;
    /* Metal-edge texture: a faint brass hairline inset, panel-edges only. */
    box-shadow: inset 0 0 0 1px
      color-mix(in oklch, var(--brass) 8%, transparent);
  }

  .card-title {
    margin: 0 0 0.75rem;
    font-size: 1.05rem;
  }

  .card-body {
    color: var(--text);
  }
</style>
