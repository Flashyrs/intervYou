"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { applyAnswer, createAnswer, createOffer, setupPeerConnection } from "@/lib/webrtc";
import { broadcast, onSignal } from "@/lib/realtime";
import { Mic, MicOff, Video, VideoOff, Settings, Monitor, Maximize2, Minimize2, X } from "lucide-react";

/**
 * Safely call play() only when the element is actually paused and has a src.
 * This prevents the DOMException: "play() request was interrupted" that occurs
 * when play() is called while another play/load is already in-flight.
 */
function safePlay(el: HTMLVideoElement, label: string) {
  // readyState 0 = HAVE_NOTHING (no src yet) — nothing to play
  if (!el.srcObject && !el.src) return;
  if (!el.paused) return; // already playing, no-op
  const promise = el.play();
  if (promise !== undefined) {
    promise.catch((err: unknown) => {
      // AbortError is expected when the component unmounts mid-play — suppress it.
      // Any other error is worth logging.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn(`[VideoCall] ${label} play() failed:`, err);
    });
  }
}

export default function VideoCall({
  room,
  screenShareRoom,
  role,
  autoStart = true
}: {
  room: string;
  screenShareRoom?: string;
  role: "interviewer" | "interviewee";
  autoStart?: boolean;
}) {
  const roleRef = useRef(role);
  const hasAutoStartedRef = useRef(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  const remoteScreenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const screenSharePcRef = useRef<RTCPeerConnection | null>(null);
  const screenShareChannelRef = useRef<any>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [remoteScreenActive, setRemoteScreenActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const [connectionState, setConnectionState] = useState<string>("new");
  const [error, setError] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [callChannelReady, setCallChannelReady] = useState(false);
  const [screenShareChannelReady, setScreenShareChannelReady] = useState(false);
  const [focusView, setFocusView] = useState<"local" | "remote" | "screen" | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"full" | "compact" | "hidden">("full");
  const focusVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // Handle ESC key to exit focus view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusView(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto fullscreen when screen sharing starts
  useEffect(() => {
    if (remoteScreenActive) setFocusView("screen");
  }, [remoteScreenActive]);

  const startCall = useCallback(async () => {
    if (!pcRef.current) {
      setError("Connection not initialized");
      return;
    }

    try {
      if (!channelRef.current) {
        setError("Signal channel not ready");
        return;
      }
      const offer = await createOffer(pcRef.current);
      broadcast(channelRef.current, {
        type: "call-offer",
        from: roleRef.current,
        sessionId: room,
        sdp: offer
      });
      setError("");
    } catch (e) {
      console.error("Failed to start call", e);
      setError("Failed to start call");
    }
  }, [room]);

  const stopScreenShare = useCallback(async () => {
    localScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
    localScreenStreamRef.current = null;
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

      displayStream.getTracks().forEach((track) => pc.addTrack(track, displayStream));

      pc.onicecandidate = (e) => {
        if (e.candidate && screenShareChannelRef.current) {
          broadcast(screenShareChannelRef.current, {
            type: "screen-share-ice-candidate",
            from: roleRef.current,
            sessionId: screenShareRoom,
            candidate: e.candidate,
          });
        }
      };

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenShare().catch(() => { });
      });

      const offer = await createOffer(pc);
      if (screenShareChannelRef.current) {
        broadcast(screenShareChannelRef.current, {
          type: "screen-share-offer",
          from: roleRef.current,
          sessionId: screenShareRoom,
          sdp: offer,
        });
      }

      setScreenShareActive(true);
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
        console.log("Initializing Video Call Peer Connection...");
        const { pc, localStream, remoteStream } = await setupPeerConnection();

        if (!mounted) {
          localStream?.getTracks().forEach(track => track.stop());
          pc.close();
          return;
        }

        pcRef.current = pc;
        const pendingIceCandidates: RTCIceCandidate[] = [];

        if (localRef.current && localStream) {
          localRef.current.srcObject = localStream;
          safePlay(localRef.current, "local");
        }

        if (remoteRef.current) {
          remoteRef.current.srcObject = remoteStream;
          safePlay(remoteRef.current, "remote");
        }

        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          if (mounted) setDevices(devs);
        } catch (e) {
          console.warn("Failed to enumerate devices", e);
        }

        pc.onconnectionstatechange = () => {
          console.log(`PC Connection State: ${pc.connectionState}`);
          if (mounted) {
            setConnectionState(pc.connectionState);
            if (pc.connectionState === "connected") {
              setActive(true);
              setError("");
            } else if (pc.connectionState === "failed") {
              setError("Connection failed. Please check your network or firewall.");
              setActive(false);
            }
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && channelRef.current) {
            broadcast(channelRef.current, {
              type: "ice-candidate",
              from: roleRef.current,
              sessionId: room,
              candidate: e.candidate
            });
          }
        };

        const ch = onSignal(room, async (payload) => {
          if (!payload || !mounted) return;

          try {
            console.log(`Processing signal: ${payload.type} from ${payload.from}`);

            if (payload.type === "call-offer" && roleRef.current === "interviewer") {
              console.log("Received Offer, creating Answer...");
              const answer = await createAnswer(pc, payload.sdp);
              if (channelRef.current) {
                broadcast(channelRef.current, {
                  type: "call-answer",
                  from: roleRef.current,
                  sessionId: room,
                  sdp: answer
                });
              }

              // Apply loose ICE candidates
              while (pendingIceCandidates.length > 0) {
                const candidate = pendingIceCandidates.shift();
                if (candidate) {
                  await pc.addIceCandidate(candidate).catch(e => console.warn("Failed adding queued ICE", e));
                }
              }

            } else if (payload.type === "call-answer" && roleRef.current === "interviewee") {
              console.log("Received Answer, applying...");
              await applyAnswer(pc, payload.sdp);

              while (pendingIceCandidates.length > 0) {
                const candidate = pendingIceCandidates.shift();
                if (candidate) {
                  await pc.addIceCandidate(candidate).catch(e => console.warn("Failed adding queued ICE", e));
                }
              }

            } else if (payload.type === "ice-candidate") {
              // Only add ICE if we have a remote description, otherwise queue
              const candidate = new RTCIceCandidate(payload.candidate);
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(candidate).catch(e => console.warn("Failed adding ICE", e));
              } else {
                console.log("Queueing ICE candidate (no remote description yet)");
                pendingIceCandidates.push(candidate);
              }
            }
          } catch (e) {
            console.error("Signaling processing error", e);
          }
        }, (status) => {
          if (!mounted) return;
          setCallChannelReady(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED" && roleRef.current === "interviewee" && autoStart && !hasAutoStartedRef.current) {
            hasAutoStartedRef.current = true;
            startCall().catch((e) => {
              console.error("Auto-start failed", e);
              if (mounted) setError("Failed to start call");
            });
          }
        });

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
      localScreenStreamRef.current?.getTracks().forEach((track) => track.stop());
      localScreenStreamRef.current = null;
      if (screenSharePcRef.current) {
        screenSharePcRef.current.close();
        screenSharePcRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [room, autoStart, startCall]);

  useEffect(() => {
    if (!screenShareRoom) return;

    let mounted = true;
    setScreenShareChannelReady(false);
    const remoteScreenStream = new MediaStream();
    const pendingIceCandidates: RTCIceCandidate[] = [];
    remoteScreenStreamRef.current = remoteScreenStream;
    const remoteScreenEl = remoteScreenRef.current;

    const ch = onSignal(screenShareRoom, async (payload) => {
      if (!payload || !mounted) return;

      try {
        if (payload.type === "screen-share-offer" && payload.from !== roleRef.current) {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            iceCandidatePoolSize: 10,
          });
          screenSharePcRef.current = pc;

          pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
              remoteScreenStream.addTrack(track);
            });
            if (remoteScreenRef.current) {
              remoteScreenRef.current.srcObject = remoteScreenStream;
              safePlay(remoteScreenRef.current, "remote-screen");
            }
            setRemoteScreenActive(true);
          };

          pc.onicecandidate = (e) => {
            if (e.candidate && screenShareChannelRef.current) {
              broadcast(screenShareChannelRef.current, {
                type: "screen-share-ice-candidate",
                from: roleRef.current,
                sessionId: screenShareRoom,
                candidate: e.candidate,
              });
            }
          };

          const answer = await createAnswer(pc, payload.sdp);
          if (screenShareChannelRef.current) {
            broadcast(screenShareChannelRef.current, {
              type: "screen-share-answer",
              from: roleRef.current,
              sessionId: screenShareRoom,
              sdp: answer,
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
          if (targetPc?.remoteDescription && targetPc.remoteDescription.type) {
            await targetPc.addIceCandidate(candidate).catch((e) => console.warn("Failed adding screen-share ICE", e));
          } else {
            pendingIceCandidates.push(candidate);
          }
        } else if (payload.type === "screen-share-stopped") {
          setRemoteScreenActive(false);
          if (remoteScreenRef.current) {
            remoteScreenRef.current.srcObject = null;
          }
          remoteScreenStreamRef.current = null;
          screenSharePcRef.current?.close();
          screenSharePcRef.current = null;
        }
      } catch (e) {
        console.error("Screen share signaling error", e);
      }
    }, (status) => {
      if (!mounted) return;
      setScreenShareChannelReady(status === "SUBSCRIBED");
    });

    screenShareChannelRef.current = ch;

    return () => {
      mounted = false;
      if (remoteScreenEl) {
        remoteScreenEl.srcObject = null;
      }
      remoteScreenStreamRef.current = null;
      setRemoteScreenActive(false);
    };
  }, [screenShareRoom]);

  useEffect(() => {
    if (!remoteScreenActive || !remoteScreenRef.current || !remoteScreenStreamRef.current) return;
    remoteScreenRef.current.srcObject = remoteScreenStreamRef.current;
    safePlay(remoteScreenRef.current, "remote-screen-mounted");
  }, [remoteScreenActive]);

  const handleReconnect = async () => {
    setError("");
    setConnectionState("new");
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // Force re-mount effect
    window.location.reload(); // Simple but effective for full reset
  };



  const switchDevices = async () => {
    if (!pcRef.current) return;

    try {
      const constraints: MediaStreamConstraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];
      const audioTrack = newStream.getAudioTracks()[0];

      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video");
      const audioSender = senders.find((s) => s.track?.kind === "audio");

      if (videoSender && videoTrack) {
        await videoSender.replaceTrack(videoTrack);
      }
      if (audioSender && audioTrack) {
        await audioSender.replaceTrack(audioTrack);
      }

      if (localRef.current) {
        localRef.current.srcObject = newStream;
        safePlay(localRef.current, "local (device switch)");
      }

      setError("");
      setShowSettings(false);
    } catch (e) {
      console.error("Failed to switch devices", e);
      setError("Failed to switch devices");
    }
  };

  const toggleMic = () => {
    const stream = localRef.current?.srcObject as MediaStream | null;
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicOn((prev) => !prev);
    }
  };

  const toggleCam = () => {
    const stream = localRef.current?.srcObject as MediaStream | null;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCamOn((prev) => !prev);
    }
  };

  useEffect(() => {
    if (!focusView || !focusVideoRef.current) return;
    const focusVideoEl = focusVideoRef.current;

    const source =
      focusView === "local"
        ? localRef.current
        : focusView === "remote"
          ? remoteRef.current
          : remoteScreenRef.current;

    if (!source?.srcObject) return;

    focusVideoEl.srcObject = source.srcObject;
    safePlay(focusVideoEl, `focus-${focusView}`);

    return () => {
      focusVideoEl.srcObject = null;
    };
  }, [focusView, active, remoteScreenActive, camOn, screenShareActive]);


  const isVideoFullscreen = focusView === "screen" || focusView === "local" || focusView === "remote";
  const isScreenShareStandard = !isVideoFullscreen && (screenShareActive || remoteScreenActive);

  return (
    <div className={`relative flex flex-col w-full h-full bg-black/95 ${!autoStart ? 'rounded-none' : ''}`}>
      {/* 
        STATE 1 & 2: Default and Screen Share (non-fullscreen) 
      */}
      {!isVideoFullscreen && (
        <div className="flex-1 w-full h-full flex flex-col p-2 space-y-2 relative">
          
          {/* Main Screenshare Area (State 2) */}
          {isScreenShareStandard && (
             <div className="flex-1 w-full flex bg-gray-950 rounded-lg overflow-hidden relative group border border-white/10 items-center justify-center">
               <button
                  type="button"
                  className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                  onClick={() => setFocusView("screen")}
                  title="Maximize shared screen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <video
                  ref={(el) => {
                     if (!el) return;
                     if (screenShareActive && localScreenStreamRef.current) {
                        el.srcObject = localScreenStreamRef.current;
                     } else if (remoteScreenRef) {
                        (remoteScreenRef as any).current = el;
                     }
                  }}
                  playsInline
                  autoPlay
                  muted={screenShareActive}
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full">
                  Screen Share
                </div>
             </div>
          )}

          {/* Videos Row (State 1 & 2) */}
          <div className={`w-full flex flex-row gap-2 ${isScreenShareStandard ? 'h-[30%]' : 'flex-1'}`}>
            {/* Local Video */}
            <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center">
               {!camOn ? (
                  <div className="flex flex-col items-center justify-center text-white/50">
                     <VideoOff className="w-8 h-8 md:w-10 md:h-10 mb-2" />
                     <span className="text-xs">Camera Off</span>
                  </div>
               ) : (
                  <>
                    <button
                      type="button"
                      className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                      onClick={() => setFocusView("local")}
                      title="Maximize your camera"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <video
                      ref={localRef}
                      playsInline
                      muted
                      autoPlay
                      className="max-h-full max-w-full object-contain"
                    />
                  </>
               )}
               <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${micOn ? 'bg-green-500' : 'bg-red-500'}`} />
                  You
               </div>
            </div>

            {/* Remote Video */}
            <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center">
               <button
                  type="button"
                  className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                  onClick={() => setFocusView("remote")}
                  title="Maximize remote camera"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <video
                  ref={remoteRef}
                  playsInline
                  autoPlay
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                  {active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Non-Fullscreen Bottom Toolbar (State 1 & 2) */}
      {!isVideoFullscreen && (
        <div className="h-12 md:h-16 bg-gray-900/90 backdrop-blur border-t border-white/10 flex items-center justify-between px-2 md:px-6 shrink-0 z-20">
          <div className="flex flex-col truncate w-[30%]">
            <span className="text-[10px] md:text-[11px] text-white/70 uppercase tracking-wider font-medium truncate">
              {active ? "Call Connected" : callChannelReady ? (role === "interviewee" ? "Starting Call..." : "Waiting For Candidate...") : "Connecting..."}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-3 shrink-0">
            <button
              className={`p-2 md:p-3 rounded-full transition-all duration-200 ${micOn ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105" : "bg-red-500 text-white hover:bg-red-600 hover:scale-105"}`}
              onClick={toggleMic}
              title={micOn ? "Mute" : "Unmute"}
            >
              {micOn ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
            <button
              className={`p-2 md:p-3 rounded-full transition-all duration-200 ${camOn ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105" : "bg-red-500 text-white hover:bg-red-600 hover:scale-105"}`}
              onClick={toggleCam}
              title={camOn ? "Stop Camera" : "Start Camera"}
            >
              {camOn ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <VideoOff className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
            <button
              className={`p-2 md:p-3 rounded-full transition-all duration-200 ${screenShareActive ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105" : "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105"}`}
              onClick={() => screenShareActive ? stopScreenShare().catch(()=>{}) : startScreenShare().catch(()=>{})}
              title={screenShareActive ? "Stop Screen Share" : "Start Screen Share"}
            >
              <Monitor className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="w-px h-8 bg-gray-700 mx-1" />
            <button
              className={`p-3 rounded-full transition-all duration-200 ${showSettings ? "bg-indigo-600 text-white shadow-lg" : "bg-gray-700 text-white hover:bg-gray-600"}`}
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          
          <div className="w-[30%] flex justify-end">
             {/* Empty placeholder for alignment */}
          </div>
        </div>
      )}

      {/* STATE 3: Fullscreen Focus View */}
      {isVideoFullscreen && (
        <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-black flex flex-col md:flex-row">
            
            {/* Main Fullscreen Area */}
            <div className="flex-1 h-full flex flex-col items-center justify-center relative p-2 md:p-6 transition-all duration-300">
               {focusView === "screen" && (!remoteScreenActive && !screenShareActive) ? (
                  <div className="text-center text-white/70">
                     <Monitor className="w-8 h-8 mx-auto mb-3" />
                     <p className="text-sm">No screen share is active right now.</p>
                  </div>
               ) : (
                  <video
                    ref={focusVideoRef}
                    playsInline
                    autoPlay
                    muted={focusView === "local" || (focusView === "screen" && screenShareActive)}
                    className="max-h-full max-w-full object-contain shrink-0 flex-1"
                  />
               )}
               
               {/* Fixed Toggle Sidebar Button inside main area if sidebar is hidden */}
               {sidebarMode === "hidden" && (
                  <button 
                    onClick={() => setSidebarMode("full")}
                    className="absolute top-6 right-6 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur z-50 transition"
                    title="Show Sidebar"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
               )}
               <button 
                  onClick={() => setFocusView(null)}
                  className="absolute top-6 left-6 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur z-50 transition"
                  title="Exit Fullscreen (Esc)"
               >
                  <Minimize2 className="w-5 h-5" />
               </button>

               {/* Absolute bottom controls if sidebar is hidden */}
               {sidebarMode === "hidden" && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur border border-white/10 rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl z-50">
                     <button
                        className={`p-3 rounded-full transition-all duration-200 ${micOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}`}
                        onClick={toggleMic}
                     >
                        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                     </button>
                     <button
                        className={`p-3 rounded-full transition-all duration-200 ${camOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}`}
                        onClick={toggleCam}
                     >
                        {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                     </button>
                  </div>
               )}
            </div>

            {/* Right Sidebar */}
            {sidebarMode !== "hidden" && (
              <div 
                className={`h-1/3 md:h-full border-t md:border-t-0 md:border-l border-white/10 bg-black/60 backdrop-blur transition-all duration-300 flex flex-col ${sidebarMode === "full" ? 'w-full md:w-[25%] lg:w-[20%] min-w-[200px]' : 'w-full md:w-20'}`}
              >
                {/* Sidebar Header */}
                <div className="hidden md:flex h-14 items-center justify-between px-4 border-b border-white/10 shrink-0">
                  {sidebarMode === "full" && <span className="text-white text-sm font-semibold tracking-wide">Interview</span>}
                  <button 
                    onClick={() => setSidebarMode(sidebarMode === "full" ? "compact" : sidebarMode === "compact" ? "hidden" : "full")}
                    className="text-white/70 hover:text-white p-1 rounded transition ml-auto"
                  >
                    {sidebarMode === "full" ? <Minimize2 className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sidebar Videos (Full mode only) */}
                {sidebarMode === "full" && (
                  <div className="flex-1 flex flex-row md:flex-col p-2 gap-2 overflow-auto">
                    {/* Sidebar Local Video */}
                    <div className="flex-1 w-1/2 md:w-full md:max-h-[50%] bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">
                      {!camOn ? (
                        <div className="flex flex-col items-center justify-center text-white/50">
                          <VideoOff className="w-6 h-6 mb-1" />
                          <span className="text-[10px]">Camera Off</span>
                        </div>
                      ) : (
                        <video
                          muted
                          autoPlay
                          playsInline
                          className="max-h-full max-w-full object-contain"
                          ref={focusView === "local" ? undefined : localRef} 
                        />
                      )}
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 z-10">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${micOn ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="truncate max-w-[80px]">You</span>
                      </div>
                    </div>

                    {/* Sidebar Remote Video */}
                    <div className="flex-1 w-1/2 md:w-full md:max-h-[50%] bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">
                      <video
                        autoPlay
                        playsInline
                        className="max-h-full max-w-full object-contain"
                        ref={focusView === "remote" ? undefined : remoteRef}
                      />
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 z-10 w-fit">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                        <span className="truncate max-w-[80px]">{active ? "Remote" : "Connecting"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sidebar Controls (Compact & Full) */}
                <div className={`mt-auto md:border-t border-white/10 shrink-0 ${sidebarMode === "compact" ? "p-3 flex flex-row md:flex-col gap-4 items-center justify-center" : "p-4 flex flex-wrap gap-2 justify-center"}`}>
                  <button
                    className={`${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all ${micOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}`}
                    onClick={toggleMic}
                  >
                    {micOn ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
                  </button>
                  <button
                    className={`${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all ${camOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}`}
                    onClick={toggleCam}
                  >
                    {camOn ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <VideoOff className="w-4 h-4 md:w-5 md:h-5" />}
                  </button>
                  <button
                    className={`${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all ${screenShareActive ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"}`}
                    onClick={() => screenShareActive ? stopScreenShare().catch(()=>{}) : startScreenShare().catch(()=>{})}
                  >
                    <Monitor className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    className={`${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all ${showSettings ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"}`}
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  
                  {/* Exit full screen button for mobile compact mode */}
                  <div className="md:hidden">
                    <button
                      className="p-3 bg-red-600 hover:bg-red-700 text-white shrink-0 rounded-full transition-all"
                      onClick={() => setFocusView(null)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Global Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200 text-left">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Device Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase font-medium tracking-wider">Camera</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={videoDeviceId}
                  onChange={(e) => setVideoDeviceId(e.target.value)}
                >
                  <option value="">Default Camera</option>
                  {devices.filter((d) => d.kind === "videoinput").map((d) => {
                    return (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase font-medium tracking-wider">Microphone</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={audioDeviceId}
                  onChange={(e) => setAudioDeviceId(e.target.value)}
                >
                  <option value="">Default Microphone</option>
                  {devices.filter((d) => d.kind === "audioinput").map((d) => {
                    return (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="pt-4 flex gap-2">
                <button
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
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
