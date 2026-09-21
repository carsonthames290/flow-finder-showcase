import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { listLiveMatches, posterUrl, badgeUrl, type Match } from "@/lib/streams.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LiveCast — Free Live Sports Streams" },
      {
        name: "description",
        content:
          "Watch live football, basketball, hockey, fight nights and more. Every stream credited to its original source.",
      },
      { property: "og:title", content: "LiveCast — Free Live Sports Streams" },
      {
        property: "og:description",
        content: "Live sports streams from around the world, updated automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => listLiveMatches(),
  component: Home,
});

function timeLabel(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MatchCard({ match }: { match: Match }) {
  const first = match.sources[0]!;
  const poster = posterUrl(match.poster);
  const home = badgeUrl(match.teams?.home?.badge);
  const away = badgeUrl(match.teams?.away?.badge);

  return (
    <Link
      to="/watch/$source/$id"
      params={{ source: first.source, id: first.id }}
      search={{ title: match.title }}
      preload="intent"
      className="group overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary"
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
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-sm bg-live px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-foreground" />
          Live
        </span>
      </div>
      <div className="p-3">
        <h3 className="text-lg leading-tight">{match.title}</h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          {match.category} · {timeLabel(match.date)} · {match.sources.length} source
          {match.sources.length > 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}

function Home() {
  const matches = Route.useLoaderData();
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(matches.map((m) => m.category))).sort()],
    [matches],
  );
  const shown = useMemo(
    () => (category === "all" ? matches : matches.filter((m) => m.category === category)),
    [matches, category],
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-primary">
            LiveCast
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="live-dot h-2 w-2 rounded-full bg-live" />
            {matches.length} live now
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-4xl sm:text-5xl">Every game. One place.</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Live streams pulled automatically from Streamed.pk and refreshed as events go on air.
        </p>

        <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            Nothing live in this category right now. Check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-relaxed text-muted-foreground">
          <p>
            All streams, listings, artwork and team badges are provided by and credited to{" "}
            <a
              href="https://streamed.pk"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline"
            >
              Streamed.pk
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
        </div>
      </footer>
    </div>
  );
}
