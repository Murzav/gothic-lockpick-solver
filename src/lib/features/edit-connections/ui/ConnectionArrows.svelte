<script lang="ts">
  import SegButton from "$lib/shared/ui/SegButton.svelte";

  interface Props {
    label: string;
    value: number;
    onChange: (value: number) => void;
  }

  const { label, value, onChange }: Props = $props();

  const options = [
    { value: -1, label: "←" },
    { value: 0, label: "0" },
    { value: 1, label: "→" },
  ];
</script>

<div class="connection-arrows" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <SegButton
      value={option.value}
      label={option.label}
      active={value === option.value}
      tone={option.value === 0 ? "neutral" : "accent"}
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
