import type { Match, Stream, Schedule } from "./streams.functions";
import { SOURCE_CATALOG, type SourceCode } from "./source-catalog";
import { load } from "cheerio/slim";

const cache = new Map<string, { at: number; data: unknown }>();
export async function readSource<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 45_000) return hit.data as T;
  const response = await fetch(url, { headers: { accept: "application/json, text/html" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Source unavailable");
  const data = response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text();
  if (cache.size > 200) cache.clear();
  cache.set(url, { at: Date.now(), data });
  return data as T;
}

type PitProgram = { programId: number; titleText: string; subtitle?: string; sessionStart?: number; background?: string; footer?: string; competitionSlug?: string };
const pitMatch = (program: PitProgram): Match => ({
  id: String(program.programId), title: program.titleText + (program.subtitle ? ` · ${program.subtitle}` : ""),
  category: program.footer ?? program.competitionSlug ?? "Sports", date: (program.sessionStart ?? 0) * 1000,
  poster: program.background?.replace(/^http:/, "https:") ?? null, sources: [{ source: "pit", id: String(program.programId) }],
});

type PPVStream = { id: number; name: string; category_name: string; poster?: string; starts_at: number; ends_at: number; always_live: number; iframe: string; locale?: string; viewers?: string | number };
async function ppvRows() {
  const response = await readSource<{ streams: { streams: PPVStream[] }[] }>("https://api.ppv.st/api/streams");
  return response.streams.flatMap((category) => category.streams).filter((stream) => stream.iframe);
}
const ppvMatch = (stream: PPVStream): Match => ({ id: String(stream.id), title: stream.name, category: stream.category_name, date: stream.always_live ? Date.now() : stream.starts_at * 1000, poster: stream.poster ?? null, sources: [{ source: "ppv", id: String(stream.id) }] });

type DaddyEvent = { match: Match; paths: string[]; live: boolean };
async function daddyRows(): Promise<DaddyEvent[]> {
  const [html, extra] = await Promise.all([
    readSource<string>(`${SOURCE_CATALOG.daddy.url}/`),
    readSource<{ html: string }>(`${SOURCE_CATALOG.daddy.url}/schedule-api.php?source=extra_sports`).catch(() => ({ html: "" })),
  ]);
  const $ = load(html + extra.html);
  const rows: DaddyEvent[] = [];
  $(".schedule__event").each((_, element) => {
    const event = $(element);
    const title = event.find(".schedule__eventTitle").text().trim();
    const paths = event.find(".schedule__channels a[href]").toArray().map((link) => $(link).attr("href") ?? "").map((href) => {
      try { const url = new URL(href, SOURCE_CATALOG.daddy.url); return url.origin === SOURCE_CATALOG.daddy.url && /^\/watch[\w]*\.php$/.test(url.pathname) && url.searchParams.get("id") !== "00" ? url.pathname + url.search : ""; } catch { return ""; }
    }).filter(Boolean);
    if (!title || !paths.length) return;
    const dayLabel = event.closest(".schedule__day").find(".schedule__dayTitle").first().text();
    const day = dayLabel.match(/\d{1,2}(?:st|nd|rd|th|h)?\s+[A-Za-z]+\s+\d{4}/)?.[0].replace(/(\d)(st|nd|rd|th|h)/, "$1");
    const time = event.find(".schedule__time").attr("data-time") ?? "00:00";
    const date = day ? Date.parse(`${day} ${time}:00 GMT`) : 0;
    const category = event.closest(".schedule__category").find(".card__meta").first().text().trim() || "Sports";
    const stamp = Number.isFinite(date) ? date : 0;
    // Event-specific identity avoids using shared TV-channel IDs as game IDs.
    const id = `${encodeURIComponent(title).replace(/[^\w.-]/g, "_").slice(0, 160)}-${stamp}`;
    const now = Date.now();
    rows.push({ match: { id, title, category, date: stamp, sources: [{ source: "daddy", id }] }, paths: [...new Set(paths)], live: category === "LIVE NOW" || (now >= stamp - 600_000 && now <= stamp + 21_600_000) });
  });
  return rows;
}

type TimEvent = { url: string; name: string; genre: number; time?: string; logo?: string; isevent?: boolean; vip?: boolean; viewers?: number; streams?: { name: string; url: string; vip?: boolean }[] };
async function timRows() {
  return readSource<{ events: TimEvent[]; genres?: { id: number; name: string }[] }>(`${SOURCE_CATALOG.tim.url}/api/live-upcoming`);
}
const timDate = (event: TimEvent) => {
  if (!event.time) return Date.now();
  if (/[Zz]|[+-]\d\d:\d\d$/.test(event.time)) return Date.parse(event.time);
  const utc = Date.parse(`${event.time}Z`);
  if (!Number.isFinite(utc)) return 0;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "longOffset" }).formatToParts(new Date(utc));
  const offset = parts.find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") || "-05:00";
  return Date.parse(event.time + offset);
};
const timMatch = (event: TimEvent, genres: { id: number; name: string }[]): Match => ({ id: event.url, title: event.name, category: genres.find((g) => g.id === event.genre)?.name ?? "Sports", date: timDate(event), poster: event.logo ?? null, sources: [{ source: "tim", id: event.url }] });

export async function alternateSchedule(source: SourceCode): Promise<Schedule> {
  if (source === "pit") {
    const response = await readSource<{ data: { live: PitProgram[]; upcoming: PitProgram[] } }>(`${SOURCE_CATALOG.pit.url}/api/v1/live-now`);
    return { live: response.data.live.map(pitMatch), upcoming: response.data.upcoming.map(pitMatch) };
  }
  if (source === "ppv") {
    const now = Date.now() / 1000;
    const rows = await ppvRows();
    return { live: rows.filter((r) => r.always_live || (r.starts_at <= now && r.ends_at > now)).map(ppvMatch), upcoming: rows.filter((r) => !r.always_live && r.starts_at > now).sort((a, b) => a.starts_at - b.starts_at).map(ppvMatch) };
  }
  if (source === "daddy") {
    const rows = await daddyRows();
    return { live: rows.filter((r) => r.live).map((r) => r.match), upcoming: rows.filter((r) => !r.live && r.match.date > Date.now()).sort((a, b) => a.match.date - b.match.date).map((r) => r.match) };
  }
  if (source === "tim") {
    const response = await timRows();
    const now = Date.now();
    const rows = response.events.filter((event) => !event.vip);
    return { live: rows.filter((event) => !event.isevent || timDate(event) <= now).map((event) => timMatch(event, response.genres ?? [])), upcoming: rows.filter((event) => event.isevent && timDate(event) > now).sort((a, b) => timDate(a) - timDate(b)).map((event) => timMatch(event, response.genres ?? [])) };
  }
  throw new Error("Source listings unavailable");
}

export async function alternateEvent(source: SourceCode, id: string): Promise<{ title: string | null; category: string | null; streams: Stream[] }> {
  if (source === "pit") {
    const response = await readSource<{ data: { program: PitProgram & { cardFooter?: string }; videos: { embedUrl: string; allowed?: boolean; label?: string }[] } }>(`${SOURCE_CATALOG.pit.url}/api/v1/programs/${encodeURIComponent(id)}/play`);
    return {
      title: pitMatch(response.data.program).title, category: response.data.program.cardFooter ?? "Sports",
      streams: response.data.videos.filter((video) => video.allowed !== false && /^https:\/\//.test(video.embedUrl)).map((video, index) => ({ id, source, streamNo: index + 1, embedUrl: video.embedUrl, language: video.label ?? "Live", hd: false, viewers: 0 })),
    };
  }
  if (source === "ppv") {
    const row = (await ppvRows()).find((stream) => String(stream.id) === id);
    return { title: row?.name ?? null, category: row?.category_name ?? null, streams: row && /^https:\/\//.test(row.iframe) ? [{ id, source, streamNo: 1, embedUrl: row.iframe, language: row.locale ?? "Live", hd: false, viewers: Number(row.viewers) || 0 }] : [] };
  }
  if (source === "daddy") {
    const row = (await daddyRows()).find((event) => event.match.id === id);
    if (!row) return { title: null, category: null, streams: [] };
    const embeds = await Promise.all(row.paths.map(async (path) => {
      try {
        const html = await readSource<string>(SOURCE_CATALOG.daddy.url + path);
        const $ = load(html);
        const src = $("iframe#playerFrame").attr("src") ?? $("iframe").first().attr("src");
        if (!src) return null;
        const url = new URL(src, SOURCE_CATALOG.daddy.url);
        return url.protocol === "https:" ? url.href : null;
      } catch { return null; }
    }));
    return { title: row.match.title, category: row.match.category, streams: embeds.filter((url): url is string => Boolean(url)).map((embedUrl, index) => ({ id, source, streamNo: index + 1, embedUrl, language: "Live", hd: false, viewers: 0 })) };
  }
  if (source === "tim") {
    const response = await readSource<{ item: TimEvent }>(`${SOURCE_CATALOG.tim.url}/api/watch/${encodeURIComponent(id)}`);
    const item = response.item;
    return { title: item.name, category: "Sports", streams: item.vip ? [] : (item.streams ?? []).filter((stream) => !stream.vip && /^https:\/\//.test(stream.url)).map((stream, index) => ({ id, source, streamNo: index + 1, embedUrl: stream.url, language: stream.name, hd: false, viewers: index === 0 ? item.viewers ?? 0 : 0 })) };
  }
  throw new Error("Source player unavailable");
}