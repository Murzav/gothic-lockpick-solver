<script lang="ts">
  import SegButton from "$lib/shared/ui/SegButton.svelte";
  import { COUPLING_OPTIONS } from "$lib/features/edit-connections/lib/coupling-options";

  interface Props {
    label: string;
    value: number;
    onChange: (value: number) => void;
  }

  const { label, value, onChange }: Props = $props();
</script>

<div class="connection-arrows" role="group" aria-label={label}>
  {#each COUPLING_OPTIONS as option (option.value)}
    <SegButton
      value={option.value}
      label={option.label}
      active={value === option.value}
      tone={option.tone}
      onSelect={onChange}
    />
  {/each}
</div>

<style>
  .connection-arrows {
    display: flex;
    gap: 0.15rem;
  }
</style>
