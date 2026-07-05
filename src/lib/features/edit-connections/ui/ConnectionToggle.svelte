<script lang="ts">
  import {
    couplingOption,
    nextCoupling,
  } from "$lib/features/edit-connections/lib/coupling-options";
  import { m } from "$lib/paraglide/messages.js";

  interface Props {
    /** Accessible base, e.g. "Plate 1 → plate 2". */
    label: string;
    value: number;
    onChange: (value: number) => void;
  }

  const { label, value, onChange }: Props = $props();

  const option = $derived(couplingOption(value));
  const stateName = $derived(
    option.value === 1
      ? m.link_same()
      : option.value === -1
        ? m.link_opposite()
        : m.link_none(),
  );
</script>

<button
  type="button"
  class="conn-toggle {option.tone}"
  aria-label={`${label}: ${stateName}`}
  title={stateName}
  onclick={() => onChange(nextCoupling(value))}
>
  {option.label}
</button>

<style>
  .conn-toggle {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    line-height: 1;
    min-width: 2.4rem;
    padding: 0.4rem 0.7rem;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .conn-toggle:hover {
    border-color: var(--brass);
  }

  /* No link stays quiet, so a plate with no couplings reads calm. */
  .conn-toggle.neutral:hover {
    color: var(--text);
  }

  /* Same direction (»): green. Opposite (⇄): red. Only a real link
     carries colour, so the accent means "this plate is coupled". */
  .conn-toggle.positive {
    color: var(--bg);
    background: var(--goal);
    border-color: var(--goal);
  }

  .conn-toggle.negative {
    color: var(--bg);
    background: var(--danger);
    border-color: var(--danger);
  }
</style>
