import { useRef } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type StreamEmbedProps = {
  src: string;
  title: string;
  onLoad?: () => void;
  loading?: boolean;
  reloadKey?: number;
  compact?: boolean;
  activeAudio?: boolean;
  onActivateAudio?: () => void;
  lazy?: boolean;
};

export function StreamEmbed({
  src,
  title,
  onLoad,
  loading = false,
  reloadKey = 0,
  compact = false,
  activeAudio = true,
  onActivateAudio,
  lazy = false,
}: StreamEmbedProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const element = wrapRef.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.();
  };

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden rounded-lg border bg-secondary transition ${
        activeAudio ? "border-primary" : "border-border"
      }`}
    >
      <div className="aspect-video">
        <iframe
          key={`${src}-${reloadKey}`}
          src={src}
          title={title}
          allowFullScreen
          allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *"
          referrerPolicy="origin"
          loading={lazy ? "lazy" : "eager"}
          onLoad={onLoad}
          className="h-full w-full"
        />
      </div>
      {onActivateAudio && (
        <Button
          type="button"
          variant={activeAudio ? "default" : "outline"}
          size="sm"
          onClick={onActivateAudio}
          className={`absolute left-3 top-3 z-20 ${activeAudio ? "" : "bg-card/90"}`}
          aria-label={`Use audio from ${title}`}
        >
          {activeAudio ? "Audio on" : "Use audio"}
        </Button>
      )}
      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
          <span className="rounded-full bg-card/90 px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
            Connecting to stream…
          </span>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "sm"}
        onClick={toggleFullscreen}
        title="Fullscreen"
        aria-label={`Open ${title} fullscreen`}
        className="absolute right-3 top-3 z-20 bg-card/90"
      >
        <Maximize2 />
        {!compact && <span>Fullscreen</span>}
      </Button>
    </div>
  );
}