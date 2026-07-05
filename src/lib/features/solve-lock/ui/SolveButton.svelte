<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import { solveCurrentLock } from "$lib/features/solve-lock/model/solve-current-lock";
  import Button from "$lib/shared/ui/Button.svelte";
  import { m } from "$lib/paraglide/messages.js";
</script>

<Button disabled={lockStore.solving} onclick={() => solveCurrentLock()}>
  {lockStore.solving ? m.action_solving() : m.action_solve()}
</Button>
