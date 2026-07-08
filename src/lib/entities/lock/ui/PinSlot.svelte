<script lang="ts">
  interface Props {
    value: number;
    active: boolean;
    isGoal: boolean;
    onSelect: (value: number) => void;
    disabled?: boolean;
  }

  const { value, active, isGoal, onSelect, disabled = false }: Props = $props();

  const goalReached = $derived(active && isGoal);
</script>

<button
  type="button"
  class="pin-slot"
  class:active
  class:goal={isGoal}
  class:goal-reached={goalReached}
  role="radio"
  aria-checked={active}
  aria-label={String(value)}
  data-goal={isGoal}
  data-goal-reached={goalReached}
  {disabled}
  onclick={() => onSelect(value)}
>
  <span class="pin" aria-hidden="true"></span>
  <span class="value mono">{value}</span>
</button>

<style>
  .pin-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
    /* Slots share the row evenly, growing to a tactile size on a laptop and
       shrinking to still fit 7 across on a phone. Capped so they stay pin-like
       rather than stretching into wide bars; the row centres the slack. */
    flex: 1 1 0;
    min-width: 2.1rem;
    max-width: 3.6rem;
    height: 4rem;
    padding: 0.45rem 0 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    /* Single change transition for the active-salience cues (spec §8). */
    transition:
      border-color var(--transition-base),
      background var(--transition-base),
      box-shadow var(--transition-base);
  }

  .pin-slot:hover:not(:disabled) {
    border-color: var(--brass);
  }

  .pin-slot:disabled {
    cursor: default;
  }

  .pin-slot.goal {
    border-color: color-mix(in oklch, var(--goal) 55%, var(--border));
  }

  /* Persistent target marker on the centre slot — the goal is always visible,
     not only once a pin has reached it. */
  .pin-slot.goal::before {
    content: "";
    position: absolute;
    top: 0.4rem;
    width: 0.36rem;
    height: 0.36rem;
    border-radius: 50%;
    background: color-mix(in oklch, var(--goal) 60%, transparent);
  }

  .pin {
    width: 0.75rem;
    height: 1.5rem;
    border-radius: 3px;
    /* Inactive pins are dimmed so the active one is the brightest element. */
    background: color-mix(in oklch, var(--text-muted) 55%, transparent);
    transform: translateY(0.3rem);
    transition:
      transform var(--transition-base),
      background var(--transition-base);
  }

  /* Active slot: three redundant preattentive cues — brightest+largest pin, a
     2px ember ring with a gap, a subtle glow, and a tinted slot background. */
  .pin-slot.active {
    background: color-mix(in oklch, var(--ember) 12%, var(--surface));
    border-color: color-mix(in oklch, var(--ember) 40%, var(--border));
    box-shadow:
      0 0 0 2px var(--bg),
      0 0 0 4px var(--ember),
      0 0 0.75rem color-mix(in oklch, var(--ember) 35%, transparent);
  }

  .pin-slot.active .pin {
    background: var(--ember);
    transform: translateY(-0.55rem) scale(1.3);
  }

  .pin-slot.goal-reached .pin {
    background: var(--goal);
  }

  .value {
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1;
  }

  .pin-slot.goal .value {
    color: color-mix(in oklch, var(--goal) 50%, var(--text-muted));
  }

  .pin-slot.active .value {
    color: var(--text);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .pin-slot.goal-reached .value {
    color: var(--goal);
  }

  @media (prefers-reduced-motion: reduce) {
    .pin {
      transition: none;
    }
  }
</style>
