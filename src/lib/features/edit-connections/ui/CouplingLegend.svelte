<script lang="ts">
  import { m } from "$lib/paraglide/messages.js";

  const items = $derived([
    { glyph: "⊙", cls: "self", text: m.link_self() },
    { glyph: "»", cls: "positive", text: m.link_same() },
    { glyph: "⇄", cls: "negative", text: m.link_opposite() },
    { glyph: "—", cls: "neutral", text: m.link_none() },
  ]);
</script>

<ul class="coupling-legend">
  {#each items as item (item.cls)}
    <li>
      <span class="glyph {item.cls}" aria-hidden="true">{item.glyph}</span>
      <span>{item.text}</span>
    </li>
  {/each}
</ul>

<style>
  .coupling-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .coupling-legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.7rem;
    padding: 0.15rem 0.35rem;
    font-family: var(--font-mono);
    line-height: 1;
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  .glyph.self {
    opacity: 0.55;
  }

  .glyph.positive {
    color: var(--bg);
    background: var(--goal);
    border-color: var(--goal);
  }

  .glyph.negative {
    color: var(--bg);
    background: var(--danger);
    border-color: var(--danger);
  }
</style>
