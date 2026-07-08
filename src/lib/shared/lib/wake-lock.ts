import { browser } from "$app/environment";

/**
 * Screen Wake Lock helper: keeps the display awake while the caller holds it,
 * re-acquiring after the tab is hidden then shown again, and releasing on
 * teardown. Feature-detected — a silent no-op where the API (or a browser) is
 * unavailable, so callers never branch on support.
 */
export function createWakeLock(): { acquire: () => Promise<void>; release: () => void } {
  let sentinel: WakeLockSentinel | null = null;
  let held = false;

  const supported = browser && typeof navigator !== "undefined" && "wakeLock" in navigator;

  async function request(): Promise<void> {
    if (!supported || sentinel) return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => {
        sentinel = null;
      });
    } catch {
      // no user gesture / permission denied — stay silent
      sentinel = null;
    }
  }

  function onVisibility(): void {
    if (held && document.visibilityState === "visible") void request();
  }

  async function acquire(): Promise<void> {
    if (!supported) return;
    held = true;
    document.addEventListener("visibilitychange", onVisibility);
    await request();
  }

  function release(): void {
    if (!supported) return;
    held = false;
    document.removeEventListener("visibilitychange", onVisibility);
    void sentinel?.release();
    sentinel = null;
  }

  return { acquire, release };
}
