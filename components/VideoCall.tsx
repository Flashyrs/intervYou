"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { applyAnswer, createAnswer, createOffer, setupPeerConnection } from "@/lib/webrtc";
import { broadcast, onSignal } from "@/lib/realtime";
import { Mic, MicOff, Video, VideoOff, Settings, Monitor, PhoneOff } from "lucide-react";

export default function VideoCall({
  room,
  role,
  autoStart = true
}: {
  room: string;
  role: "interviewer" | "interviewee";
  autoStart?: boolean;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const [connectionState, setConnectionState] = useState<string>("new");
  const [error, setError] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  const startCall = useCallback(async () => {
    if (!pcRef.current) {
      setError("Connection not initialized");
      return;
    }

    try {
      const offer = await createOffer(pcRef.current);
      broadcast(room, {
        type: "call-offer",
        from: role,
        sessionId: room,
        sdp: offer
      });
      setError("");
    } catch (e) {
      console.error("Failed to start call", e);
      setError("Failed to start call");
    }
  }, [room, role]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
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
          
          localRef.current.play().catch((e) => {
            console.warn("Local video autoplay failed, user interaction may be required", e);
          });
        }

        if (remoteRef.current) {
          remoteRef.current.srcObject = remoteStream;
          
          remoteRef.current.play().catch((e) => {
            console.warn("Remote video autoplay failed", e);
          });
        }

        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          if (mounted) setDevices(devs);
        } catch (e) {
          console.warn("Failed to enumerate devices", e);
        }

        pc.onconnectionstatechange = () => {
          if (mounted) {
            setConnectionState(pc.connectionState);
            if (pc.connectionState === "connected") {
              setActive(true);
              setError("");
            } else if (pc.connectionState === "failed") {
              setError("Connection failed. Please check your network.");
              setActive(false);
            }
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            broadcast(room, {
              type: "ice-candidate",
              from: role,
              sessionId: room,
              candidate: e.candidate
            });
          }
        };

        const ch = onSignal(room, async (payload) => {
          if (!payload || !mounted) return;

          try {
            if (payload.type === "call-offer" && role === "interviewer") {
              const answer = await createAnswer(pc, payload.sdp);
              broadcast(room, {
                type: "call-answer",
                from: role,
                sessionId: room,
                sdp: answer
              });
              
              while (pendingIceCandidates.length > 0) {
                const candidate = pendingIceCandidates.shift();
                if (candidate) {
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch (e) {
                    console.warn("Failed to add queued ICE candidate", e);
                  }
                }
              }
            } else if (payload.type === "call-answer" && role === "interviewee") {
              await applyAnswer(pc, payload.sdp);
              
              while (pendingIceCandidates.length > 0) {
                const candidate = pendingIceCandidates.shift();
                if (candidate) {
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch (e) {
                    console.warn("Failed to add queued ICE candidate", e);
                  }
                }
              }
            } else if (payload.type === "ice-candidate") {
              const candidate = new RTCIceCandidate(payload.candidate);
              
              if (pc.remoteDescription) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (e) {
                  console.warn("Failed to add ICE candidate", e);
                }
              } else {
                
                pendingIceCandidates.push(candidate);
              }
            }
          } catch (e) {
            console.error("Signaling error", e);
            if (mounted) setError("Signaling error occurred");
          }
        });

        channelRef.current = ch;

        if (ch && (!ch.state || ch.state === "closed")) {
          await ch.subscribe();
        }

        if (role === "interviewee" && autoStart) {
          setTimeout(() => {
            if (mounted) {
              startCall().catch((e) => {
                console.error("Auto-start failed", e);
                if (mounted) setError("Failed to start call");
              });
            }
          }, 500);
        }
      } catch (e) {
        console.error("Setup error", e);
        if (mounted) setError("Failed to initialize video call");
      }
    })();

    return () => {
      mounted = false;
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe?.();
        } catch (e) {
          console.warn("Channel cleanup error", e);
        }
      }
      if (pcRef.current) {
        try {
          pcRef.current.getSenders().forEach((sender) => {
            sender.track?.stop();
          });
          pcRef.current.close();
        } catch (e) {
          console.warn("PC cleanup error", e);
        }
      }
    };
  }, [room, role, autoStart, startCall]);



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
        localRef.current.play().catch((e) => {
          console.warn("Video play failed after device switch", e);
        });
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

  return (
    <div className="relative h-full flex flex-col bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-1 md:gap-2 p-1 md:p-2 min-h-0">
        {}
        <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden group">
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0'}`}
          />
          {!camOn && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-400">You</span>
              </div>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${micOn ? 'bg-green-500' : 'bg-red-500'}`} />
            You ({role})
          </div>
        </div>

        {}
        <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            {active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}
          </div>
        </div>
      </div>

      {}
      <div className="h-12 md:h-16 bg-gray-900/90 backdrop-blur border-t border-white/10 flex items-center justify-between px-2 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
          {role === "interviewee" && !active && (
            <button
              className="px-2 md:px-4 py-1 md:py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition font-medium text-xs md:text-sm shadow-lg shadow-green-900/20"
              onClick={startCall}
            >
              Start Call
            </button>
          )}
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

        <div className="w-24" /> {}
      </div>

      {}
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
    </div>
  );
}
