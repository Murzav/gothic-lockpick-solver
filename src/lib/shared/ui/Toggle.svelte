<script lang="ts" generics="T">
  interface Option<T> {
    value: T;
    label: string;
  }

  interface Props {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
  }

  const { options, value, onChange }: Props = $props();
</script>

<div class="toggle" role="radiogroup">
  {#each options as option (option.value)}
    <button
      type="button"
      class="toggle-option"
      class:active={option.value === value}
      role="radio"
      aria-checked={option.value === value}
      onclick={() => onChange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .toggle {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .toggle-option {
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast);
  }

  .toggle-option:hover {
    color: var(--text);
  }

  .toggle-option.active {
    color: var(--bg);
    background: var(--brass);
  }
</style>
