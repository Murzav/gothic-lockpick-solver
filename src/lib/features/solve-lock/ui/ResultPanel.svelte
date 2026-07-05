<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import {
    physicalDirection,
    groupMoves,
  } from "$lib/features/solve-lock/lib/moves";
  import Card from "$lib/shared/ui/Card.svelte";
  import type { GroupedMove } from "$lib/entities/lock/model/types";
  import { m } from "$lib/paraglide/messages.js";

  let stepIndex = $state(0);

  const result = $derived(lockStore.result);
  const grouped = $derived(
    result?.solvable && result.moves ? groupMoves(result.moves) : [],
  );

  $effect(() => {
    // A freshly computed result always restarts the playback.
    if (result) {
      stepIndex = 0;
    }
  });

  // Mirror the current playback step onto the board: the plate being moved
  // lights up, so the solution is something you watch, not just read.
  $effect(() => {
    lockStore.highlightedPlate = grouped.length
      ? (grouped[stepIndex]?.plate ?? null)
      : null;
    return () => {
      lockStore.highlightedPlate = null;
    };
  });

  function stepLabel(g: GroupedMove): string {
    const dir = physicalDirection(g.dir, lockStore.convention);
    const direction = dir === "right" ? m.dir_right() : m.dir_left();
    const times = g.count > 1 ? ` ×${g.count}` : "";
    return m.move_line({ plate: g.plate + 1, direction, times });
  }

  function stepBack(): void {
    stepIndex = Math.max(0, stepIndex - 1);
  }

  function stepForward(): void {
    stepIndex = Math.min(grouped.length - 1, stepIndex + 1);
  }
</script>

{#if result}
  <div aria-live="polite">
    <Card title={m.result_title()}>
      {#if !result.solvable}
        <p class="status status-bad">{m.result_unsolvable()}</p>
        <p class="explainer">{m.result_unsolvable_note()}</p>
        <p class="stats mono">
          {m.result_states_checked({ count: result.statesExplored })}
        </p>
      {:else if grouped.length === 0}
        <p class="status status-ok">{m.result_already_open()}</p>
      {:else}
        <ol class="move-list">
          {#each grouped as g, i (i)}
            <li
              class:current={i === stepIndex}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              <span class="step-num">{i + 1}.</span>
              <span class="step-text">{stepLabel(g)}</span>
            </li>
          {/each}
        </ol>
        <div class="playback" role="group" aria-label={m.playback_aria()}>
          <button
            type="button"
            class="step-btn"
            disabled={stepIndex === 0}
            onclick={stepBack}
          >
            {m.playback_prev()}
          </button>
          <span class="mono step-counter">
            {m.playback_step({ step: stepIndex + 1, total: grouped.length })}
          </span>
          <button
            type="button"
            class="step-btn"
            disabled={stepIndex === grouped.length - 1}
            onclick={stepForward}
          >
            {m.playback_next()}
          </button>
        </div>
        <p class="stats mono">
          {m.result_states_explored({ count: result.statesExplored })}
        </p>
      {/if}
    </Card>
  </div>
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
  }

  .move-list li {
    display: flex;
    gap: 0.5rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .step-num {
    flex: 0 0 2.2rem;
    text-align: right;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .move-list li.current {
    color: var(--text);
    font-weight: 700;
  }

  .move-list li.current .step-num {
    color: var(--ember);
  }

  .playback {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .step-btn {
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.35rem 0.65rem;
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .step-btn:hover:not(:disabled) {
    border-color: var(--brass);
  }

  .step-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .step-counter {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .stats {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
</style>
