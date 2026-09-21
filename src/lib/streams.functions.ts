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

const REQUEST_TIMEOUT_MS = 6000;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Upstream request failed [${res.status}]: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// Short-lived in-memory cache so repeated page loads don't re-hit the upstream
// listing endpoint (the slowest call in the chain).
const MATCHES_TTL_MS = 45_000;
let matchesCache: { at: number; data: Match[] } | undefined;

async function getLiveMatches(): Promise<Match[]> {
  if (matchesCache && Date.now() - matchesCache.at < MATCHES_TTL_MS) return matchesCache.data;
  const data = (await get<Match[]>("/api/matches/live")).filter((m) => m.sources?.length > 0);
  matchesCache = { at: Date.now(), data };
  return data;
}

const STREAMS_TTL_MS = 30_000;
const streamsCache = new Map<string, { at: number; data: Stream[] }>();

async function getStreams(source: string, id: string): Promise<Stream[]> {
  const key = `${source}/${id}`;
  const hit = streamsCache.get(key);
  if (hit && Date.now() - hit.at < STREAMS_TTL_MS) return hit.data;
  const data = await get<Stream[]>(
    `/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
  ).catch(() => [] as Stream[]);
  streamsCache.set(key, { at: Date.now(), data });
  return data;
}

const safeRef = /^[\w.-]+$/;
function validateRef(input: { source: string; id: string }) {
  if (!safeRef.test(input.source) || !safeRef.test(input.id)) {
    throw new Error("Invalid stream reference");
  }
  return input;
}

export const listLiveMatches = createServerFn({ method: "GET" }).handler(async () =>
  getLiveMatches(),
);

export const listStreams = createServerFn({ method: "GET" })
  .inputValidator(validateRef)
  .handler(async ({ data }) => getStreams(data.source, data.id));

/**
 * All playable streams for THIS event only.
 *
 * Upstream occasionally lists the same mirror reference (e.g. the same NFL
 * "golf"/"foxtrot" id) under more than one live match, which is how one game's
 * player ended up showing a different game. Any source reference that appears
 * in more than one live match is treated as ambiguous and excluded from the
 * backup list, so a failover can never jump to the wrong game.
 */
export const listAllStreamsForEvent = createServerFn({ method: "GET" })
  .inputValidator(validateRef)
  .handler(async ({ data }) => {
    const [primary, matches] = await Promise.all([
      getStreams(data.source, data.id),
      getLiveMatches().catch(() => [] as Match[]),
    ]);

    const refCount = new Map<string, number>();
    for (const m of matches) {
      for (const s of m.sources ?? []) {
        const key = `${s.source}/${s.id}`;
        refCount.set(key, (refCount.get(key) ?? 0) + 1);
      }
    }

    const match = matches.find((m) =>
      m.sources?.some((s) => s.source === data.source && s.id === data.id),
    );
    // Team-name tokens for this event, used to rank mirrors that clearly belong
    // to this game ahead of opaque numeric mirrors that could point elsewhere.
    const tokens = [match?.teams?.home?.name, match?.teams?.away?.name, match?.title]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3 && !["live", "stream", "game"].includes(t));
    const matchesEvent = (id: string) => {
      const low = id.toLowerCase();
      return tokens.some((t) => low.includes(t));
    };

    const rest = (match?.sources ?? [])
      .filter(
        (s) =>
          !(s.source === data.source && s.id === data.id) &&
          (refCount.get(`${s.source}/${s.id}`) ?? 0) <= 1,
      )
      .sort((a, b) => Number(matchesEvent(b.id)) - Number(matchesEvent(a.id)));

    const results = await Promise.all(rest.map((s) => getStreams(s.source, s.id)));
    const all = [...primary, ...results.flat()].filter((s) => Boolean(s?.embedUrl));
    const seen = new Set<string>();
    const streams = all.filter((s) =>
      seen.has(s.embedUrl) ? false : (seen.add(s.embedUrl), true),
    );
    // The event title is resolved server-side from the stream reference itself,
    // so the page can never show one game's name over another game's player.
    return { title: match?.title ?? null, category: match?.category ?? null, streams };
  });

export type HealthReport = {
  checkedAt: string;
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  repairs: string[];
};

/** Runs the full system check and self-heals what it can (stale caches). */
export async function runHealthCheck(): Promise<HealthReport> {
  const checks: HealthReport["checks"] = [];
  const repairs: string[] = [];

  let matches: Match[] = [];
  try {
    matches = await get<Match[]>("/api/matches/live");
    checks.push({
      name: "Live events feed",
      ok: matches.length > 0,
      detail: `${matches.length} live events returned`,
    });
    // self-heal: refresh the cache with what we just verified
    matchesCache = { at: Date.now(), data: matches.filter((m) => m.sources?.length > 0) };
    repairs.push("Refreshed the live events cache.");
  } catch (e) {
    checks.push({ name: "Live events feed", ok: false, detail: String(e) });
  }

  // Sample a handful of events and confirm playable streams come back.
  const sample = matches.filter((m) => m.sources?.length).slice(0, 5);
  let playable = 0;
  for (const m of sample) {
    const first = m.sources[0]!;
    const streams = await getStreams(first.source, first.id);
    if (streams.some((s) => s.embedUrl)) playable++;
  }
  if (sample.length) {
    checks.push({
      name: "Stream links",
      ok: playable > 0,
      detail: `${playable}/${sample.length} sampled events had playable streams`,
    });
  }

  // Duplicate mirror detection (the cause of one game showing another).
  const refCount = new Map<string, number>();
  for (const m of matches) {
    for (const s of m.sources ?? []) {
      const key = `${s.source}/${s.id}`;
      refCount.set(key, (refCount.get(key) ?? 0) + 1);
    }
  }
  const dupes = [...refCount.values()].filter((n) => n > 1).length;
  checks.push({
    name: "Cross-event mirror conflicts",
    ok: true,
    detail:
      dupes === 0
        ? "No shared mirrors found"
        : `${dupes} shared mirrors found and automatically excluded from backups`,
  });
  if (dupes > 0) repairs.push(`Excluded ${dupes} ambiguous mirrors from backup lists.`);

  // Drop stale stream cache entries.
  let cleared = 0;
  for (const [k, v] of streamsCache) {
    if (Date.now() - v.at > STREAMS_TTL_MS) {
      streamsCache.delete(k);
      cleared++;
    }
  }
  if (cleared) repairs.push(`Cleared ${cleared} stale stream cache entries.`);

  return {
    checkedAt: new Date().toISOString(),
    ok: checks.every((c) => c.ok),
    checks,
    repairs,
  };
}

export const getHealthReport = createServerFn({ method: "GET" }).handler(async () =>
  runHealthCheck(),
);

export const posterUrl = (poster?: string | null) =>
  poster ? `${BASE}${poster.startsWith("/") ? "" : "/"}${poster}` : null;

export const badgeUrl = (badge?: string) =>
  badge ? `${BASE}/api/images/badge/${badge}.webp` : null;
