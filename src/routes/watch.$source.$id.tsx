import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { listStreams } from "@/lib/streams.functions";

type WatchSearch = { title?: string | undefined };

export const Route = createFileRoute("/watch/$source/$id")({
  validateSearch: (search: Record<string, unknown>): WatchSearch => ({
    title: typeof search['title'] === "string" ? (search['title'] as string) : undefined,
  }),
  loader: ({ params }) => listStreams({ data: { source: params.source, id: params.id } }),
  head: ({ match }) => {
    const title = match.search.title ?? "Live stream";
    return {
      meta: [
        { title: `${title} — LiveCast` },
        { name: "description", content: `Watch ${title} live. Stream credited to Streamed.pk.` },
        { property: "og:title", content: `${title} — LiveCast` },
        { property: "og:description", content: `Watch ${title} live on LiveCast.` },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Watch,
});

function Watch() {
  const streams = Route.useLoaderData();
  const { title } = Route.useSearch();
  const [active, setActive] = useState(0);
  const current = streams[active];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-primary">
            LiveCast
          </Link>
          <Link to="/" className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground">
            All streams
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl sm:text-4xl">{title ?? "Live stream"}</h1>

        {current ? (
          <>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-black">
              <div className="aspect-video">
                <iframe
                  key={current.embedUrl}
                  src={current.embedUrl}
                  title={title ?? "Live stream"}
                  allowFullScreen
                  referrerPolicy="origin"
                  className="h-full w-full"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {streams.map((s, i) => (
                <button
                  key={`${s.source}-${s.streamNo}`}
                  onClick={() => setActive(i)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    i === active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  #{s.streamNo} {s.hd ? "HD" : "SD"} · {s.language}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {current.viewers.toLocaleString()} watching · source: {current.source}
            </p>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            This stream is not available right now. Try another event.
          </p>
        )}

        <div className="mt-8 rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-display text-base tracking-wide text-foreground">Credits</p>
          <p className="mt-2">
            Stream, player and listing data provided by{" "}
            <a
              href="https://streamed.pk"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline"
            >
              Streamed.pk
            </a>
            . Video is embedded from the original host — LiveCast stores and rebroadcasts nothing.
            All broadcast rights belong to the respective leagues, networks and rights holders.
          </p>
        </div>
      </main>
    </div>
  );
}
