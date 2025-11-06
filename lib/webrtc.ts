export type RTCSetup = {
  pc: RTCPeerConnection;
  localStream: MediaStream | null;
  remoteStream: MediaStream;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export async function setupPeerConnection(): Promise<RTCSetup> {
  const pc = new RTCPeerConnection(rtcConfig);
  const remoteStream = new MediaStream();
  let localStream: MediaStream | null = null;

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t));
  };

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream!));
  } catch (e) {
    // If user blocks cam/mic, still allow connection for data-only
    console.warn("getUserMedia failed", e);
  }

  return { pc, localStream, remoteStream };
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function applyAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit) {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}
