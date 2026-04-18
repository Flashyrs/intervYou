"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { applyAnswer, createAnswer, createOffer, setupPeerConnection } from "@/lib/webrtc";
import { broadcast, onSignal } from "@/lib/realtime";
import { Maximize2, Mic, MicOff, Minimize2, Monitor, Settings, Users, Video, VideoOff, X } from "lucide-react";

function safePlay(el: HTMLVideoElement, label: string) {
  if (!el.srcObject && !el.src) return;
  if (!el.paused) return;
  const promise = el.play();
  if (promise !== undefined) {
    promise.catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn(`[VideoCall] ${label} play() failed:`, err);
    });
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function ScreenPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-white/60">
      <Monitor className="mb-3 h-8 w-8" />
      <p className="text-sm">No screen share is active right now.</p>
    </div>
  );
}

function StreamVideo({
  stream,
  muted = false,
  label,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.srcObject = stream;
    if (stream) {
      safePlay(el, label);
    } else {
      el.removeAttribute("src");
      el.load();
    }

    const resumePlayback = () => {
      if (ref.current) safePlay(ref.current, `${label}-resume`);
    };

    el.addEventListener("loadedmetadata", resumePlayback);
    document.addEventListener("visibilitychange", resumePlayback);
    window.addEventListener("focus", resumePlayback);
    window.addEventListener("resize", resumePlayback);

    return () => {
      el.removeEventListener("loadedmetadata", resumePlayback);
      document.removeEventListener("visibilitychange", resumePlayback);
      window.removeEventListener("focus", resumePlayback);
      window.removeEventListener("resize", resumePlayback);
    };
  }, [stream, label]);

  return <video ref={ref} playsInline autoPlay muted={muted} className={className} />;
}

function VideoTile({
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

function Controls({
  micOn,
  camOn,
  screenShareActive,
  showSettings,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleSettings,
}: {
  micOn: boolean;
  camOn: boolean;
  screenShareActive: boolean;
  showSettings: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleSettings: () => void;
}) {
  return (
    <>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          micOn ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-red-500 text-white hover:bg-red-600"
        }`}
        onClick={onToggleMic}
        title={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? <Mic className="h-4 w-4 md:h-5 md:w-5" /> : <MicOff className="h-4 w-4 md:h-5 md:w-5" />}
      </button>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          camOn ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-red-500 text-white hover:bg-red-600"
        }`}
        onClick={onToggleCam}
        title={camOn ? "Stop Camera" : "Start Camera"}
      >
        {camOn ? <Video className="h-4 w-4 md:h-5 md:w-5" /> : <VideoOff className="h-4 w-4 md:h-5 md:w-5" />}
      </button>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          screenShareActive ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
        onClick={onToggleScreenShare}
        title={screenShareActive ? "Stop Screen Share" : "Start Screen Share"}
      >
        <Monitor className="h-4 w-4 md:h-5 md:w-5" />
      </button>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          showSettings ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
        onClick={onToggleSettings}
        title="Settings"
      >
        <Settings className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    </>
  );
}

export default function VideoCall({
  room,
  screenShareRoom,
  role,
  autoStart = true,
}: {
  room: string;
  screenShareRoom?: string;
  role: "interviewer" | "interviewee";
  autoStart?: boolean;
}) {
  const roleRef = useRef(role);
  const hasAutoStartedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const screenSharePcRef = useRef<RTCPeerConnection | null>(null);
  const screenShareChannelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenStreamRef = useRef<MediaStream | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [connectionState, setConnectionState] = useState("new");
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [callChannelReady, setCallChannelReady] = useState(false);
  const [screenShareChannelReady, setScreenShareChannelReady] = useState(false);
  const [focusView, setFocusView] = useState<"local" | "remote" | "screen" | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"full" | "compact" | "hidden">("full");

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const activeScreenStream = localScreenStream || remoteScreenStream;
  const hasAnyScreenShare = !!activeScreenStream;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (focusView === "screen") {
          setFocusView(null);
          setSidebarMode("full");
          return;
        }
        setFocusView(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusView]);

  useEffect(() => {
    if (!hasAnyScreenShare && focusView === "screen") {
      setFocusView(null);
      setSidebarMode("full");
    }
  }, [focusView, hasAnyScreenShare]);

  const startCall = useCallback(async (iceRestart = false) => {
    if (!pcRef.current) {
      setError("Connection not initialized");
      return;
    }
    if (!channelRef.current) {
      setError("Signal channel not ready");
      return;
    }

    try {
      const offer = await pcRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart,
      });
      await pcRef.current.setLocalDescription(offer);
      broadcast(channelRef.current, {
        type: "call-offer",
        from: roleRef.current,
        sessionId: room,
        sdp: { type: offer.type, sdp: offer.sdp },
      });
      setError("");
    } catch (e) {
      console.error("Failed to start call", e);
      setError("Failed to start call");
    }
  }, [room]);

  const stopScreenShare = useCallback(async () => {
    stopStream(localScreenStreamRef.current);
    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
    screenSharePcRef.current?.close();
    screenSharePcRef.current = null;
    setScreenShareActive(false);

    if (screenShareChannelRef.current) {
      broadcast(screenShareChannelRef.current, {
        type: "screen-share-stopped",
        from: roleRef.current,
        sessionId: screenShareRoom || room,
      });
    }
  }, [room, screenShareRoom]);

  const startScreenShare = useCallback(async () => {
    if (!screenShareRoom) {
      setError("Screen share channel not configured");
      return;
    }
    if (!screenShareChannelReady) {
      setError("Screen share channel is still connecting");
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        iceCandidatePoolSize: 10,
      });

      screenSharePcRef.current = pc;
      localScreenStreamRef.current = displayStream;
      setLocalScreenStream(displayStream);
      setScreenShareActive(true);

      displayStream.getTracks().forEach((track) => pc.addTrack(track, displayStream));

      pc.onicecandidate = (event) => {
        if (event.candidate && screenShareChannelRef.current) {
          broadcast(screenShareChannelRef.current, {
            type: "screen-share-ice-candidate",
            from: roleRef.current,
            sessionId: screenShareRoom,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenShare().catch(() => {});
      });

      const offer = await createOffer(pc);
      if (screenShareChannelRef.current) {
        broadcast(screenShareChannelRef.current, {
          type: "screen-share-offer",
          from: roleRef.current,
          sessionId: screenShareRoom,
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      }

      setError("");
    } catch (e) {
      console.error("Failed to start screen share", e);
      setError("Failed to start screen share");
    }
  }, [screenShareChannelReady, screenShareRoom, stopScreenShare]);

  useEffect(() => {
    let mounted = true;
    hasAutoStartedRef.current = false;
    setCallChannelReady(false);

    (async () => {
      try {
        const { pc, localStream: setupLocalStream, remoteStream: setupRemoteStream } = await setupPeerConnection();
        if (!mounted) {
          stopStream(setupLocalStream);
          pc.close();
          return;
        }

        pcRef.current = pc;
        localStreamRef.current = setupLocalStream;
        remoteStreamRef.current = setupRemoteStream;
        setLocalStream(setupLocalStream);
        setRemoteStream(setupRemoteStream);
        setMicOn(setupLocalStream ? setupLocalStream.getAudioTracks().some((track) => track.enabled) : false);
        setCamOn(setupLocalStream ? setupLocalStream.getVideoTracks().some((track) => track.enabled) : false);

        const pendingIceCandidates: RTCIceCandidate[] = [];

        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          if (mounted) setDevices(devs);
        } catch (e) {
          console.warn("Failed to enumerate devices", e);
        }

        pc.onconnectionstatechange = () => {
          if (!mounted) return;
          setConnectionState(pc.connectionState);
          if (pc.connectionState === "connected") {
            setActive(true);
            setError("");
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setActive(false);
            if (pc.connectionState === "failed") {
              setError("Connection failed. Please check your network or firewall.");
            }
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
            broadcast(channelRef.current, {
              type: "ice-candidate",
              from: roleRef.current,
              sessionId: room,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        const ch = onSignal(
          room,
          async (payload) => {
            if (!payload || !mounted) return;
            try {
              if (payload.type === "call-offer" && payload.from !== roleRef.current) {
                const answer = await createAnswer(pc, payload.sdp);
                if (channelRef.current) {
                  broadcast(channelRef.current, {
                    type: "call-answer",
                    from: roleRef.current,
                    sessionId: room,
                    sdp: { type: answer.type, sdp: answer.sdp },
                  });
                }

                while (pendingIceCandidates.length > 0) {
                  const candidate = pendingIceCandidates.shift();
                  if (candidate) {
                    await pc.addIceCandidate(candidate).catch((e) => console.warn("Failed adding queued ICE", e));
                  }
                }
              } else if (payload.type === "call-answer" && payload.from !== roleRef.current) {
                await applyAnswer(pc, payload.sdp);
                while (pendingIceCandidates.length > 0) {
                  const candidate = pendingIceCandidates.shift();
                  if (candidate) {
                    await pc.addIceCandidate(candidate).catch((e) => console.warn("Failed adding queued ICE", e));
                  }
                }
              } else if (payload.type === "call-ping" && payload.from !== roleRef.current) {
                 if (pc.connectionState !== "connected" && pc.connectionState !== "connecting") {
                    startCall(true).catch(console.error);
                 }
              } else if (payload.type === "ice-candidate" && payload.from !== roleRef.current) {
                const candidate = new RTCIceCandidate(payload.candidate);
                if (pc.remoteDescription?.type) {
                  await pc.addIceCandidate(candidate).catch((e) => console.warn("Failed adding ICE", e));
                } else {
                  pendingIceCandidates.push(candidate);
                }
              }
            } catch (e) {
              console.error("Signaling processing error", e);
            }
          },
          (status) => {
            if (!mounted) return;
            setCallChannelReady(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED" && channelRef.current) {
               broadcast(channelRef.current, {
                 type: "call-ping",
                 from: roleRef.current,
                 sessionId: room,
               });
            }
            if (status === "SUBSCRIBED" && roleRef.current === "interviewee" && autoStart && !hasAutoStartedRef.current) {
              hasAutoStartedRef.current = true;
              startCall().catch((e) => {
                console.error("Auto-start failed", e);
                if (mounted) setError("Failed to start call");
              });
            }
          }
        );

        channelRef.current = ch;
      } catch (e) {
        console.error("Setup error", e);
        if (mounted) setError("Failed to initialize video call");
      }
    })();

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      screenShareChannelRef.current?.unsubscribe();
      screenShareChannelRef.current = null;
      stopStream(localScreenStreamRef.current);
      stopStream(localStreamRef.current);
      localScreenStreamRef.current = null;
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      remoteScreenStreamRef.current = null;
      screenSharePcRef.current?.close();
      screenSharePcRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [autoStart, room, startCall]);

  useEffect(() => {
    if (!screenShareRoom) return;

    let mounted = true;
    setScreenShareChannelReady(false);
    const pendingIceCandidates: RTCIceCandidate[] = [];

    const ch = onSignal(
      screenShareRoom,
      async (payload) => {
        if (!payload || !mounted) return;

        try {
          if (payload.type === "screen-share-offer" && payload.from !== roleRef.current) {
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
              iceCandidatePoolSize: 10,
            });

            const incomingRemoteScreen = new MediaStream();
            remoteScreenStreamRef.current = incomingRemoteScreen;
            setRemoteScreenStream(incomingRemoteScreen);
            screenSharePcRef.current = pc;

            pc.ontrack = (event) => {
              event.streams[0].getTracks().forEach((track) => {
                const exists = incomingRemoteScreen.getTracks().some((existingTrack) => existingTrack.id === track.id);
                if (!exists) incomingRemoteScreen.addTrack(track);
              });
              setRemoteScreenStream(new MediaStream(incomingRemoteScreen.getTracks()));
            };

            pc.onicecandidate = (event) => {
              if (event.candidate && screenShareChannelRef.current) {
                broadcast(screenShareChannelRef.current, {
                  type: "screen-share-ice-candidate",
                  from: roleRef.current,
                  sessionId: screenShareRoom,
                  candidate: event.candidate.toJSON(),
                });
              }
            };

            const answer = await createAnswer(pc, payload.sdp);
            if (screenShareChannelRef.current) {
              broadcast(screenShareChannelRef.current, {
                type: "screen-share-answer",
                from: roleRef.current,
                sessionId: screenShareRoom,
                sdp: { type: answer.type, sdp: answer.sdp },
              });
            }

            while (pendingIceCandidates.length > 0) {
              const candidate = pendingIceCandidates.shift();
              if (candidate) {
                await pc.addIceCandidate(candidate).catch((e) => console.warn("Failed adding queued screen-share ICE", e));
              }
            }
          } else if (payload.type === "screen-share-answer" && payload.from !== roleRef.current && screenSharePcRef.current) {
            await applyAnswer(screenSharePcRef.current, payload.sdp);
            while (pendingIceCandidates.length > 0) {
              const candidate = pendingIceCandidates.shift();
              if (candidate) {
                await screenSharePcRef.current.addIceCandidate(candidate).catch((e) => console.warn("Failed adding queued screen-share ICE", e));
              }
            }
          } else if (payload.type === "screen-share-ice-candidate") {
            const candidate = new RTCIceCandidate(payload.candidate);
            const targetPc = screenSharePcRef.current;
            if (targetPc?.remoteDescription?.type) {
              await targetPc.addIceCandidate(candidate).catch((e) => console.warn("Failed adding screen-share ICE", e));
            } else {
              pendingIceCandidates.push(candidate);
            }
          } else if (payload.type === "screen-share-stopped") {
            remoteScreenStreamRef.current = null;
            setRemoteScreenStream(null);
            screenSharePcRef.current?.close();
            screenSharePcRef.current = null;
          } else if (payload.type === "screen-share-ping" && payload.from !== roleRef.current) {
             if (screenShareActive && screenSharePcRef.current && screenShareChannelRef.current) {
                screenSharePcRef.current.createOffer({ iceRestart: true })
                  .then(async (offer) => {
                     await screenSharePcRef.current!.setLocalDescription(offer);
                     broadcast(screenShareChannelRef.current!, {
                        type: "screen-share-offer",
                        from: roleRef.current,
                        sessionId: screenShareRoom,
                        sdp: { type: offer.type, sdp: offer.sdp },
                     });
                  })
                  .catch(console.error);
             }
          }
        } catch (e) {
          console.error("Screen share signaling error", e);
        }
      },
      (status) => {
        if (!mounted) return;
        setScreenShareChannelReady(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED" && screenShareChannelRef.current) {
          broadcast(screenShareChannelRef.current, {
            type: "screen-share-ping",
            from: roleRef.current,
            sessionId: screenShareRoom,
          });
        }
      }
    );

    screenShareChannelRef.current = ch;

    return () => {
      mounted = false;
      remoteScreenStreamRef.current = null;
      setRemoteScreenStream(null);
    };
  }, [screenShareRoom]);

  const switchDevices = async () => {
    if (!pcRef.current) return;

    try {
      const constraints: MediaStreamConstraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((sender) => sender.track?.kind === "video");
      const audioSender = senders.find((sender) => sender.track?.kind === "audio");
      const nextVideoTrack = newStream.getVideoTracks()[0] || null;
      const nextAudioTrack = newStream.getAudioTracks()[0] || null;

      if (videoSender) await videoSender.replaceTrack(nextVideoTrack);
      if (audioSender) await audioSender.replaceTrack(nextAudioTrack);

      stopStream(localStreamRef.current);
      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setMicOn(newStream.getAudioTracks().some((track) => track.enabled));
      setCamOn(newStream.getVideoTracks().some((track) => track.enabled));
      setError("");
      setShowSettings(false);
    } catch (e) {
      console.error("Failed to switch devices", e);
      setError("Failed to switch devices");
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOn = stream.getAudioTracks().every((track) => track.enabled === false);
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextOn;
    });
    setMicOn(nextOn);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOn = stream.getVideoTracks().every((track) => track.enabled === false);
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextOn;
    });
    setCamOn(nextOn);
  };

  const toggleScreenShare = () => {
    if (screenShareActive) {
      stopScreenShare().catch(() => {});
      return;
    }
    startScreenShare().catch(() => {});
  };

  const localPlaceholder = (
    <div className="flex flex-col items-center justify-center text-white/50">
      <VideoOff className="mb-2 h-8 w-8 md:h-10 md:w-10" />
      <span className="text-xs">Camera Off</span>
    </div>
  );

  const remotePlaceholder = (
    <div className="flex flex-col items-center justify-center text-white/50">
      <Users className="mb-2 h-8 w-8 md:h-10 md:w-10" />
      <span className="text-xs">{active ? "Remote camera unavailable" : "Waiting for participant"}</span>
    </div>
  );

  const screenTile = (
    <div className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gray-950">
      {hasAnyScreenShare ? (
        <>
          <button
            type="button"
            className="absolute right-2 top-2 z-20 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
            onClick={() => {
              setFocusView("screen");
              setSidebarMode("full");
            }}
            title="Maximize shared screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <StreamVideo
            stream={activeScreenStream}
            muted={!!localScreenStream}
            label="screen-share"
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="absolute bottom-2 left-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
            Screen Share
          </div>
        </>
      ) : (
        <ScreenPlaceholder />
      )}
    </div>
  );

  const localTile = (
    <VideoTile
      title="You"
      status={micOn ? "live" : "muted"}
      stream={camOn ? localStream : null}
      muted
      empty={localPlaceholder}
      action={() => setFocusView((current) => (current === "local" ? null : "local"))}
      actionTitle={focusView === "local" ? "Minimize your camera" : "Maximize your camera"}
      pinned={focusView === "local"}
    />
  );

  const remoteTile = (
    <VideoTile
      title={active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}
      status={active ? "live" : "waiting"}
      stream={remoteStream}
      empty={remotePlaceholder}
      action={() => setFocusView((current) => (current === "remote" ? null : "remote"))}
      actionTitle={focusView === "remote" ? "Minimize remote camera" : "Maximize remote camera"}
      pinned={focusView === "remote"}
    />
  );

  const screenIsFullscreen = focusView === "screen";

  return (
    <div className={`relative flex h-full w-full flex-col bg-black/95 ${!autoStart ? "rounded-none" : ""}`}>
      {!screenIsFullscreen && (
        <>
          <div className="relative flex-1 min-h-0 w-full p-2">
            {focusView === "local" || focusView === "remote" ? (
              <div className="relative h-full w-full min-h-0">
                <div className="h-full w-full min-h-0">{focusView === "local" ? localTile : remoteTile}</div>
              </div>
            ) : hasAnyScreenShare ? (
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_180px] gap-2 md:grid-rows-[minmax(0,1fr)_32%]">
                <div className="min-h-0">{screenTile}</div>
                <div className="grid min-h-0 grid-cols-2 gap-2">
                  {localTile}
                  {remoteTile}
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-0 grid-cols-2 gap-2">
                {localTile}
                {remoteTile}
              </div>
            )}
          </div>

          <div className="z-20 flex h-12 shrink-0 items-center justify-between border-t border-white/10 bg-gray-900/90 px-2 backdrop-blur md:h-16 md:px-6">
            <div className="flex w-[30%] flex-col truncate">
              <span className="truncate text-[10px] font-medium uppercase tracking-wider text-white/70 md:text-[11px]">
                {error
                  ? error
                  : active
                    ? "Call Connected"
                    : callChannelReady
                      ? role === "interviewee"
                        ? "Starting Call..."
                        : "Waiting For Candidate..."
                      : "Connecting..."}
              </span>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2 md:gap-3">
              <Controls
                micOn={micOn}
                camOn={camOn}
                screenShareActive={screenShareActive}
                showSettings={showSettings}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onToggleScreenShare={toggleScreenShare}
                onToggleSettings={() => setShowSettings((value) => !value)}
              />
            </div>

            <div className="w-[30%]" />
          </div>
        </>
      )}

      {screenIsFullscreen && (
        <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col bg-black md:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-2 md:p-6">
            <div className="h-full w-full">{screenTile}</div>

            <button
              onClick={() => {
                setFocusView(null);
                setSidebarMode("full");
              }}
              className="absolute left-6 top-6 z-50 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/80"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 className="h-5 w-5" />
            </button>

            {sidebarMode === "hidden" && (
              <>
                <button
                  onClick={() => setSidebarMode("full")}
                  className="absolute right-6 top-6 z-50 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/80"
                  title="Show Participants"
                >
                  <Users className="h-5 w-5" />
                </button>
                <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-gray-900/90 px-6 py-3 backdrop-blur shadow-2xl">
                  <Controls
                    micOn={micOn}
                    camOn={camOn}
                    screenShareActive={screenShareActive}
                    showSettings={showSettings}
                    onToggleMic={toggleMic}
                    onToggleCam={toggleCam}
                    onToggleScreenShare={toggleScreenShare}
                    onToggleSettings={() => setShowSettings((value) => !value)}
                  />
                </div>
                <div className="absolute right-6 top-6 z-50 flex flex-col gap-3 w-40 md:w-48 pointer-events-none">
                  <div className="aspect-[4/3] w-full pointer-events-auto overflow-hidden shadow-2xl border border-white/10 rounded-xl relative bg-black shrink-0">{localTile}</div>
                  <div className="aspect-[4/3] w-full pointer-events-auto overflow-hidden shadow-2xl border border-white/10 rounded-xl relative bg-black shrink-0">{remoteTile}</div>
                </div>
              </>
            )}
          </div>

          {sidebarMode !== "hidden" && (
            <div
              className={`flex shrink-0 flex-col border-t border-white/10 bg-black/60 backdrop-blur transition-all duration-300 md:h-full md:border-l md:border-t-0 ${
                sidebarMode === "full" ? "h-[34%] w-full md:w-[24rem]" : "h-[34%] w-full md:w-24"
              }`}
            >
              <div className="hidden h-14 items-center justify-between border-b border-white/10 px-4 md:flex">
                {sidebarMode === "full" ? <span className="text-sm font-semibold tracking-wide text-white">Participants</span> : null}
                <button
                  onClick={() => setSidebarMode((value) => (value === "full" ? "compact" : value === "compact" ? "hidden" : "full"))}
                  className="ml-auto rounded p-1 text-white/70 transition hover:text-white"
                  title={sidebarMode === "full" ? "Collapse cameras" : sidebarMode === "compact" ? "Hide sidebar" : "Expand sidebar"}
                >
                  {sidebarMode === "full" ? <Minimize2 className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                </button>
              </div>

              {sidebarMode === "full" && (
                <div className="flex flex-1 items-center justify-center overflow-auto p-2">
                  <div className="flex w-full max-w-[260px] flex-row gap-2 md:flex-col">
                    <div className="aspect-[4/3] flex-1">{localTile}</div>
                    <div className="aspect-[4/3] flex-1">{remoteTile}</div>
                  </div>
                </div>
              )}

              <div
                className={`mt-auto shrink-0 border-white/10 ${
                  sidebarMode === "compact"
                    ? "flex flex-row items-center justify-center gap-4 p-3 md:flex-col"
                    : "flex flex-wrap justify-center gap-2 border-t p-4"
                }`}
              >
                <Controls
                  micOn={micOn}
                  camOn={camOn}
                  screenShareActive={screenShareActive}
                  showSettings={showSettings}
                  onToggleMic={toggleMic}
                  onToggleCam={toggleCam}
                  onToggleScreenShare={toggleScreenShare}
                  onToggleSettings={() => setShowSettings((value) => !value)}
                />

                <div className="md:hidden">
                  <button
                    className="rounded-full bg-red-600 p-3 text-white transition hover:bg-red-700"
                    onClick={() => {
                      setFocusView(null);
                      setSidebarMode("full");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 p-6 text-left backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
              <Settings className="h-4 w-4" /> Device Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-gray-400">Camera</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={videoDeviceId}
                  onChange={(event) => setVideoDeviceId(event.target.value)}
                >
                  <option value="">Default Camera</option>
                  {devices.filter((device) => device.kind === "videoinput").map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-gray-400">Microphone</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={audioDeviceId}
                  onChange={(event) => setAudioDeviceId(event.target.value)}
                >
                  <option value="">Default Microphone</option>
                  {devices.filter((device) => device.kind === "audioinput").map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Mic ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white transition hover:bg-gray-700"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                  onClick={switchDevices}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
