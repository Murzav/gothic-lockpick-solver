<script lang="ts">
  import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
  import { announceStep } from "$lib/features/solve-lock/lib/announce";
  import { speechLangs } from "$lib/features/solve-lock/lib/tts";
  import { speaker } from "$lib/shared/lib/speech";
  import Card from "$lib/shared/ui/Card.svelte";
  import SegButton from "$lib/shared/ui/SegButton.svelte";
  import { m } from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime.js";

  const rateOptions: { value: number; label: string }[] = [
    { value: 0.75, label: m.voice_rate_slow() },
    { value: 0.9, label: m.voice_rate_normal() },
    { value: 1.1, label: m.voice_rate_fast() },
  ];

  // Whether a voice exists for the current language chain, kept reactive so the
  // "no voice" hint appears once late-loading voices settle (or never do).
  let hasVoice = $state(false);
  $effect(() => {
    const refresh = () => {
      hasVoice = speaker.hasVoiceFor(speechLangs(getLocale()));
    };
    refresh();
    return speaker.onVoicesChanged(refresh);
  });

  function onVoiceToggle(enabled: boolean): void {
    // The checkbox click is the user gesture that unlocks speech on iOS/Chrome,
    // so speak the current step at once to confirm the change by ear. Guard on
    // `active`: with an empty grouped, index 0 === grouped.length, which would
    // speak the Done phrase ("Lock open") before any solve exists.
    if (enabled) {
      if (playbackStore.active) announceStep(playbackStore.stepIndex);
    } else {
      speaker.cancel();
    }
  }

  function onRateSelect(rate: number): void {
    playbackStore.voiceRate = rate;
    // Let the new speed be heard immediately, but only when it is audible: voice
    // on and a solution on screen (same Done-phrase guard as the toggle).
    if (playbackStore.voiceEnabled && playbackStore.active) {
      announceStep(playbackStore.stepIndex);
    }
  }
</script>

{#if speaker.supported}
  <Card title={m.voice_title()}>
    <div class="voice-settings">
      <label class="voice-toggle">
        <input
          type="checkbox"
          bind:checked={playbackStore.voiceEnabled}
          onchange={(e) => onVoiceToggle(e.currentTarget.checked)}
        />
        {m.playback_voice()}
      </label>

      <div class="field">
        <span class="field-label mono">{m.voice_rate_label()}</span>
        <div class="seg-row" role="group" aria-label={m.voice_rate_label()}>
          {#each rateOptions as option (option.value)}
            <SegButton
              value={option.value}
              label={option.label}
              active={playbackStore.voiceRate === option.value}
              onSelect={onRateSelect}
            />
          {/each}
        </div>
      </div>

      {#if playbackStore.voiceEnabled && !hasVoice}
        <p class="voice-hint">{m.playback_voice_unavailable()}</p>
      {/if}
    </div>
  </Card>
{/if}

<style>
  .voice-settings {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .voice-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text);
    cursor: pointer;
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

  .voice-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
</style>
