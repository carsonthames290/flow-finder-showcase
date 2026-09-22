import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { listAllStreamsForEvent } from "@/lib/streams.functions";

type WatchSearch = { title?: string | undefined };

const HEALTH_TIMEOUT_MS = 9000;

export const Route = createFileRoute("/watch/$source/$id")({
  validateSearch: (search: Record<string, unknown>): WatchSearch => ({
    title: typeof search["title"] === "string" ? (search["title"] as string) : undefined,
  }),
  loader: ({ params }) =>
    listAllStreamsForEvent({ data: { source: params.source, id: params.id } }),
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
  const { streams, title: serverTitle } = Route.useLoaderData();
  const { title: searchTitle } = Route.useSearch();
  // The server-resolved title always wins: it comes from the same event the
  // player is pointed at, so the name can never belong to a different game.
  const title = serverTitle ?? searchTitle ?? "Live stream";

  const [active, setActive] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ok" | "exhausted">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const triedRef = useRef<Set<number>>(new Set([0]));
  const frameWrapRef = useRef<HTMLDivElement>(null);
  const current = streams[active];

  // Auto-fix: if the player never reports a successful load, fail over to the
  // next available mirror on its own.
  const failover = useCallback(
    (reason: string) => {
      const next = streams.findIndex((_, i) => !triedRef.current.has(i));
      if (next === -1) {
        setStatus("exhausted");
        setNotice("Every backup looked dead. Tap retry, or pick a stream below.");
        return;
      }
      triedRef.current.add(next);
      setActive(next);
      setStatus("loading");
      setNotice(`${reason} Switched to backup #${streams[next]!.streamNo}.`);
    },
    [streams],
  );

  useEffect(() => {
    if (status !== "loading" || !current) return;
    const t = setTimeout(() => failover("This stream didn't start."), HEALTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status, current, reloadKey, failover]);

  const retryAll = () => {
    triedRef.current = new Set([active]);
    setReloadKey((k) => k + 1);
    setStatus("loading");
    setNotice(null);
  };

  const pick = (i: number) => {
    triedRef.current.add(i);
    setActive(i);
    setStatus("loading");
    setNotice(null);
  };

  const goFullscreen = () => {
    const el = frameWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-primary">
            LiveCast
          </Link>
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>

        {current ? (
          <>
            <div
              ref={frameWrapRef}
              className="relative mt-4 overflow-hidden rounded-lg border border-border bg-black"
            >
              <div className="aspect-video">
                <iframe
                  key={`${current.embedUrl}-${reloadKey}`}
                  src={current.embedUrl}
                  title={title}
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  // No allow-popups: the stream host's first click otherwise
                  // opens an ad tab before the video will start.
                  sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onLoad={() => setStatus("ok")}
                  className="h-full w-full"
                />
              </div>
              {status === "loading" && (
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
                  <span className="rounded-full bg-card/90 px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Connecting to stream…
                  </span>
                </div>
              )}
              <button
                onClick={goFullscreen}
                className="absolute bottom-3 right-3 rounded-md border border-border bg-card/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground transition hover:border-primary"
              >
                ⛶ Fullscreen
              </button>
            </div>

            {notice && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-xs text-foreground">
                <span>{notice}</span>
                <button
                  onClick={retryAll}
                  className="rounded-sm border border-accent px-2 py-1 font-semibold uppercase tracking-wide text-accent"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {streams.map((s, i) => (
                <button
                  key={`${s.source}-${s.id}-${s.streamNo}`}
                  onClick={() => pick(i)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    i === active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  #{s.streamNo} {s.hd ? "HD" : "SD"} · {s.language}
                </button>
              ))}
              <button
                onClick={() => failover("Thanks — flagged as broken.")}
                className="rounded-md border border-live px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-live transition hover:bg-live hover:text-foreground"
              >
                Stream not working
              </button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {current.viewers.toLocaleString()} watching · source: {current.source} ·{" "}
              {streams.length} backup{streams.length === 1 ? "" : "s"} available
            </p>
          </>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">
              This event has no working stream right now.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Back to home
            </Link>
          </div>
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
