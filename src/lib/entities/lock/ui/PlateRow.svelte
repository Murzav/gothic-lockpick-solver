<script lang="ts">
  import { GOAL_POS, MAX_POS, MIN_POS } from "$lib/shared/config";
  import PinSlot from "./PinSlot.svelte";
  import { m } from "$lib/paraglide/messages.js";

  interface Props {
    index: number;
    position: number;
    onSelect: (position: number) => void;
  }

  const { index, position, onSelect }: Props = $props();

  const slots = Array.from(
    { length: MAX_POS - MIN_POS + 1 },
    (_, i) => MIN_POS + i,
  );
</script>

<div
  class="plate-row"
  role="radiogroup"
  aria-label={m.plate_name({ n: index + 1 })}
>
  {#each slots as value (value)}
    <PinSlot
      {value}
      active={value === position}
      isGoal={value === GOAL_POS}
      {onSelect}
    />
  {/each}
</div>

<style>
  .plate-row {
    display: flex;
    gap: 0.4rem;
  }
</style>
