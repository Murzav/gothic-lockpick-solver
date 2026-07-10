<script lang="ts">
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { decode } from "$lib/entities/lock/lib/share-codec";
  import {
    historyStore,
    type HistoryEntry,
  } from "../model/history-store.svelte";
  import { m } from "$lib/paraglide/messages.js";

  interface Props {
    /** Route glue: decode the code, hydrate the lock and re-solve. Kept as a
     * callback so this feature never reaches up into solve-lock itself. */
    onrestore: (code: string) => void;
  }

  const { onrestore }: Props = $props();

  const entries = $derived(historyStore.ordered);

  // Bound so the section can stay mounted, showing the empty note, if the
  // visitor deletes the last row while it is open — instead of vanishing
  // mid-interaction. When empty and closed it renders nothing at all.
  let open = $state(false);

  // Which row is mid-rename / one tap from deletion. Tracked by id, not by a
  // per-row flag, so re-ordering (a pin, a re-solve) can never strand the state
  // on the wrong row.
  let editingId = $state<string | null>(null);
  let editValue = $state("");
  let confirmingDeleteId = $state<string | null>(null);

  // Locale is fixed for the page's lifetime (switching reloads), so one
  // formatter is enough; short date keeps the meta line terse.
  const dateFormat = new Intl.DateTimeFormat(getLocale(), {
    dateStyle: "short",
  });

  function metaOf(entry: HistoryEntry): string {
    const decoded = decode(entry.code);
    const date = dateFormat.format(new Date(entry.savedAt));
    if ("error" in decoded) return date;
    return m.history_entry_label({ plates: decoded.plateCount }) + " · " + date;
  }

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  function startRename(entry: HistoryEntry): void {
    confirmingDeleteId = null;
    editingId = entry.id;
    editValue = entry.name ?? "";
  }

  function onRenameKey(event: KeyboardEvent, id: string): void {
    if (event.key === "Enter") {
      event.preventDefault();
      historyStore.rename(id, editValue);
      editingId = null;
    } else if (event.key === "Escape") {
      event.preventDefault();
      editingId = null;
    }
  }

  function onDeleteClick(id: string): void {
    // First tap arms the confirm, second tap removes — a two-step guard so a
    // stray click never destroys a saved lock outright.
    if (confirmingDeleteId === id) {
      historyStore.remove(id);
      confirmingDeleteId = null;
    } else {
      confirmingDeleteId = id;
    }
  }

  function resetDeleteConfirm(id: string): void {
    if (confirmingDeleteId === id) confirmingDeleteId = null;
  }
</script>

{#if entries.length > 0 || open}
  <details class="history" bind:open>
    <summary>{m.history_summary({ count: entries.length })}</summary>

    {#if entries.length === 0}
      <p class="history-empty">{m.history_empty()}</p>
    {:else}
      <ul class="history-list">
        {#each entries as entry (entry.id)}
          <li class="history-row">
            <button
              type="button"
              class="hist-pin"
              aria-label={entry.pinned ? m.history_unpin() : m.history_pin()}
              aria-pressed={entry.pinned}
              onclick={() => historyStore.togglePin(entry.id)}
            >
              {entry.pinned ? "★" : "☆"}
            </button>

            {#if editingId === entry.id}
              <input
                class="hist-input"
                type="text"
                value={editValue}
                placeholder={m.history_name_placeholder()}
                oninput={(e) => (editValue = e.currentTarget.value)}
                onkeydown={(e) => onRenameKey(e, entry.id)}
                onblur={() => (editingId = null)}
                use:focusOnMount
              />
            {:else}
              <button
                type="button"
                class="hist-restore"
                aria-label={m.history_restore_aria()}
                onclick={() => onrestore(entry.code)}
              >
                <span class="hist-title">{entry.name ?? metaOf(entry)}</span>
                {#if entry.name}
                  <span class="hist-meta">{metaOf(entry)}</span>
                {/if}
              </button>
            {/if}

            <button
              type="button"
              class="hist-action"
              aria-label={m.history_rename()}
              onclick={() => startRename(entry)}
            >
              {m.history_rename()}
            </button>

            <button
              type="button"
              class="hist-del"
              class:confirming={confirmingDeleteId === entry.id}
              aria-label={confirmingDeleteId === entry.id
                ? m.history_delete_confirm()
                : m.history_delete()}
              onclick={() => onDeleteClick(entry.id)}
              onblur={() => resetDeleteConfirm(entry.id)}
            >
              {confirmingDeleteId === entry.id
                ? m.history_delete_confirm()
                : "✕"}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </details>
{/if}

<style>
  /* Mirrors the .help details on the page so the two read as one family. */
  .history {
    color: var(--text-muted);
  }

  .history summary {
    cursor: pointer;
    color: var(--text);
    font-weight: 600;
  }

  .history-empty {
    margin: 0.75rem 0 0;
  }

  .history-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0.75rem 0 0;
    padding: 0;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .hist-pin,
  .hist-action,
  .hist-del {
    flex-shrink: 0;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
  }

  .hist-pin {
    padding: 0.25rem 0.3rem;
    font-size: 1rem;
  }

  .hist-pin[aria-pressed="true"] {
    color: var(--brass);
  }

  .hist-action,
  .hist-del {
    padding: 0.25rem 0.4rem;
  }

  .hist-pin:hover,
  .hist-action:hover,
  .hist-del:hover {
    color: var(--text);
  }

  .hist-del.confirming {
    color: var(--ember);
  }

  .hist-restore {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    text-align: left;
    padding: 0.25rem 0.3rem;
    color: var(--text);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .hist-restore:hover .hist-title {
    color: var(--brass);
  }

  .hist-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hist-meta {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .hist-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.25rem 0.4rem;
  }
</style>
