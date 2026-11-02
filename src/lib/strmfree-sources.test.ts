import { test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeStrmFreeSources, strmFreeEventSources } from "./strmfree-sources";

test("StrmFree object links become real HTTPS player addresses with their quality", () => {
  assert.deepEqual(normalizeStrmFreeSources([
    { quality: "FHD", url: "https://strmfree.st/embed/football/chiefs1080p" },
    { quality: "SD", url: "https://strmfree.st/embed/football/chiefs540p" },
  ]), [
    { url: "https://strmfree.st/embed/football/chiefs1080p", hd: true },
    { url: "https://strmfree.st/embed/football/chiefs540p", hd: false },
  ]);
});

test("legacy string links continue to work", () => {
  assert.deepEqual(normalizeStrmFreeSources(["https://strmfree.st/embed/game720p"]), [
    { url: "https://strmfree.st/embed/game720p", hd: true },
  ]);
});

test("invalid entries never become relative object addresses or unsafe player URLs", () => {
  assert.deepEqual(normalizeStrmFreeSources([{}, null, 12, { url: {} }, "[object Object]", "/embed/game", "javascript:alert(1)", "http://example.com/embed", "https://user:pass@example.com/embed"]), []);
  assert.deepEqual(normalizeStrmFreeSources(undefined), []);
});

test("live links stay first and event-specific backups are preserved without duplicates", () => {
  assert.deepEqual(strmFreeEventSources({
    live_sources: [{ url: "https://strmfree.st/embed/game1080p", quality: "FHD" }],
    sources: [{ url: "https://strmfree.st/embed/game1080p" }, { url: "https://strmfree.st/embed/game540p", quality: "SD" }],
  }), [
    { url: "https://strmfree.st/embed/game1080p", hd: true },
    { url: "https://strmfree.st/embed/game540p", hd: false },
  ]);
});