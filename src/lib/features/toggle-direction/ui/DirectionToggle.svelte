<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import Toggle from "$lib/shared/ui/Toggle.svelte";
  import type { DirectionConvention } from "$lib/entities/lock/model/types";
  import { m } from "$lib/paraglide/messages.js";

  const options: { value: DirectionConvention; label: string }[] = [
    { value: "right-increases", label: m.direction_right_increases() },
    { value: "right-decreases", label: m.direction_right_decreases() },
  ];
</script>

<Toggle
  {options}
  value={lockStore.convention}
  onChange={(v) => lockStore.setConvention(v)}
/>
