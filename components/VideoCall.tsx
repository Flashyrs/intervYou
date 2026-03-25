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
  const focusVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

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
        stopScreenShare().catch(() => {});
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
    const remoteScreenEl = remoteScreenRef.current;

    const ch = onSignal(screenShareRoom, async (payload) => {
      if (!payload || !mounted) return;

      try {
        if (payload.type === "screen-share-offer" && roleRef.current === "interviewer") {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            iceCandidatePoolSize: 10,
          });
          screenSharePcRef.current = pc;

          pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
              remoteScreenStream.addTrack(track);
            });
            if (remoteScreenEl) {
              remoteScreenEl.srcObject = remoteScreenStream;
              safePlay(remoteScreenEl, "remote-screen");
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
        } else if (payload.type === "screen-share-answer" && roleRef.current === "interviewee" && screenSharePcRef.current) {
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
          if (remoteScreenEl) {
            remoteScreenEl.srcObject = null;
          }
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
      setRemoteScreenActive(false);
    };
  }, [screenShareRoom]);

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

  return (
    <div className="relative w-full max-w-[600px] flex flex-col bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 mx-auto">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <span>{error}</span>
          <button onClick={handleReconnect} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-bold">Retry</button>
        </div>
      )}

      <div className="flex-1 flex flex-row gap-2 p-2 min-h-0 justify-center items-center">
        {/* Local Video */}
        <div className="relative w-1/2 aspect-square bg-gray-900 rounded-lg overflow-hidden group">
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
            className={`w-full h-full object-cover transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`}
          />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-400">You</span>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${micOn ? 'bg-green-500' : 'bg-red-500'}`} />
            You
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative w-1/2 aspect-square bg-gray-900 rounded-lg overflow-hidden group">
          <button
            type="button"
            className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
            onClick={() => setFocusView("remote")}
            title="Maximize interviewer/interviewee camera"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <video
            ref={remoteRef}
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            {active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}
          </div>
        </div>
      </div>

      {remoteScreenActive && (
        <div className="px-2 pb-2">
          <div className="relative w-full aspect-video bg-gray-950 rounded-lg overflow-hidden border border-white/10 group">
            <button
              type="button"
              className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
              onClick={() => setFocusView("screen")}
              title="Maximize shared screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <video
              ref={remoteScreenRef}
              playsInline
              className="w-full h-full object-contain bg-black"
            />
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full">
              Screen Share
            </div>
          </div>
        </div>
      )}

      { }
      <div className="h-12 md:h-16 bg-gray-900/90 backdrop-blur border-t border-white/10 flex items-center justify-between px-2 md:px-6 shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-white/70 uppercase tracking-wider font-medium">
          {active
            ? "Call Connected"
            : callChannelReady
              ? role === "interviewee"
                ? "Starting Call..."
                : "Waiting For Candidate..."
              : "Connecting Signaling..."}
        </div>

        <div className="flex items-center gap-3">
          <button
            className={`p-2 md:p-3 rounded-full transition-all duration-200 ${micOn
              ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105"
              : "bg-red-500 text-white hover:bg-red-600 hover:scale-105 shadow-lg shadow-red-900/20"
              }`}
            onClick={toggleMic}
            title={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          <button
            className={`p-2 md:p-3 rounded-full transition-all duration-200 ${camOn
              ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105"
              : "bg-red-500 text-white hover:bg-red-600 hover:scale-105 shadow-lg shadow-red-900/20"
              }`}
            onClick={toggleCam}
            title={camOn ? "Stop Camera" : "Start Camera"}
          >
            {camOn ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <VideoOff className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          <button
            className={`p-2 md:p-3 rounded-full transition-all duration-200 ${screenShareActive
              ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-lg shadow-indigo-900/20"
              : "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105"
              }`}
            onClick={() => {
              if (screenShareActive) {
                stopScreenShare().catch(() => {});
              } else {
                startScreenShare().catch(() => {});
              }
            }}
            title={screenShareActive ? "Stop Screen Share" : "Start Screen Share"}
          >
            <Monitor className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          <div className="w-px h-8 bg-gray-700 mx-1" />

          <button
            className={`p-3 rounded-full transition-all duration-200 ${showSettings
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
              : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        <div className="w-24" /> { }
      </div>

      { }
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-6 animate-in fade-in duration-200">
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
                  {devices
                    .filter((d) => d.kind === "videoinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
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
                  {devices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
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

      {focusView && (
        <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white">
                {focusView === "local"
                  ? "Your Camera"
                  : focusView === "remote"
                    ? "Participant Camera"
                    : "Shared Screen"}
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Focused view for better interview visibility.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
                onClick={() => setFocusView(null)}
                title="Close focused view"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
                onClick={() => setFocusView(null)}
                title="Close focused view"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-4">
            <div className="h-full w-full rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
              {focusView === "screen" && !remoteScreenActive ? (
                <div className="text-center text-white/70">
                  <Monitor className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-sm">No screen share is active right now.</p>
                </div>
              ) : (
                <video
                  ref={focusVideoRef}
                  playsInline
                  autoPlay
                  muted={focusView === "local"}
                  className={`h-full w-full ${focusView === "screen" ? "object-contain bg-black" : "object-cover"}`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
