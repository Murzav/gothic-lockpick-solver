<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import PlateRow from "$lib/entities/lock/ui/PlateRow.svelte";
  import ConnectionArrows from "$lib/features/edit-connections/ui/ConnectionArrows.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const plateIndices = $derived(
    Array.from({ length: lockStore.plateCount }, (_, i) => i),
  );
</script>

<div class="lock-board">
  {#each plateIndices as i (i)}
    <div class="plate-block" class:current={lockStore.highlightedPlate === i}>
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
          {#if j !== i}
            <div
              class="connection"
              class:has-link={lockStore.coupling[i][j] !== 0}
            >
              <span class="connection-label mono"
                >{m.plate_short({ n: j + 1 })}</span
              >
              <ConnectionArrows
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

  .connections {
    display: flex;
    flex-wrap: wrap;
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

  /* A real coupling is the meaningful state — let it carry the accent. */
  .connection.has-link {
    border-color: color-mix(in oklch, var(--ember) 55%, var(--border));
  }

  .connection-label {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .connection.has-link .connection-label {
    color: var(--ember);
  }
</style>
