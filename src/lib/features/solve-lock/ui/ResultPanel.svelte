<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
  import { physicalDirection } from "$lib/features/solve-lock/lib/moves";
  import Card from "$lib/shared/ui/Card.svelte";
  import { DpadIcon } from "$lib/shared/ui";
  import type { GroupedMove } from "$lib/entities/lock/model/types";
  import { untrack } from "svelte";
  import { m } from "$lib/paraglide/messages.js";

  const result = $derived(lockStore.result);
  // The playback store owns the grouped solution and the current step now.
  const grouped = $derived(playbackStore.grouped);

  let itemRefs = $state<HTMLLIElement[]>([]);

  // Keep the active row visible as the step advances — scoped to the list's own
  // scroll container, keyed strictly on stepIndex so a re-render for any other
  // reason never yanks the scroll position.
  $effect(() => {
    const idx = playbackStore.stepIndex;
    untrack(() => {
      itemRefs[idx]?.scrollIntoView({ block: "nearest" });
    });
  });

  function stepDirection(g: GroupedMove): "right" | "left" {
    return physicalDirection(g.dir, lockStore.convention);
  }

  function stepLabel(g: GroupedMove): string {
    const direction =
      stepDirection(g) === "right" ? m.dir_right() : m.dir_left();
    const times = g.count > 1 ? ` ×${g.count}` : "";
    return m.move_line({ plate: g.plate + 1, direction, times });
  }
</script>

{#if result}
  <Card title={m.result_title()}>
    {#if !result.solvable}
      <p class="status status-bad" aria-live="polite">
        {m.result_unsolvable()}
      </p>
      <p class="explainer">{m.result_unsolvable_note()}</p>
      <p class="stats mono">
        {m.result_states_checked({ count: result.statesExplored })}
      </p>
    {:else if grouped.length === 0}
      <p class="status status-ok" aria-live="polite">
        {m.result_already_open()}
      </p>
    {:else}
      <ol class="move-list">
        {#each grouped as g, i (i)}
          <li
            bind:this={itemRefs[i]}
            class:done={i < playbackStore.stepIndex}
            class:current={i === playbackStore.stepIndex}
            aria-current={i === playbackStore.stepIndex ? "step" : undefined}
          >
            <span class="step-num">{i + 1}.</span>
            <DpadIcon direction={stepDirection(g)} size={18} />
            <span class="step-text">{stepLabel(g)}</span>
          </li>
        {/each}
      </ol>
      <p class="stats mono">
        {m.result_states_explored({ count: result.statesExplored })}
      </p>
    {/if}
  </Card>
{/if}

<style>
  .status {
    font-weight: 600;
  }

  .status-ok {
    color: var(--goal);
  }

  .status-bad {
    color: var(--danger);
  }

  .explainer {
    color: var(--text-muted);
  }

  .move-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0 0 0.75rem;
    padding: 0;
    max-height: 14rem;
    overflow-y: auto;
  }

  .move-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.15rem 0.35rem;
    border-left: 3px solid transparent;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .step-num {
    flex: 0 0 2.2rem;
    text-align: right;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Completed steps recede; the current step is the loud one; upcoming stay
     muted (the default li colour). */
  .move-list li.done {
    opacity: 0.5;
  }

  .move-list li.current {
    color: var(--text);
    font-weight: 700;
    border-left-color: var(--ember);
    background: color-mix(in oklch, var(--ember) 10%, transparent);
  }

  .move-list li.current .step-num {
    color: var(--ember);
  }

  .stats {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
</style>
