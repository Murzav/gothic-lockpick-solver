<script lang="ts">
  interface Props {
    value: number;
    active: boolean;
    label: string;
    onSelect: (value: number) => void;
    /**
     * `accent` (default) fills the active state with ember — for a single
     * meaningful choice among a few (view/direction/plate-count). `neutral`
     * gives a quiet active state, so a "no effect" option (coupling 0) does
     * not scream for attention when it is merely the default. `positive` /
     * `negative` colour the active state green / red — used by the coupling
     * buttons so "same direction" and "opposite direction" read at a glance.
     */
    tone?: "accent" | "neutral" | "positive" | "negative";
  }

  const { value, active, label, onSelect, tone = "accent" }: Props = $props();
</script>

<button
  type="button"
  class="seg-button"
  class:active
  class:neutral={tone === "neutral"}
  class:positive={tone === "positive"}
  class:negative={tone === "negative"}
  aria-pressed={active}
  onclick={() => onSelect(value)}
>
  {label}
</button>

<style>
  .seg-button {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .seg-button:hover {
    color: var(--text);
    border-color: var(--brass);
  }

  .seg-button.active {
    color: var(--bg);
    background: var(--ember);
    border-color: var(--ember);
  }

  /* Quiet active state: selected, but not shouting. Used for the "no
     coupling" (0) option so the board reads calm until a real link exists. */
  .seg-button.neutral.active {
    color: var(--text);
    background: color-mix(in oklch, var(--surface) 78%, var(--brass) 22%);
    border-color: color-mix(in oklch, var(--brass) 55%, var(--border));
  }

  /* Same direction (»): green. Opposite (⇄): red. Only the selected
     coupling carries colour, so a row reads as calm until a link is set. */
  .seg-button.positive.active {
    color: var(--bg);
    background: var(--goal);
    border-color: var(--goal);
  }

  .seg-button.negative.active {
    color: var(--bg);
    background: var(--danger);
    border-color: var(--danger);
  }
</style>
