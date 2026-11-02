export type RawSource = string | { url?: unknown; quality?: unknown };

/** Normalize both API formats without ever coercing an object into an iframe URL. */
export function normalizeStrmFreeSources(value: unknown): { url: string; hd: boolean }[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((source: unknown) => {
    const record = typeof source === "object" && source !== null ? source as Record<string, unknown> : undefined;
    const url = typeof source === "string" ? source : record?.["url"];
    if (typeof url !== "string") return [];
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || seen.has(parsed.href)) return [];
      seen.add(parsed.href);
      return [{ url: parsed.href, hd: /1080|720|(?:f?hd)/i.test(`${url} ${typeof record?.["quality"] === "string" ? record["quality"] : ""}`) }];
    } catch { return []; }
  });
}

export function strmFreeEventSources(event: { live_sources?: unknown; sources?: unknown }) {
  return normalizeStrmFreeSources([
    ...(Array.isArray(event.live_sources) ? event.live_sources : []),
    ...(Array.isArray(event.sources) ? event.sources : []),
  ]);
}