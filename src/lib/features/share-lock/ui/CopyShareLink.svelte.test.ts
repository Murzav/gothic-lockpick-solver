import { render } from "vitest-browser-svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import { decode } from "$lib/entities/lock/lib/share-codec";
import CopyShareLink from "./CopyShareLink.svelte";

// Headless chromium exposes navigator.clipboard through the prototype, so a
// configurable own property shadows it with a controllable stub and a delete
// restores the real one — no test leaks a fake clipboard to the next file.
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("CopyShareLink", () => {
  beforeEach(() => {
    lockStore.reset();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  it("copies a decodable #l= share URL and shows the copied status", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const screen = render(CopyShareLink);

    await screen.getByRole("button", { name: "Copy link" }).click();

    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0]![0];
    expect(url).toContain("#l=");

    // The fragment round-trips to the current lock, not just any string.
    const decoded = decode(url.split("#l=")[1]!);
    expect(decoded).toEqual({
      plateCount: 5,
      positions: [1, 1, 1, 1, 1],
      coupling: Array.from({ length: 5 }, () => Array(5).fill(0)),
      convention: "right-increases",
    });

    await expect.element(screen.getByRole("status")).toHaveTextContent("Link copied");
  });

  it("falls back to a selectable field carrying the URL when the write is rejected", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error("denied"));
    stubClipboard(writeText);
    const screen = render(CopyShareLink);

    await screen.getByRole("button", { name: "Copy link" }).click();

    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Couldn't copy — select the link below");

    const input = screen.getByRole("textbox", { name: "Copy link" });
    await expect.element(input).toBeVisible();
    const value = (input.element() as HTMLInputElement).value;
    expect(value).toContain("#l=");
  });
});
