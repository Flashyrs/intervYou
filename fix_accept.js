const fs = require('fs');
let content = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

let startIdx = content.indexOf('const accept = async (');
if(startIdx === -1) {
  startIdx = content.indexOf('const accept = async ()');
}
const endIdx = content.indexOf('const handleViewRecords', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newAccept = `const accept = async (invite: { tempId: string, initiatorId?: string }) => {
    if (!supabase || !invite) return;
    if (!session) { signIn(); return; }

    const res = await fetch("/api/random/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempId: invite.tempId, initiatorId: invite.initiatorId || "" }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409) {
        setIncoming((prev) => prev.filter((p) => p.tempId !== invite.tempId));
      }
      push({ message: data?.error || "Accept failed", type: "error" });
      return;
    }

    const sessionId = data.sessionId;
    if (!lobbyReady) {
      push({ message: "Matchmaking channel is reconnecting. Please try accepting again.", type: "error" });
      return;
    }
    channelRef.current?.send({
      type: "broadcast",
      event: "lobby",
      payload: { type: "random-accept", from: "interviewer", tempId: invite.tempId, sessionId },
    }).catch(() => {
      push({ message: "Failed to confirm match", type: "error" });
      return;
    });
    setIncoming([]); // Clear all requests as we are entering a room
    router.push(\`/interview/\${sessionId}\`);
  };

  `;
  content = content.substring(0, startIdx) + newAccept + content.substring(endIdx);
  fs.writeFileSync('app/dashboard/page.tsx', content);
  console.log('Replaced accept successfully');
} else {
  console.log('Could not find accept block bounds');
}
