import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHealthReport } from "@/lib/streams.functions";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "System Health — LiveCast" },
      {
        name: "description",
        content: "Daily status report for LiveCast: live event feed, stream links and auto-repairs.",
      },
      { property: "og:title", content: "System Health — LiveCast" },
      { property: "og:description", content: "Live status of the LiveCast streaming pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Health,
});

function Health() {
  const check = useServerFn(getHealthReport);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["health"],
    queryFn: () => check(),
    // Re-checks itself once a day while the page stays open.
    refetchInterval: 24 * 60 * 60 * 1000,
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-4xl">Daily health check</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Runs automatically every day and whenever this page is opened. Problems it can fix are
          fixed on the spot; anything else is listed here.
        </p>

        <button
          onClick={() => refetch()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {isFetching ? "Checking…" : "Run check now"}
        </button>

        {data && (
          <>
            <p className="mt-6 text-sm">
              <span
                className={`font-semibold ${data.ok ? "text-primary" : "text-live"}`}
              >
                {data.ok ? "All systems normal" : "Needs attention"}
              </span>{" "}
              <span className="text-muted-foreground">
                · {new Date(data.checkedAt).toLocaleString()}
              </span>
            </p>

            <ul className="mt-4 space-y-2">
              {data.checks.map((c) => (
                <li
                  key={c.name}
                  className="rounded-md border border-border bg-card p-3 text-sm"
                >
                  <span className={c.ok ? "text-primary" : "text-live"}>
                    {c.ok ? "OK" : "FAIL"}
                  </span>{" "}
                  <span className="font-semibold">{c.name}</span>
                  <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                </li>
              ))}
            </ul>

            {data.repairs.length > 0 && (
              <div className="mt-6 rounded-md border border-accent/50 bg-accent/10 p-3 text-xs">
                <p className="font-semibold uppercase tracking-wide text-accent">Auto-repairs</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                  {data.repairs.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
