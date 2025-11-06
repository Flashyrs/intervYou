"use client";
import { useEffect, useRef, useState } from "react";
import { applyAnswer, createAnswer, createOffer, setupPeerConnection } from "@/lib/webrtc";
import { broadcast, onSignal } from "@/lib/realtime";

export default function VideoCall({ room, role, autoStart = true }: { room: string; role: "interviewer" | "interviewee"; autoStart?: boolean }) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [active, setActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");

  useEffect(() => {
    let unsub: any;
    (async () => {
      const { pc, localStream, remoteStream } = await setupPeerConnection();
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setDevices(devs);
      } catch {}
      pcRef.current = pc;
      if (localRef.current && localStream) {
        localRef.current.srcObject = localStream;
      }
      if (remoteRef.current) {
        remoteRef.current.srcObject = remoteStream;
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          broadcast(room, { type: "ice-candidate", from: role, sessionId: room, candidate: e.candidate });
        }
      };

      const ch = onSignal(room, async (payload) => {
        if (!payload) return;
        if (payload.type === "call-offer" && role === "interviewer") {
          const answer = await createAnswer(pc, payload.sdp);
          broadcast(room, { type: "call-answer", from: role, sessionId: room, sdp: answer });
          setActive(true);
        } else if (payload.type === "call-answer" && role === "interviewee") {
          await applyAnswer(pc, payload.sdp);
          setActive(true);
        } else if (payload.type === "ice-candidate") {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch (e) {
            console.warn("addIceCandidate failed", e);
          }
        }
      });

      unsub = ch;
    })();

    return () => {
      if (unsub) {
        // @ts-ignore
        unsub.unsubscribe?.();
      }
      try {
        pcRef.current?.getSenders().forEach((s) => s.track?.stop());
        pcRef.current?.close();
      } catch {}
    };

    // Auto start for interviewee only
    if (role === "interviewee" && autoStart) {
      // Delay to ensure signaling channel subscription
      setTimeout(() => {
        startCall().catch(() => {});
      }, 300);
    }
  }, [room, role, autoStart]);

  const startCall = async () => {
    if (!pcRef.current) return;
    const offer = await createOffer(pcRef.current);
    broadcast(room, { type: "call-offer", from: role, sessionId: room, sdp: offer });
  };

  const switchDevices = async () => {
    if (!pcRef.current) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      });
      const videoTrack = newStream.getVideoTracks()[0];
      const audioTrack = newStream.getAudioTracks()[0];
      const senders = pcRef.current.getSenders();
      const vSender = senders.find((s) => s.track && s.track.kind === "video");
      const aSender = senders.find((s) => s.track && s.track.kind === "audio");
      if (vSender && videoTrack) await vSender.replaceTrack(videoTrack);
      if (aSender && audioTrack) await aSender.replaceTrack(audioTrack);
      if (localRef.current) localRef.current.srcObject = newStream;
    } catch (e) {
      console.warn("switch devices failed", e);
    }
  };

  const toggleMic = () => {
    const stream = localRef.current?.srcObject as MediaStream | null;
    stream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((s) => !s);
  };
  const toggleCam = () => {
    const stream = localRef.current?.srcObject as MediaStream | null;
    stream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((s) => !s);
  };

  return (
    <div className="border rounded p-3 space-y-2">
      <div className="flex gap-2">
        <video ref={localRef} autoPlay playsInline muted className="w-1/2 bg-black rounded" />
        <video ref={remoteRef} autoPlay playsInline className="w-1/2 bg-black rounded" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {role === "interviewee" && (
          <button className="px-3 py-1 bg-black text-white rounded" onClick={startCall}>Start Call</button>
        )}
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={toggleMic}>{micOn ? "Mute" : "Unmute"}</button>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={toggleCam}>{camOn ? "Stop Cam" : "Start Cam"}</button>
        <select className="border rounded px-2 py-1" value={videoDeviceId} onChange={(e) => setVideoDeviceId(e.target.value)}>
          <option value="">Default Camera</option>
          {devices.filter(d => d.kind === 'videoinput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
        </select>
        <select className="border rounded px-2 py-1" value={audioDeviceId} onChange={(e) => setAudioDeviceId(e.target.value)}>
          <option value="">Default Mic</option>
          {devices.filter(d => d.kind === 'audioinput').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
        </select>
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={switchDevices}>Apply Devices</button>
        {active && <span className="text-green-600 text-sm">Connected</span>}
      </div>
    </div>
  );
}
