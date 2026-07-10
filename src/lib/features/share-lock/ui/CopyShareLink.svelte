<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy } from "svelte";
  import { encode } from "$lib/entities/lock/lib/share-codec";
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import Button from "$lib/shared/ui/Button.svelte";
  import { m } from "$lib/paraglide/messages.js";

  // Long enough to read the acknowledgement, short enough that the button does
  // not wear a permanent "copied" label.
  const CLEAR_DELAY_MS = 2500;

  let status = $state<"idle" | "copied" | "failed">("idle");
  let shareUrl = $state("");
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  function buildUrl(): string {
    // `serialize()` is the store's own plain snapshot; encode reads only the
    // codec fields and ignores the extra viewMode it carries.
    const code = encode(lockStore.serialize());
    return location.origin + location.pathname + "#l=" + code;
  }

  async function copy(): Promise<void> {
    if (!browser) return;
    const url = buildUrl();
    shareUrl = url;
    try {
      await navigator.clipboard.writeText(url);
      status = "copied";
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        status = "idle";
      }, CLEAR_DELAY_MS);
    } catch {
      // Clipboard writes are refused in insecure contexts or on denied
      // permission. Surface the URL in a field so the link is never trapped.
      status = "failed";
      clearTimeout(clearTimer);
    }
  }

  function onCopy(): void {
    void copy();
  }

  function selectAll(event: FocusEvent): void {
    (event.currentTarget as HTMLInputElement).select();
  }

  onDestroy(() => clearTimeout(clearTimer));
</script>

<div class="share">
  <Button variant="secondary" onclick={onCopy}>{m.share_copy_link()}</Button>
  {#if status === "copied"}
    <span class="status" role="status">{m.share_copied()}</span>
  {:else if status === "failed"}
    <span class="status status-error" role="status"
      >{m.share_copy_failed()}</span
    >
    <input
      class="fallback"
      type="text"
      readonly
      value={shareUrl}
      aria-label={m.share_copy_link()}
      onfocus={selectAll}
    />
  {/if}
</div>

<style>
  .share {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }

  .status {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .status-error {
    color: var(--ember);
  }

  .fallback {
    width: min(18rem, 70vw);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
  }
</style>
