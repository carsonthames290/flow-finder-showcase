import { createFileRoute } from "@tanstack/react-router";
import { runHealthCheck } from "@/lib/streams.functions";

/**
 * Daily health check endpoint. Safe to call from a scheduler; read-only apart
 * from refreshing/clearing internal caches.
 */
export const Route = createFileRoute("/api/public/health-check")({
  server: {
    handlers: {
      GET: async () => {
        const report = await runHealthCheck();
        return new Response(JSON.stringify(report, null, 2), {
          status: report.ok ? 200 : 503,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
