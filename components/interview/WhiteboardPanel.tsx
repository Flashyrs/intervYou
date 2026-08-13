"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Eraser, Loader2, RefreshCw } from "lucide-react";
import { broadcastWhiteboard, onWhiteboardSignal } from "@/lib/whiteboardRealtime";
import { getWhiteboardChannel } from "@/lib/sessionChannels";
import { useTheme } from "@/components/ThemeProvider";

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
  const { isDarkMode } = useTheme();
  const apiRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const broadcastTimeoutRef = useRef<any>(null);
  const suppressBroadcastRef = useRef(false);
  const latestSceneRef = useRef<WhiteboardScene | null>(null);
  const clientIdRef = useRef(`wb-${Math.random().toString(36).slice(2, 10)}`);
  const lastPointerSendRef = useRef<number>(0);
  const collaboratorsRef = useRef<Map<string, any>>(new Map());
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
        latestSceneRef.current = { elements: [], appState: { viewBackgroundColor: isDarkMode ? "#121212" : "#ffffff" } };
        apiRef.current.resetScene();
        setRemoteVersion((prev) => prev + 1);
        setTimeout(() => {
          suppressBroadcastRef.current = false;
        }, 0);
      }

      if (payload.type === "whiteboard-pointer" && apiRef.current) {
        const { from, pointer, button, role: senderRole } = payload as any;
        const name = senderRole === "interviewer" ? "Interviewer" : "Interviewee";

        collaboratorsRef.current.set(from, {
          pointer,
          button,
          username: name,
          color: senderRole === "interviewer"
            ? { background: "#ec4899", stroke: "#db2777" }
            : { background: "#3b82f6", stroke: "#2563eb" }
        });

        apiRef.current.updateScene({
          collaborators: new Map(collaboratorsRef.current),
        });

        // Clean up cursor after 5 seconds of inactivity
        if ((apiRef.current as any)[`__timeout_${from}`]) {
          clearTimeout((apiRef.current as any)[`__timeout_${from}`]);
        }
        (apiRef.current as any)[`__timeout_${from}`] = setTimeout(() => {
          collaboratorsRef.current.delete(from);
          if (apiRef.current) {
            apiRef.current.updateScene({
              collaborators: new Map(collaboratorsRef.current),
            });
          }
        }, 5000);
      }
    });

    channelRef.current = channel;
    setReady(true);

    return () => {
      mounted = false;
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      // Prune collaborator timeouts on unmount
      if (apiRef.current) {
        collaboratorsRef.current.forEach((_, from) => {
          if ((apiRef.current as any)[`__timeout_${from}`]) {
            clearTimeout((apiRef.current as any)[`__timeout_${from}`]);
          }
        });
      }
    };
  }, [room, isDarkMode]);

  const handlePointerUpdate = (payload: any) => {
    if (!channelRef.current) return;
    const now = Date.now();
    // Throttle pointer updates to every 80ms
    if (now - lastPointerSendRef.current < 80) return;
    lastPointerSendRef.current = now;

    const { pointer, button } = payload;
    if (!pointer) return;

    broadcastWhiteboard(channelRef.current, {
      type: "whiteboard-pointer",
      from: clientIdRef.current,
      role,
      pointer: { 
        x: pointer.x, 
        y: pointer.y,
        tool: pointer.tool // "laser", etc.
      },
      button
    } as any);
  };

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
    latestSceneRef.current = { elements: [], appState: { viewBackgroundColor: isDarkMode ? "#121212" : "#ffffff" } };
    if (channelRef.current) {
      broadcastWhiteboard(channelRef.current, {
        type: "whiteboard-clear",
        from: clientIdRef.current,
      });
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-200 ${isDarkMode ? 'bg-[#121212] text-zinc-100' : 'bg-white'}`}>
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isDarkMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-100 bg-gray-50/80'}`}>
        <div>
          <h3 className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>Whiteboard</h3>
          <p className={`text-[11px] mt-1 ${isDarkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
            Shared drawing space on its own realtime channel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
            {ready ? "Live" : "Connecting"}
          </span>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                isDarkMode 
                    ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => {
              const current = latestSceneRef.current;
              if (current) queueBroadcast(current, "whiteboard-init");
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync
          </button>
          {role === "interviewee" && (
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                  isDarkMode 
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
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
          theme={isDarkMode ? "dark" : "light"}
          excalidrawAPI={(api) => {
            apiRef.current = api;
            if (latestSceneRef.current) {
              api.updateScene({
                elements: latestSceneRef.current.elements || [],
                appState: (latestSceneRef.current.appState || {}) as any,
              });
            }
          }}
          onPointerUpdate={handlePointerUpdate}
          initialData={{
            appState: {
              viewBackgroundColor: isDarkMode ? "#121212" : "#ffffff",
            },
          }}
          onChange={(elements, appState) => {
            if (role !== "interviewee") return;
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
          viewModeEnabled={role === "interviewer"}
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
