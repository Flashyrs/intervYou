"use client";
import { useEffect, useRef, useState } from "react";
import { applyAnswer, createAnswer, createOffer, setupPeerConnection } from "@/lib/webrtc";
import { broadcast, onSignal } from "@/lib/realtime";

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

  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const { pc, localStream, remoteStream } = await setupPeerConnection();
        
        if (!mounted) {
          // Cleanup if component unmounted during setup
          localStream?.getTracks().forEach(track => track.stop());
          pc.close();
          return;
        }

        pcRef.current = pc;

        // Set up local video
        if (localRef.current && localStream) {
          localRef.current.srcObject = localStream;
        }

        // Set up remote video
        if (remoteRef.current) {
          remoteRef.current.srcObject = remoteStream;
        }

        // Enumerate devices
        try {
          const devs = await navigator.mediaDevices.enumerateDevices();
          if (mounted) setDevices(devs);
        } catch (e) {
          console.warn("Failed to enumerate devices", e);
        }

        // Monitor connection state
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

        // Handle ICE candidates
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

        // Subscribe to signaling channel
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
            } else if (payload.type === "call-answer" && role === "interviewee") {
              await applyAnswer(pc, payload.sdp);
            } else if (payload.type === "ice-candidate") {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                console.warn("Failed to add ICE candidate", e);
              }
            }
          } catch (e) {
            console.error("Signaling error", e);
            if (mounted) setError("Signaling error occurred");
          }
        });

        channelRef.current = ch;

        // Subscribe to channel
        if (ch && (!ch.state || ch.state === "closed")) {
          await ch.subscribe();
        }

        // Auto-start call for interviewee
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
      
      // Cleanup channel
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe?.();
        } catch (e) {
          console.warn("Channel cleanup error", e);
        }
      }

      // Cleanup peer connection
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
  }, [room, role, autoStart]);

  const startCall = async () => {
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
      }
      
      setError("");
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
    <div className="border rounded p-3 space-y-2 bg-gray-900">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}
      
      <div className="flex gap-2">
        <div className="w-1/2 relative">
          <video 
            ref={localRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full bg-black rounded aspect-video object-cover" 
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            You ({role})
          </div>
        </div>
        <div className="w-1/2 relative">
          <video 
            ref={remoteRef} 
            autoPlay 
            playsInline 
            className="w-full bg-black rounded aspect-video object-cover" 
          />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            Remote
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {role === "interviewee" && !active && (
          <button 
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition" 
            onClick={startCall}
          >
            Start Call
          </button>
        )}
        
        <button 
          className={`px-3 py-1 rounded transition ${
            micOn 
              ? "bg-gray-700 text-white hover:bg-gray-600" 
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
          onClick={toggleMic}
        >
          {micOn ? "🎤 Mute" : "🔇 Unmute"}
        </button>
        
        <button 
          className={`px-3 py-1 rounded transition ${
            camOn 
              ? "bg-gray-700 text-white hover:bg-gray-600" 
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
          onClick={toggleCam}
        >
          {camOn ? "📹 Stop Cam" : "📷 Start Cam"}
        </button>

        <select 
          className="border rounded px-2 py-1 text-sm bg-gray-800 text-white" 
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

        <select 
          className="border rounded px-2 py-1 text-sm bg-gray-800 text-white" 
          value={audioDeviceId} 
          onChange={(e) => setAudioDeviceId(e.target.value)}
        >
          <option value="">Default Mic</option>
          {devices
            .filter((d) => d.kind === "audioinput")
            .map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
        </select>

        <button 
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm" 
          onClick={switchDevices}
        >
          Apply Devices
        </button>

        {active && (
          <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Connected
          </span>
        )}
        
        {!active && connectionState !== "new" && (
          <span className="text-yellow-400 text-sm">
            {connectionState}
          </span>
        )}
      </div>
    </div>
  );
}
