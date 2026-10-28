import type { Match, Stream, Schedule } from "./streams.functions";
import { SOURCE_CATALOG, type SourceCode } from "./source-catalog";

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

export async function alternateSchedule(source: SourceCode): Promise<Schedule> {
  if (source === "pit") {
    const response = await readSource<{ data: { live: PitProgram[]; upcoming: PitProgram[] } }>(`${SOURCE_CATALOG.pit.url}/api/v1/live-now`);
    return { live: response.data.live.map(pitMatch), upcoming: response.data.upcoming.map(pitMatch) };
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
  throw new Error("Source player unavailable");
}