"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Eraser, Loader2, RefreshCw } from "lucide-react";
import { broadcastWhiteboard, onWhiteboardSignal } from "@/lib/whiteboardRealtime";
import { getWhiteboardChannel } from "@/lib/sessionChannels";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-[#f8f9fb] text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading whiteboard
      </div>
    ),
  }
);

type WhiteboardScene = {
  elements: any[];
  appState?: Record<string, any>;
};

function cloneScene(scene: WhiteboardScene | null) {
  if (!scene) return null;
  return JSON.parse(JSON.stringify(scene));
}

export function WhiteboardPanel({
  sessionId,
  role,
}: {
  sessionId: string;
  role: "interviewer" | "interviewee";
}) {
  const apiRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const broadcastTimeoutRef = useRef<any>(null);
  const suppressBroadcastRef = useRef(false);
  const latestSceneRef = useRef<WhiteboardScene | null>(null);
  const clientIdRef = useRef(`wb-${Math.random().toString(36).slice(2, 10)}`);
  const [ready, setReady] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState(0);

  const room = useMemo(() => getWhiteboardChannel(sessionId), [sessionId]);

  useEffect(() => {
    let mounted = true;

    const channel = onWhiteboardSignal(room, (payload) => {
      if (!mounted || !payload || payload.from === clientIdRef.current) return;

      if (payload.type === "whiteboard-update" || payload.type === "whiteboard-init") {
        if (!payload.scene || !apiRef.current) return;
        suppressBroadcastRef.current = true;
        latestSceneRef.current = cloneScene(payload.scene);
        apiRef.current.updateScene({
          elements: payload.scene.elements || [],
          appState: payload.scene.appState || {},
        });
        setRemoteVersion((prev) => prev + 1);
        setTimeout(() => {
          suppressBroadcastRef.current = false;
        }, 0);
      }

      if (payload.type === "whiteboard-clear" && apiRef.current) {
        suppressBroadcastRef.current = true;
        latestSceneRef.current = { elements: [], appState: { viewBackgroundColor: "#ffffff" } };
        apiRef.current.resetScene();
        setRemoteVersion((prev) => prev + 1);
        setTimeout(() => {
          suppressBroadcastRef.current = false;
        }, 0);
      }
    });

    channelRef.current = channel;
    setReady(true);

    return () => {
      mounted = false;
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [room]);

  const queueBroadcast = (scene: WhiteboardScene, type: "whiteboard-init" | "whiteboard-update" = "whiteboard-update") => {
    latestSceneRef.current = cloneScene(scene);
    if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
    broadcastTimeoutRef.current = setTimeout(() => {
      if (!channelRef.current || !latestSceneRef.current) return;
      broadcastWhiteboard(channelRef.current, {
        type,
        from: clientIdRef.current,
        scene: latestSceneRef.current,
      });
    }, 450);
  };

  const handleClear = () => {
    apiRef.current?.resetScene();
    latestSceneRef.current = { elements: [], appState: { viewBackgroundColor: "#ffffff" } };
    if (channelRef.current) {
      broadcastWhiteboard(channelRef.current, {
        type: "whiteboard-clear",
        from: clientIdRef.current,
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Whiteboard</h3>
          <p className="text-[11px] text-gray-400 mt-1">
            Shared drawing space on its own realtime channel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
            {ready ? "Live" : "Connecting"}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition"
            onClick={() => {
              const current = latestSceneRef.current;
              if (current) queueBroadcast(current, "whiteboard-init");
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync
          </button>
          {role === "interviewer" && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition"
              onClick={handleClear}
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[360px]">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
            if (latestSceneRef.current) {
              api.updateScene({
                elements: latestSceneRef.current.elements || [],
                appState: (latestSceneRef.current.appState || {}) as any,
              });
            }
          }}
          initialData={{
            appState: {
              viewBackgroundColor: "#ffffff",
            },
          }}
          onChange={(elements, appState) => {
            if (suppressBroadcastRef.current) return;
            const scene = {
              elements: elements.map((element: any) => ({ ...element })),
              appState: {
                viewBackgroundColor: appState.viewBackgroundColor,
                scrollX: appState.scrollX,
                scrollY: appState.scrollY,
                zoom: appState.zoom,
              },
            };
            queueBroadcast(scene);
          }}
          viewModeEnabled={false}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              clearCanvas: false,
            },
          }}
        />
      </div>
    </div>
  );
}
