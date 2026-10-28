import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Check, MonitorUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listSourceSchedule, posterUrl, badgeUrl, type Match } from "@/lib/streams.functions";
import { ALTERNATE_CODES, SOURCE_CATALOG, sourceCode, searchCode, matchesSearch, type SourceCode } from "@/lib/source-catalog";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { source?: SourceCode | undefined; q?: string | undefined } => ({
    source: search["source"] ? sourceCode(search["source"]) : undefined,
    q: typeof search["q"] === "string" ? search["q"].slice(0, 200) : undefined,
  }),
  loaderDeps: ({ search }) => ({ source: sourceCode(search.source) }),
  head: ({ match }) => ({
    meta: [
      { title: `LiveCast — ${SOURCE_CATALOG[sourceCode(match.search.source)].name} Live Sports` },
      {
        name: "description",
        content:
          "Watch live football, basketball, hockey, fight nights and more, plus what's coming up next. Every stream credited to its original source.",
      },
      { property: "og:title", content: `LiveCast — ${SOURCE_CATALOG[sourceCode(match.search.source)].name} Live Sports` },
      {
        property: "og:description",
        content: "Live and upcoming sports streams from around the world, updated automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ deps }) => listSourceSchedule({ data: { source: deps.source } }),
  staleTime: 45_000,
  component: Home,
});

function timeLabel(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MatchCard({
  match,
  live,
  selected,
  onToggle,
}: {
  match: Match;
  live: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const first = match.sources[0];
  const poster = posterUrl(match.poster);
  const home = badgeUrl(match.teams?.home?.badge);
  const away = badgeUrl(match.teams?.away?.badge);

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary">
      {first ? <Link
        to="/watch/$source/$id"
        params={{ source: first.source, id: first.id }}
        search={{ title: match.title }}
        preload="intent"
        className="block"
      >
        <div className="relative aspect-video overflow-hidden bg-secondary">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center gap-4">
            {home && <img src={home} alt="" className="h-12 w-12 object-contain" />}
            {away && <img src={away} alt="" className="h-12 w-12 object-contain" />}
          </div>
        )}
        {live ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-sm bg-live px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-foreground" />
            Live
          </span>
        ) : (
          <span
            suppressHydrationWarning
            className="absolute left-2 top-2 rounded-sm bg-card/90 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {timeLabel(match.date)}
          </span>
        )}
        </div>
        <div className="p-3 pb-2">
          <h3 className="text-lg leading-tight">{match.title}</h3>
          <p
            suppressHydrationWarning
            className="mt-1 text-xs uppercase tracking-wide text-muted-foreground"
          >
            {match.category} · {timeLabel(match.date)} · {match.sources.length} source
            {match.sources.length > 1 ? "s" : ""}
          </p>
        </div>
      </Link> : null}
      {live && onToggle && (
        <div className="px-3 pb-3">
          <Button
            type="button"
            variant={selected ? "default" : "outline"}
            size="sm"
            onClick={onToggle}
            className="w-full"
          >
            {selected ? <Check /> : <MonitorUp />}
            {selected ? "Added to Multiview" : "Add to Multiview"}
          </Button>
        </div>
      )}
    </article>
  );
}

function Home() {
  const data = Route.useLoaderData() ?? { live: [], upcoming: [], error: undefined };
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const activeSource = sourceCode(search.source);
  const provider = SOURCE_CATALOG[activeSource];
  const [query, setQuery] = useState(search.q ?? "");
  const [switching, setSwitching] = useState(false);
  const live = data.live;
  const upcoming = data.upcoming;
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set([...live, ...upcoming].map((m) => m.category))).sort()],
    [live, upcoming],
  );
  const filter = (list: Match[]) => list.filter((m) =>
    (category === "all" || m.category === category) && matchesSearch(m, query));
  const shownLive = filter(live);
  const shownUpcoming = filter(upcoming);
  const switchSource = async (code: SourceCode) => {
    setSwitching(true);
    setQuery("");
    setCategory("all");
    setSelected([]);
    try { await navigate({ to: "/", search: code === "strmfree" ? {} : { source: code } }); }
    finally { setSwitching(false); }
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const code = searchCode(query);
    if (code) void switchSource(code);
  };
  const toggleMultiview = (match: Match) => {
    const source = match.sources[0];
    if (!source) return;
    const ref = `${source.source}:${source.id}`;
    setSelected((current) =>
      current.includes(ref)
        ? current.filter((item) => item !== ref)
        : current.length < 4
          ? [...current, ref]
          : current,
    );
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-primary">
            LiveCast
          </Link>
          <div className="flex items-center gap-3">
            {selected.length > 0 && (
              <Button asChild size="sm">
                <Link to="/watch/multiview" search={{ streams: selected.join(",") }}>
                  <MonitorUp /> Multiview {selected.length}/4
                </Link>
              </Button>
            )}
            <span className="hidden items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground sm:inline-flex">
              <span className="live-dot h-2 w-2 rounded-full bg-live" />
              {live.length} live now
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl sm:text-5xl">{activeSource === "strmfree" ? "Every game. One place." : `LiveCast · ${provider.name}`}</h1>
          {activeSource !== "strmfree" && <Button variant="outline" onClick={() => void switchSource("strmfree")} disabled={switching}>Back to main LiveCast</Button>}
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {provider.name} · Live sports
        </p>

        <form onSubmit={submitSearch} className="mt-5 flex max-w-2xl items-center gap-2" role="search">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input type="search" aria-label="Search games or enter a source code" placeholder="Search games or enter a source code" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} className="h-10 w-full rounded-md border border-input bg-card pl-10 pr-10 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            {query && <Button type="button" variant="ghost" size="icon" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-0 top-0 h-10 w-10"><X /></Button>}
          </div>
          <Button type="submit" disabled={switching} aria-label="Search" className="h-10">{switching ? "Loading…" : <Search />}</Button>
        </form>
        {data.error && <div role="alert" className="mt-4 border-l-2 border-live pl-3 text-sm text-muted-foreground">{data.error} <a href={provider.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Visit {provider.name}</a></div>}

        <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <Button
              type="button"
              variant={category === c ? "default" : "outline"}
              size="sm"
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {c}
            </Button>
          ))}
        </div>

        <h2 className="mt-8 text-2xl">Live now</h2>
        {shownLive.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {query ? "No live games match your search." : "Nothing live in this category right now. Check the upcoming list below."}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shownLive.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                live
                selected={m.sources[0] ? selected.includes(`${m.sources[0].source}:${m.sources[0].id}`) : false}
                onToggle={() => toggleMultiview(m)}
              />
            ))}
          </div>
        )}

        {shownUpcoming.length > 0 && (
          <>
            <h2 className="mt-12 text-2xl">Upcoming</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shownUpcoming.map((m) => (
                <MatchCard key={m.id} match={m} live={false} />
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-muted-foreground">
          <p>
            All streams, listings, artwork and team badges are provided by and credited to{" "}
            <a
              href={provider.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline"
            >
              {provider.name}
            </a>
            . LiveCast hosts no video and claims no ownership of any broadcast. Rights remain with
            the original broadcasters and rights holders. Takedown requests should be directed to
            the source.
          </p>
          <p className="mt-3">
            <Link to="/health" className="text-primary underline">
              System health
            </Link>
          </p>
          {activeSource === "strmfree" && <div className="mt-6 border-t border-border pt-5">
            <h2 className="text-lg text-foreground">Secret source codes</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {ALTERNATE_CODES.map((code) => <Button key={code} variant="outline" size="sm" disabled={switching} onClick={() => void switchSource(code)}><span className="font-mono text-primary">{code}</span><span>{SOURCE_CATALOG[code].url.replace("https://", "")}</span></Button>)}
            </div>
          </div>}
        </div>
      </footer>
    </div>
  );
}
