<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import SegButton from "$lib/shared/ui/SegButton.svelte";
  import ConnectionToggle from "$lib/features/edit-connections/ui/ConnectionToggle.svelte";
  import CouplingLegend from "$lib/features/edit-connections/ui/CouplingLegend.svelte";
  import { MAX_POS, MIN_POS } from "$lib/shared/config";
  import { m } from "$lib/paraglide/messages.js";

  const positions = Array.from(
    { length: MAX_POS - MIN_POS + 1 },
    (_, i) => MIN_POS + i,
  );

  const plateIndices = $derived(
    Array.from({ length: lockStore.plateCount }, (_, i) => i),
  );
</script>

<div class="lock-form">
  <CouplingLegend />

  <div class="matrix">
    {#each plateIndices as i (i)}
      <div class="matrix-row">
        <div class="plate-cell">
          <span class="plate-label mono">{m.plate_name({ n: i + 1 })}</span>
          <div
            class="position-selector"
            role="group"
            aria-label={m.plate_position_aria({ n: i + 1 })}
          >
            {#each positions as p (p)}
              <SegButton
                value={p}
                label={String(p)}
                active={lockStore.positions[i] === p}
                onSelect={(v) => lockStore.setPosition(i, v)}
              />
            {/each}
          </div>
        </div>

        <div class="conn-cell">
          <span class="conn-caption mono"
            >{m.form_move_caption({ n: i + 1 })}</span
          >
          <div class="connections">
            {#each plateIndices as j (j)}
              {#if j === i}
                <div class="connection is-self" aria-hidden="true">
                  <span class="conn-target mono"
                    >{m.plate_short({ n: j + 1 })}</span
                  >
                  <span class="self-mark">⊙</span>
                </div>
              {:else}
                <div class="connection">
                  <span class="conn-target mono"
                    >{m.plate_short({ n: j + 1 })}</span
                  >
                  <ConnectionToggle
                    label={m.connection_aria({ from: i + 1, to: j + 1 })}
                    value={lockStore.coupling[i][j]}
                    onChange={(v) => lockStore.setCoupling(i, j, v)}
                  />
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .lock-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .matrix {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .matrix-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid var(--border);
  }

  .matrix-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .plate-cell,
  .conn-cell {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .plate-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text);
  }

  .conn-caption {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .position-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .connections {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .connection {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.35rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  /* The current plate itself: dimmed, non-interactive anchor. */
  .connection.is-self {
    opacity: 0.5;
  }

  .self-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.4rem;
    padding: 0.4rem 0.7rem;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    line-height: 1;
    color: var(--text-muted);
  }

  .conn-target {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
</style>
