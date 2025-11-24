export type RTCSetup = {
  pc: RTCPeerConnection;
  localStream: MediaStream | null;
  remoteStream: MediaStream;
};



const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    
    
    
    
    
    
    
  ],
  iceCandidatePoolSize: 10,
};

export async function setupPeerConnection(): Promise<RTCSetup> {
  const pc = new RTCPeerConnection(rtcConfig);
  const remoteStream = new MediaStream();
  let localStream: MediaStream | null = null;

  
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  
  pc.onconnectionstatechange = () => {
    console.log("Connection state:", pc.connectionState);
    if (pc.connectionState === "failed") {
      console.error("WebRTC connection failed");
    }
  };

  
  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      console.error("ICE connection failed - may need TURN server");
    }
  };

  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      }, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream!);
    });
  } catch (e) {
    console.warn("getUserMedia failed, trying audio only", e);
    
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: false, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream!);
      });
    } catch (audioError) {
      console.warn("Audio also failed, continuing without media", audioError);
      
    }
  }

  return { pc, localStream, remoteStream };
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(
  pc: RTCPeerConnection, 
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function applyAnswer(
  pc: RTCPeerConnection, 
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}
