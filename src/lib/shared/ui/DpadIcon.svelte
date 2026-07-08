<script lang="ts">
  interface Props {
    direction: "left" | "right";
    size?: number;
  }

  const { direction, size = 24 }: Props = $props();
</script>

<!-- Platform-neutral rounded d-pad: a dim full cross plus one brightened arm
     with an outward triangle, so the active direction is carried by shape, not
     hue alone. Always decorative — a localized direction word sits next to it. -->
<svg
  class="dpad"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    class="dpad-cross"
    d="M10 3 H14 Q16 3 16 5 V8 H19 Q21 8 21 10 V14 Q21 16 19 16 H16 V19 Q16 21 14 21 H10 Q8 21 8 19 V16 H5 Q3 16 3 14 V10 Q3 8 5 8 H8 V5 Q8 3 10 3 Z"
    fill="currentColor"
    opacity="0.35"
  />
  <g
    class="dpad-arm"
    transform={direction === "left" ? "translate(24 0) scale(-1 1)" : undefined}
  >
    <rect x="12" y="9" width="7" height="6" rx="2" fill="currentColor" />
    <path d="M18 7.5 L22.5 12 L18 16.5 Z" fill="currentColor" />
  </g>
</svg>

<style>
  .dpad {
    display: inline-block;
    vertical-align: middle;
    flex: none;
  }
</style>
