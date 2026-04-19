import { type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { StreamVideo } from "./StreamVideo";

export function VideoTile({
  title,
  status,
  stream,
  muted = false,
  empty,
  action,
  actionTitle,
  pinned = false,
}: {
  title: string;
  status?: "live" | "waiting" | "muted";
  stream: MediaStream | null;
  muted?: boolean;
  empty: ReactNode;
  action?: () => void;
  actionTitle?: string;
  pinned?: boolean;
}) {
  return (
    <div
      className={`group relative flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-xl border ${
        pinned ? "border-white/20 shadow-xl" : "border-white/10"
      } bg-gray-950`}
    >
      {action ? (
        <button
          type="button"
          className={`absolute right-2 top-2 z-20 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80 ${
            pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={action}
          title={actionTitle}
        >
          {pinned ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      ) : null}

      {stream ? (
        <StreamVideo stream={stream} muted={muted} label={title} className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        empty
      )}

      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
        {status ? (
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              status === "live"
                ? "bg-green-500"
                : status === "muted"
                  ? "bg-red-500"
                  : "animate-pulse bg-yellow-500"
            }`}
          />
        ) : null}
        <span>{title}</span>
      </div>
    </div>
  );
}
