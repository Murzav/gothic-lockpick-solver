<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "primary" | "secondary";
    disabled?: boolean;
    onclick?: () => void;
    children: Snippet;
  }

  const {
    variant = "primary",
    disabled = false,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  type="button"
  class="btn"
  class:secondary={variant === "secondary"}
  {disabled}
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--bg);
    background: var(--ember);
    border: 1px solid var(--ember);
    border-radius: 6px;
    padding: 0.55rem 1.1rem;
    cursor: pointer;
    transition:
      opacity var(--transition-fast),
      background var(--transition-fast);
  }

  .btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn.secondary {
    color: var(--text);
    background: transparent;
    border-color: var(--border);
  }

  .btn.secondary:hover:not(:disabled) {
    border-color: var(--brass);
  }
</style>
