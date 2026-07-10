<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
  import PlateRow from "$lib/entities/lock/ui/PlateRow.svelte";
  import ConnectionToggle from "$lib/features/edit-connections/ui/ConnectionToggle.svelte";
  import CouplingLegend from "$lib/features/edit-connections/ui/CouplingLegend.svelte";
  import { nextCoupling } from "$lib/features/edit-connections/lib/coupling-options";
  import { solveCurrentLock } from "$lib/features/solve-lock/model/solve-current-lock";
  import { m } from "$lib/paraglide/messages.js";

  const plateIndices = $derived(
    Array.from({ length: lockStore.plateCount }, (_, i) => i),
  );

  // While following, the board mirrors the solution and its controls lock.
  const following = $derived(playbackStore.followBoard && playbackStore.active);
  const positions = $derived(
    following ? playbackStore.positionsBeforeStep : lockStore.positions,
  );

  // Roving-tabindex cursor: exactly one plate-block sits in the tab order, and
  // the keyboard accelerator acts on this plate. Local UI state, not lock data.
  let focused = $state(0);
  // Element refs so Arrow keys can move DOM focus. Reactive so `bind:this` into
  // an array slot is tracked correctly; only ever read inside event handlers.
  let blocks = $state<(HTMLElement | null)[]>([]);

  // Keep the cursor in range when the plate count shrinks (e.g. 7 -> 4 plates).
  $effect(() => {
    const last = lockStore.plateCount - 1;
    if (focused > last) focused = last;
  });

  // The single feedback channel for assistive tech. Focus stays on the plate, so
  // the inner controls' own aria never speaks; this region announces each edit.
  let announce = $state("");

  function couplingStateName(v: number): string {
    return v === 1
      ? m.link_same()
      : v === -1
        ? m.link_opposite()
        : m.link_none();
  }

  // Digit from a physical key code, layout-independent so AZERTY (symbols on the
  // unshifted number row) still enters positions. Numpad drives positions only.
  function digitFromCode(
    code: string,
  ): { value: number; numpad: boolean } | null {
    if (/^Digit[1-7]$/.test(code))
      return { value: Number(code.slice(5)), numpad: false };
    if (/^Numpad[1-7]$/.test(code))
      return { value: Number(code.slice(6)), numpad: true };
    return null;
  }

  function moveFocus(delta: number): void {
    const next = Math.max(
      0,
      Math.min(lockStore.plateCount - 1, focused + delta),
    );
    if (next === focused) return; // clamp at the ends, no wrap
    focused = next;
    blocks[next]?.focus();
  }

  function setPosition(value: number): void {
    lockStore.setPosition(focused, value);
    announce = m.entry_announce_position({ n: focused + 1, pos: value });
  }

  function cycleCoupling(targetIndex: number): void {
    const next = nextCoupling(lockStore.coupling[focused][targetIndex]);
    lockStore.setCoupling(focused, targetIndex, next);
    announce = m.entry_announce_coupling({
      from: focused + 1,
      to: targetIndex + 1,
      state: couplingStateName(next),
    });
  }

  // Keyboard accelerator, scoped to the board element (not svelte:window, so
  // controls outside the board never reach it). Three rules a user can hold in
  // their head: Up/Down pick a plate, 1-7 set its position (Shift+k links it to
  // plate k), Enter solves.
  function onKeydown(e: KeyboardEvent): void {
    // Read-only while the board mirrors a solution; browser/OS chords win (Shift
    // alone is meaningful and must pass through).
    if (following) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Act only when the roving stop itself holds focus. If focus drilled into an
    // inner pin or connection button, native semantics rule and we must no-op —
    // this is what stops Enter from both toggling a pin and solving.
    const target = e.target;
    if (
      !(target instanceof HTMLElement) ||
      !target.classList.contains("plate-block")
    ) {
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        moveFocus(-1);
        e.preventDefault();
        return;
      case "ArrowDown":
        moveFocus(1);
        e.preventDefault();
        return;
      case "Enter":
        if (lockStore.solving) return; // a solve is already in flight
        void solveCurrentLock();
        e.preventDefault();
        return;
    }

    const digit = digitFromCode(e.code);
    if (!digit) return;

    if (e.shiftKey && !digit.numpad) {
      const targetIndex = digit.value - 1;
      // Only real, other plates couple. The ⊙ self cell and out-of-range targets
      // are no-ops, yet still consume the key so no stray symbol lands anywhere.
      if (targetIndex !== focused && targetIndex < lockStore.plateCount) {
        cycleCoupling(targetIndex);
      }
      e.preventDefault();
      return;
    }

    setPosition(digit.value);
    e.preventDefault();
  }
</script>

<!-- Roving-tabindex composite widget: the container carries the accelerator and
     the plate-blocks are the real, focusable controls. The keydown-on-container
     +  tabindex-on-group shape is the ARIA pattern for this, which the generic
     a11y rules cannot recognise. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="lock-board"
  role="group"
  aria-label={m.board_region_aria()}
  aria-keyshortcuts="ArrowUp ArrowDown 1 2 3 4 5 6 7 Enter"
  onkeydown={onKeydown}
>
  {#if following}
    <div class="follow-banner">
      <span>{m.board_follow_banner()}</span>
      <button
        type="button"
        class="unlock"
        onclick={() => (playbackStore.followBoard = false)}
      >
        {m.board_follow_edit()}
      </button>
    </div>
  {/if}

  <CouplingLegend />

  {#each plateIndices as i (i)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="plate-block"
      class:current={lockStore.highlightedPlate === i}
      role="group"
      aria-label={m.plate_name({ n: i + 1 })}
      tabindex={i === focused ? 0 : -1}
      bind:this={blocks[i]}
      onfocusin={() => (focused = i)}
    >
      <span class="plate-block-label mono">
        {m.plate_name({ n: i + 1 })}
        <span class="plate-block-pos"
          >{m.plate_position({ pos: positions[i] })}</span
        >
      </span>
      <PlateRow
        index={i}
        position={positions[i]}
        onSelect={(pos) => lockStore.setPosition(i, pos)}
        disabled={following}
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
                disabled={following}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/each}

  <p class="board-keys-hint">{m.board_keys_hint()}</p>

  <!-- The only feedback channel for assistive tech: focus never leaves the
       plate, so this region alone reports each keyboard edit. -->
  <div class="sr-only" role="status" aria-live="polite">{announce}</div>
</div>

<style>
  .lock-board {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* Read-only cue while the board mirrors the solution. */
  .follow-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.7rem;
    background: color-mix(in oklch, var(--ember) 10%, var(--surface));
    border: 1px solid color-mix(in oklch, var(--ember) 40%, var(--border));
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .follow-banner .unlock {
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }

  .follow-banner .unlock:hover {
    border-color: var(--brass);
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

  .plate-block-pos {
    color: var(--text);
    font-weight: 700;
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

  /* One muted line describing the keyboard accelerator, styled like the page's
     .hint helper text. */
  .board-keys-hint {
    margin: 0.15rem 0 0;
    color: var(--text-muted);
    font-size: 0.78rem;
  }
</style>
