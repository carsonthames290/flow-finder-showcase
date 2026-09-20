import { createServerFn } from "@tanstack/react-start";

const BASE = "https://streamed.pk";

export type Source = { source: string; id: string };
export type Match = {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string | null;
  popular?: boolean;
  teams?: {
    home?: { name: string; badge?: string } | null;
    away?: { name: string; badge?: string } | null;
  } | null;
  sources: Source[];
};
export type Stream = {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
  viewers: number;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Upstream request failed [${res.status}]: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const listLiveMatches = createServerFn({ method: "GET" }).handler(async () => {
  const matches = await get<Match[]>("/api/matches/live");
  return matches.filter((m) => m.sources?.length > 0);
});

export const listStreams = createServerFn({ method: "GET" })
  .inputValidator((input: { source: string; id: string }) => {
    const safe = /^[\w.-]+$/;
    if (!safe.test(input.source) || !safe.test(input.id)) {
      throw new Error("Invalid stream reference");
    }
    return input;
  })
  .handler(async ({ data }) =>
    get<Stream[]>(`/api/stream/${encodeURIComponent(data.source)}/${encodeURIComponent(data.id)}`),
  );

/**
 * All playable streams for the event, across every mirror/source the upstream
 * site lists — used so a dead stream can auto-fail over to a working one.
 */
export const listAllStreamsForEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { source: string; id: string }) => {
    const safe = /^[\w.-]+$/;
    if (!safe.test(input.source) || !safe.test(input.id)) {
      throw new Error("Invalid stream reference");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const primary = await get<Stream[]>(
      `/api/stream/${encodeURIComponent(data.source)}/${encodeURIComponent(data.id)}`,
    ).catch(() => [] as Stream[]);

    let others: Stream[] = [];
    try {
      const matches = await get<Match[]>("/api/matches/live");
      const match = matches.find((m) =>
        m.sources?.some((s) => s.source === data.source && s.id === data.id),
      );
      const rest = (match?.sources ?? []).filter(
        (s) => !(s.source === data.source && s.id === data.id),
      );
      const results = await Promise.all(
        rest.map((s) =>
          get<Stream[]>(
            `/api/stream/${encodeURIComponent(s.source)}/${encodeURIComponent(s.id)}`,
          ).catch(() => [] as Stream[]),
        ),
      );
      others = results.flat();
    } catch {
      others = [];
    }

    const all = [...primary, ...others].filter((s) => Boolean(s?.embedUrl));
    const seen = new Set<string>();
    return all.filter((s) => (seen.has(s.embedUrl) ? false : (seen.add(s.embedUrl), true)));
  });


export const posterUrl = (poster?: string | null) =>
  poster ? `${BASE}${poster.startsWith("/") ? "" : "/"}${poster}` : null;

export const badgeUrl = (badge?: string) =>
  badge ? `${BASE}/api/images/badge/${badge}.webp` : null;
