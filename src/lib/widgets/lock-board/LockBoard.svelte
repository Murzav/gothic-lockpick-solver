<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import PlateRow from "$lib/entities/lock/ui/PlateRow.svelte";
  import ConnectionToggle from "$lib/features/edit-connections/ui/ConnectionToggle.svelte";
  import CouplingLegend from "$lib/features/edit-connections/ui/CouplingLegend.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const plateIndices = $derived(
    Array.from({ length: lockStore.plateCount }, (_, i) => i),
  );
</script>

<div class="lock-board">
  <CouplingLegend />

  {#each plateIndices as i (i)}
    <div class="plate-block" class:current={lockStore.highlightedPlate === i}>
      <span class="plate-block-label mono">{m.plate_name({ n: i + 1 })}</span>
      <PlateRow
        index={i}
        position={lockStore.positions[i]}
        onSelect={(pos) => lockStore.setPosition(i, pos)}
      />
      <div
        class="connections"
        role="group"
        aria-label={m.board_connections_aria({ n: i + 1 })}
      >
        {#each plateIndices as j (j)}
          {#if j === i}
            <div class="connection is-self" aria-hidden="true">
              <span class="connection-label mono"
                >{m.plate_short({ n: j + 1 })}</span
              >
              <span class="self-mark">⊙</span>
            </div>
          {:else}
            <div class="connection">
              <span class="connection-label mono"
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
  {/each}
</div>

<style>
  .lock-board {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .plate-block {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.7rem;
    background: color-mix(in oklch, var(--bg) 65%, var(--surface));
    border: 1px solid var(--border);
    border-radius: 8px;
    transition:
      border-color var(--transition-base),
      box-shadow var(--transition-base);
  }

  /* The plate the solution playback is currently moving. */
  .plate-block.current {
    border-color: var(--ember);
    box-shadow: 0 0 0 1px var(--ember) inset;
  }

  .plate-block-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .plate-block.current .plate-block-label {
    color: var(--ember);
  }

  .connections {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.35rem;
  }

  .connection {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.4rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    transition: border-color var(--transition-fast);
  }

  /* The current plate itself: a dimmed, non-interactive anchor so the row
     reads as "this plate, versus every other". */
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

  .connection-label {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
</style>
