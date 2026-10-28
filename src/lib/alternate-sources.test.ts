import { test } from "node:test";
import { strict as assert } from "node:assert";
import { alternateSchedule, alternateEvent } from "./alternate-sources.server";

test("source-specific listings and players never substitute another provider", async () => {
  const original = globalThis.fetch;
  const now = Date.now();
  const fixtures: Record<string, unknown> = {
    "https://timst.top/api/live-upcoming": { events: [{ url: "tim-game", name: "Tim Game", genre: 7, isevent: false, streams: [{ name: "Tim", url: "https://tim-player.example/embed" }] }] },
    "https://timst.top/api/watch/tim-game": { item: { name: "Tim Game", streams: [{ name: "Tim", url: "https://tim-player.example/embed" }] } },
    "https://pitsport.st/api/v1/live-now": { data: { live: [{ programId: 123, titleText: "Pit Game" }], upcoming: [] } },
    "https://pitsport.st/api/v1/programs/123/play": { data: { program: { programId: 123, titleText: "Pit Game" }, videos: [{ embedUrl: "https://pit-player.example/embed", allowed: true }] } },
    "https://api.ppv.st/api/streams": { streams: [{ streams: [{ id: 456, name: "PPV Game", category_name: "Sports", always_live: 1, iframe: "https://ppv-player.example/embed" }] }] },
    "https://thedaddy.pk/": `<div class="schedule__day"><div class="schedule__dayTitle">${new Date(now).getUTCDate()} October 2026</div><div class="schedule__category"><div class="card__meta">LIVE NOW</div><div class="schedule__event"><span class="schedule__eventTitle">Daddy Game</span><div class="schedule__channels"><a href="/watch.php?id=789">Channel</a></div></div></div></div>`,
    "https://thedaddy.pk/schedule-api.php?source=extra_sports": { html: "" },
    "https://thedaddy.pk/watch.php?id=789": '<iframe id="playerFrame" src="https://daddy-player.example/embed"></iframe>',
  };
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.ok(Object.hasOwn(fixtures, url), `Unexpected provider request: ${url}`);
    const fixture = fixtures[url];
    return new Response(typeof fixture === "string" ? fixture : JSON.stringify(fixture), { headers: { "content-type": typeof fixture === "string" ? "text/html" : "application/json" } });
  };
  try {
    for (const source of ["tim", "pit", "daddy", "ppv"] as const) {
      const schedule = await alternateSchedule(source);
      assert.equal(schedule.live.length, 1);
      const event = schedule.live[0];
      assert.ok(event);
      assert.equal(event.sources[0]?.source, source);
      const player = await alternateEvent(source, event.id);
      assert.equal(player.title, event.title);
      assert.equal(player.streams[0]?.source, source);
      assert.equal(player.streams[0]?.embedUrl, `https://${source}-player.example/embed`);
    }
  } finally { globalThis.fetch = original; }
});