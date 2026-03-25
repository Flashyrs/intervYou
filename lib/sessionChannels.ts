export function getInterviewStateChannel(sessionId: string) {
  return `interview-state-${sessionId}`;
}

export function getWebRtcChannel(sessionId: string) {
  return `webrtc-${sessionId}`;
}

export function getScreenShareChannel(sessionId: string) {
  return `screenshare-${sessionId}`;
}

export function getWhiteboardChannel(sessionId: string) {
  return `whiteboard-${sessionId}`;
}
