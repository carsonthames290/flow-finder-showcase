import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StreamEmbed } from "@/components/stream-embed";
import { Button } from "@/components/ui/button";
import { listAllStreamsForEvent } from "@/lib/streams.functions";

type MultiviewSearch = { streams?: string | undefined };

function parseRefs(value?: string) {
  return (value ?? "")
    .split(",")
    .map((part) => part.split(":"))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0] && parts[1]))
    .slice(0, 4)
    .map(([source, id]) => ({ source, id }));
}

export const Route = createFileRoute("/watch/multiview")({
  validateSearch: (search: Record<string, unknown>): MultiviewSearch => ({
    streams: typeof search["streams"] === "string" ? search["streams"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ streams: search.streams }),
  loader: async ({ deps }) => {
    const refs = parseRefs(deps.streams);
    const events = await Promise.all(
      refs.map((ref) => listAllStreamsForEvent({ data: ref })),
    );
    return { events };
  },
  head: () => ({
    meta: [
      { title: "Multiview — LiveCast" },
      { name: "description", content: "Watch up to four live sports streams at once." },
      { property: "og:title", content: "Multiview — LiveCast" },
      { property: "og:description", content: "Watch up to four live sports streams at once." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Multiview,
});

function MultiviewTile({
  event,
  index,
  audioActive,
  onActivateAudio,
}: {
  event: Awaited<ReturnType<typeof listAllStreamsForEvent>>;
  index: number;
  audioActive: boolean;
  onActivateAudio: () => void;
}) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(index === 0);
  const current = event.streams[active];

  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setReady(true), index * 700);
    return () => window.clearTimeout(timer);
  }, [index, ready]);

  return (
    <section className="min-w-0 [contain-intrinsic-size:360px] [content-visibility:auto]">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
        <h2 className="truncate text-xl" title={event.title ?? "Live stream"}>
          {event.title ?? "Live stream"}
        </h2>
        {event.streams.length > 1 && (
          <select
            value={active}
            onChange={(e) => setActive(Number(e.target.value))}
            aria-label={`Choose source for ${event.title ?? "live stream"}`}
            className="h-8 shrink-0 rounded-md border border-border bg-card px-2 text-xs text-foreground"
          >
            {event.streams.map((stream, index) => (
              <option key={`${stream.source}-${stream.id}-${stream.streamNo}`} value={index}>
                #{stream.streamNo} {stream.hd ? "HD" : "SD"} · {stream.language}
              </option>
            ))}
          </select>
        )}
      </div>
      {current && ready ? (
        <StreamEmbed
          key={`${current.embedUrl}-${audioActive}`}
          src={current.embedUrl}
          title={event.title ?? "Live stream"}
          compact
          activeAudio={audioActive}
          onActivateAudio={onActivateAudio}
          lazy={index > 0}
        />
      ) : current ? (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card px-4 text-center text-sm text-muted-foreground">
          Preparing stream…
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card px-4 text-center text-sm text-muted-foreground">
          No stream is available for this event.
        </div>
      )}
    </section>
  );
}

function Multiview() {
  const { events } = Route.useLoaderData();
  const [audioIndex, setAudioIndex] = useState(0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-3xl tracking-wider text-primary">
            LiveCast
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/">← Choose streams</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl">Multiview</h1>
            <p className="mt-1 text-sm text-muted-foreground">{events.length} of 4 streams</p>
          </div>
        </div>
        {events.length ? (
          <div className={`grid gap-4 ${events.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {events.map((event, index) => (
              <MultiviewTile
                key={`${event.title ?? "stream"}-${index}`}
                event={event}
                index={index}
                audioActive={audioIndex === index}
                onActivateAudio={() => setAudioIndex(index)}
              />
            ))}
          </div>
        ) : (
          <div className="border-t border-border py-10 text-center">
            <p className="text-muted-foreground">Choose up to four live events to begin.</p>
            <Button asChild className="mt-4">
              <Link to="/">Choose streams</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}