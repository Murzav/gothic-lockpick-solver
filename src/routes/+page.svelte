<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import { decode } from "$lib/entities/lock/lib/share-codec";
  import { PLATE_MAX, PLATE_MIN } from "$lib/shared/config";
  import Card from "$lib/shared/ui/Card.svelte";
  import Toggle from "$lib/shared/ui/Toggle.svelte";
  import SegButton from "$lib/shared/ui/SegButton.svelte";
  import Button from "$lib/shared/ui/Button.svelte";
  import DirectionToggle from "$lib/features/toggle-direction/ui/DirectionToggle.svelte";
  import LockBoard from "$lib/widgets/lock-board/LockBoard.svelte";
  import LockForm from "$lib/widgets/lock-form/LockForm.svelte";
  import SolveButton from "$lib/features/solve-lock/ui/SolveButton.svelte";
  import ResultPanel from "$lib/features/solve-lock/ui/ResultPanel.svelte";
  import PlaybackBar from "$lib/features/solve-lock/ui/PlaybackBar.svelte";
  import VoiceSettings from "$lib/features/solve-lock/ui/VoiceSettings.svelte";
  import CopyShareLink from "$lib/features/share-lock/ui/CopyShareLink.svelte";
  import HistorySection from "$lib/features/lock-history/ui/HistorySection.svelte";
  import { solveCurrentLock } from "$lib/features/solve-lock/model/solve-current-lock";
  import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
  import { historyStore } from "$lib/features/lock-history/model/history-store.svelte";
  import { m } from "$lib/paraglide/messages.js";

  const following = $derived(playbackStore.followBoard && playbackStore.active);

  // A failed import surfaces here; the visitor's own lock is never touched on
  // failure, only this note appears.
  let importError = $state<"invalid" | "version" | null>(null);

  // Dismiss the note once the visitor runs the solver — by then they have moved
  // on and a stale "damaged link" warning would only be noise.
  $effect(() => {
    if (lockStore.solving && importError) importError = null;
  });

  /**
   * Before an imported link overwrites the board, keep the visitor's own lock in
   * history — but only if they had actually entered something. A pristine board
   * (every plate still at 1, no couplings) carries no work worth preserving, and
   * saving it would just clutter the list with an empty default. Plate count and
   * the direction convention are not "content" on their own, matching what a
   * reset treats as a preference rather than lock data.
   */
  function snapshotBeforeImport(): void {
    const hasContent =
      lockStore.positions.some((p) => p !== 1) ||
      lockStore.coupling.some((row) => row.some((c) => c !== 0));
    if (hasContent) historyStore.snapshotCurrent();
  }

  /**
   * Route glue for the history list: decode the saved code, hydrate the lock the
   * same way an imported link does, and re-solve. Restoring is a solve, so the
   * result-watch files it back to the top of history automatically — same path
   * as import, no feature reaching into solve-lock.
   */
  function restoreFromHistory(code: string): void {
    const result = decode(code);
    if ("error" in result) return; // our own codes decode; guard defensively
    lockStore.hydrate({ ...result, viewMode: lockStore.viewMode });
    void solveCurrentLock();
  }

  async function importFromHash(): Promise<void> {
    const match = /^#l=(.+)$/.exec(location.hash);
    if (!match) return;

    const result = decode(match[1]);
    // Always strip the fragment afterwards: never assign location.hash (that
    // pushes history and can re-fire the import) — replaceState edits in place.
    const cleanUrl = location.pathname + location.search;
    if ("error" in result) {
      importError = result.error;
      history.replaceState(null, "", cleanUrl);
      return;
    }

    snapshotBeforeImport();
    // hydrate's defensive shape matches the decoded lock; keep the visitor's
    // current view rather than forcing one from the link.
    lockStore.hydrate({ ...result, viewMode: lockStore.viewMode });
    await solveCurrentLock();
    history.replaceState(null, "", cleanUrl);
  }

  onMount(() => {
    if (browser) void importFromHash();
  });

  const viewOptions: { value: "board" | "form"; label: string }[] = [
    { value: "board", label: m.view_board() },
    { value: "form", label: m.view_table() },
  ];
  const plateCounts = Array.from(
    { length: PLATE_MAX - PLATE_MIN + 1 },
    (_, i) => PLATE_MIN + i,
  );
</script>

<div class="page" class:bar-active={playbackStore.active}>
  <header class="hero">
    <svg
      class="hero-icon"
      width="44"
      height="44"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 22V15C14 9.477 18.477 5 24 5C29.523 5 34 9.477 34 15V22"
        stroke="var(--ember)"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <rect
        x="9"
        y="22"
        width="30"
        height="21"
        rx="3"
        fill="var(--surface)"
        stroke="var(--ember)"
        stroke-width="2.5"
      />
      <path
        d="M18 30h4M26 30h4"
        stroke="var(--brass)"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="24" cy="35" r="2.2" fill="var(--brass)" />
    </svg>
    <h1>{m.app_title()}</h1>
    <p>{m.app_tagline()}</p>
  </header>

  <div class="workbench">
    <aside class="col-reference">
      <Card title={m.convention_title()}>
        <p class="hint">{m.convention_intro()}</p>
        <ul class="convention-list">
          <li>
            <strong>{m.convention_plate1_label()}</strong>
            {m.convention_plate1_body()}
          </li>
          <li>
            <strong>{m.convention_side_label()}</strong>
            {m.convention_side_body()}
          </li>
          <li>
            <strong>{m.convention_goal_label()}</strong>
            {m.convention_goal_body()}
          </li>
        </ul>
        <div class="convention-toggle">
          <p class="hint">
            <strong>{m.direction_intro_label()}</strong>
            {m.direction_intro_body()}
          </p>
          <DirectionToggle disabled={following} />
          <p class="hint">{m.direction_hint()}</p>
        </div>
      </Card>

      <VoiceSettings />
    </aside>

    <main class="col-tool">
      {#if importError}
        <div class="import-note" role="status">
          <span>
            {importError === "version"
              ? m.share_import_version()
              : m.share_import_invalid()}
          </span>
          <button
            type="button"
            class="import-dismiss"
            aria-label={m.share_import_dismiss()}
            onclick={() => (importError = null)}
          >
            ✕
          </button>
        </div>
      {/if}

      <Card title={m.lock_title()}>
        <p class="hint">{m.lock_intro()}</p>
        <div class="controls">
          <div class="field">
            <span class="field-label mono">{m.field_plate_count()}</span>
            <div
              class="seg-row"
              role="group"
              aria-label={m.field_plate_count()}
            >
              {#each plateCounts as n (n)}
                <SegButton
                  value={n}
                  label={String(n)}
                  active={lockStore.plateCount === n}
                  onSelect={(v) => lockStore.setPlateCount(v)}
                  disabled={following}
                />
              {/each}
            </div>
          </div>
          <div class="field">
            <span class="field-label mono">{m.field_view()}</span>
            <Toggle
              options={viewOptions}
              value={lockStore.viewMode}
              onChange={(v) => lockStore.setViewMode(v)}
            />
          </div>
        </div>
        {#if lockStore.viewMode === "board"}
          <LockBoard />
        {:else}
          <LockForm disabled={following} />
        {/if}
      </Card>

      <div class="actions">
        <SolveButton />
        <Button variant="secondary" onclick={() => lockStore.reset()}>
          {m.action_reset()}
        </Button>
        <CopyShareLink />
      </div>

      <ResultPanel />

      <PlaybackBar />

      <details class="help">
        <summary>{m.help_summary()}</summary>
        <ol>
          <li>{m.help_step1()}</li>
          <li>{m.help_step2()}</li>
          <li>{m.help_step3()}</li>
          <li>{m.help_step4()}</li>
          <li>{m.help_step5()}</li>
          <li>{m.help_step6()}</li>
        </ol>
      </details>

      <HistorySection onrestore={restoreFromHistory} />
    </main>
  </div>
</div>

<style>
  .page {
    max-width: 66rem;
    margin: 0 auto;
    padding: 2.5rem 1.25rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  /* Reserve space so the fixed playback bar never covers the last controls. */
  .page.bar-active {
    padding-bottom: 7rem;
  }

  /* Single column on phones; a reference/tool split once there's room, so a
     16" laptop uses its width instead of a lonely centre strip. */
  .workbench {
    display: grid;
    gap: 1.25rem;
    align-items: start;
  }

  @media (min-width: 60rem) {
    .workbench {
      grid-template-columns: minmax(18rem, 21rem) minmax(0, 1fr);
      gap: 2rem;
    }

    /* Reference stays in view while you work the tool on the right. */
    .col-reference {
      position: sticky;
      top: 1.5rem;
    }
  }

  .col-reference,
  .col-tool {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }

  .hero {
    text-align: center;
    padding: 0.25rem 0 0.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .hero h1 {
    margin: 0;
    font-size: 1.6rem;
  }

  .hero p {
    max-width: 42ch;
    margin: 0;
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .hint {
    margin: 0 0 0.75rem;
    color: var(--text-muted);
  }

  .convention-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    padding-left: 1.25rem;
  }

  .convention-toggle {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    margin-bottom: 1.1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .field-label {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .seg-row {
    display: flex;
    gap: 0.3rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .import-note {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.85rem;
    border: 1px solid var(--border);
    border-left: 3px solid var(--ember);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.9rem;
  }

  .import-note span {
    flex: 1;
  }

  .import-dismiss {
    flex-shrink: 0;
    padding: 0.1rem 0.4rem;
    color: var(--text-muted);
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 0.9rem;
    line-height: 1;
    cursor: pointer;
  }

  .import-dismiss:hover {
    color: var(--text);
  }

  .help {
    color: var(--text-muted);
  }

  .help summary {
    cursor: pointer;
    color: var(--text);
    font-weight: 600;
  }

  .help ol {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
  }
</style>
