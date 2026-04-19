# IntervYou Arch & Agents Reference

This file documents the full depth, dependency map, and state mechanisms of the IntervYou platform. Use this as the definitive guide before modifying any core functionalities.

---

## 1. Realtime Collaboration System (The "Heart")
The Realtime Collaboration engine sits primarily in [hooks/useInterviewState.ts](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts). It synchronizes code, active problem data, selections, and cursors across clients.

### A. How Supabase Channels Work
The app completely relies on `@supabase/supabase-js` Realtime API.
- **Topology:** The clients subscribe to a custom topic name based on the ID: `interview-${sessionId}`.
- **Limits:** Supabase imposes a strict **10 messages per second** limit per channel on the Free tier. If you burst beyond this, the WebSocket connection crashes and Supabase downgrades to "REST API Fallback" which causes massive lag and network errors.
- **The Golden Rule for Modifications:** You CANNOT spam [broadcast(data)](file:///e:/Local/javascript/interv/lib/realtime.ts#12-29). Any high-frequency updates (cursors, code changes, drawing) MUST be debounced to roughly `100ms` (10 per second max).

### B. Two-Tier State Backup (Redis [persist](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#392-407))
While Supabase WebSockets handle *live* updates, they are ephemeral. The [useInterviewState](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#8-585) hook contains a [persist()](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#392-407) method.
- Every single time a user types code or changes the language, [persist(patch)](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#392-407) is called.
- [persist](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#392-407) debounces these changes directly to `/api/interview/state` via POST.
- The [state](file:///e:/Local/javascript/interv/components/VideoCall.tsx#109-122) API saves the JSON blob directly to **Redis** (`session:${sessionId}:state`) with a 24-hour expiration.
- **Why this matters:** If a user closes their laptop, loses WiFi, or refreshes the page, they instantaneously fetch the perfect up-to-second Redis state. *No data is ever lost.* 

### C. Clock Sync Warning
The system initially rejected incoming broadcast events if the sender's local clock (`timestamp`) was behind the receiver's local clock. **This breaks instantly in the real world due to PC clock drift**. This feature has been permanently disabled; all broadcasts are now processed immediately.

---

## 2. WebRTC Video and Audio System ([VideoCall.tsx](file:///e:/Local/javascript/interv/components/VideoCall.tsx))

The video call does NOT use a 3rd party service like Twilio or Agora. It is pure Peer-to-Peer WebRTC.

### A. The Signaling Process
WebRTC peers must exchange IP addresses and session protocols. This requires a signaling server.
- Instead of building a custom WebSocket server, the app cleverly uses the exact same **Supabase Realtime Channel** (`xyz` or `sessionId`) via [lib/realtime.ts](file:///e:/Local/javascript/interv/lib/realtime.ts) to transmit the SDP Offers, SDP Answers, and ICE Candidates.
- **Dependency Danger:** WebRTC signaling fails if the [useInterviewState](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#8-585) hook saturates the Supabase rate limit. If cursor broadcasts are un-debounced, the ICE candidates queue up behind 100 cursor events, causing the Video Call to infinitely say "Connecting...".

### B. Device Management
[VideoCall.tsx](file:///e:/Local/javascript/interv/components/VideoCall.tsx) tracks local devices (camera/mic dropdowns) and implements [safePlay](file:///e:/Local/javascript/interv/components/VideoCall.tsx#7-26) error handling to cleanly execute the HTMLVideoElement `play()` method, avoiding Chrome's `DOMException` error limits.

---

## 3. Code Execution Engine

The platform executes raw code by sending requests to a Judge0 container or compatible sandbox infrastructure.

### A. The Execution Flow
1. **Runner Interaction:** The user presses "Run" in [ControlBar.tsx](file:///e:/Local/javascript/interv/components/interview/ControlBar.tsx).
2. **Harness Construction:** The `useCodeExecution.hook` extracts the user's `code` and the hidden `driver` code. It passes them to `buildHarness()` in [lib/interviewUtils.ts](file:///e:/Local/javascript/interv/lib/interviewUtils.ts).
3. **Execution API:** The harness is POSTed to `/api/execute`.
4. **Broadcast Results:** Once the JSON execution object returns, [broadcastExecutionResult()](file:///e:/Local/javascript/interv/hooks/useInterviewState.ts#371-391) fires it directly across the Supabase channel so the Interviewer sees the exact Red/Green results simultaneously in [TestPanel.tsx](file:///e:/Local/javascript/interv/components/interview/TestPanel.tsx). 

### B. Final Submission Archiving
When the interviewee clicks **"Submit Final"**:
1. The code executes one final time.
2. The results are pushed to `/api/submissions`.
3. The Prisma schema uses an **Upsert** command (using `@unique([sessionId, problemId, userId])`). This forces Prisma to constantly overwrite the user's final attempt record without creating duplicate rows, securely archiving the execution `time`, `memory`, and `code`.

---

## 4. Matchmaking and Dashboard Presence

The Dashboard ([app/dashboard/page.tsx](file:///e:/Local/javascript/interv/app/dashboard/page.tsx)) tracks live users and facilitates "Random Matchmaking".

### A. Presence Overloading Loop
NextAuth's `useSession()` continuously generates new object references when background polling occurs. Initially, the Dashboard's Realtime Presence `useEffect` depended on the `session` object. 
**The Effect:** React tore down and rebuilt the entire presence channel connection in an infinite loop, crashing the websocket and generating the infamous `Realtime send() is automatically falling back to REST API` console error.
**The Fix:** ALWAYS decouple primitive variables (`session?.user?.name`) inside hooks when connecting Realtime sockets. 

### B. The Lobby Web
Random Matchmaking utilizes a unique Supabase topic `random-call-lobby`. One user sends a `type: "random-invite"` block to everyone in the lobby; another clicks "Accept", triggering a `random-accept` block returning the active `sessionId`, redirecting both browsers perfectly.

---
## 5 THe database related
When pushing to the db and any db related work, npx generate and anything ensure scripts/db-push.js file is used

## Summary of Known Dependencies
*   **Postgres (Prisma):** Persistent archiving of sessions, user accounts, and final code submissions.
*   **Redis (ioredis):** Ephemeral 24-hour backup of the live interview state (preventing real-time collapse on browser crashes).
*   **Supabase WebSockets (`@supabase/supabase-js`, `@supabase/realtime-js`):** WebRTC Signaling and Interview State Collaboration.
*   **Monaco Editor (`@monaco-editor/react`):** Only modifies state deliberately.
*   **NextAuth:** Secure authentication. Requires `useSession()` extraction stability.

---

## Main Branch Push History
Use these hashes if we need to inspect or revert the recent architecture/interview-flow changes on `main`.

- `69f9e25` - Merge branch `architecture-hardening`
  Added the versioned Redis-backed live interview state flow, reconnect-safe state loading, Redis-backed matchmaking path, session-channel helpers, private interviewer notes plumbing in the room, and prepared Prisma schema/migration files for durable snapshots/problem packs/final state.

- `5f3fbd7` - Tighten Gemini limits and block ended sessions
  Blocked completed/expired sessions earlier in `/api/interview/role` so ended interview links stop reopening, and aligned AI routes to friendlier rate-limit handling.

- `1d12e7c` - Improve AI resilience and surface interviewer notes
  Raised AI request timeout handling, added duplicate-click protection for Enhance, cleared stale output console on Next Question, and surfaced interviewer-only notes in history/submission dashboard views.

- `6ccad49` - Fix interviewer notes sync and relax AI enhance path
  Moved private interviewer notes onto a dedicated private API path so local typing is not overwritten by shared state sync, and relaxed the AI enhance/test-generation path by preferring faster Flash Lite first with Flash fallback plus constrained output size.

### Revert Guidance
- Revert the most recent change only:
  `git revert 6ccad49`
- Revert the recent chain one by one, newest to oldest:
  `git revert 6ccad49`
  `git revert 1d12e7c`
  `git revert 5f3fbd7`
  `git revert 69f9e25`
- Avoid `reset --hard` on shared branches unless history rewrite is explicitly intended.

## Pending Local Change
This section is intentionally local-only and should not be committed.

- `50e0a95` - Require sign-in before room entry and hard-block ended rooms before the interview workspace mounts.
  This change moves the room page to an auth-first/access-first flow so signed-out users see a sign-in gate, authenticated users are role-checked before the heavy interview hooks mount, and ended/expired rooms render a blocked state instead of briefly opening.

- `7531d84` - Merge branch `codex/editor-whiteboard-screenshare`
  Added the editor-area whiteboard workspace, maximize/focus video views, separate screen-share signaling, and Excalidraw whiteboard plumbing.

- `6f4fa11` - Fix Excalidraw stylesheet import
  Moved the Excalidraw stylesheet import from CSS `@import` to the app layout to fix Vercel production builds.

- `86a501f` - Stabilize room entry and scheduled join flow
  Tightened role/bootstrap access and fixed scheduled invitee admission so scheduled links still work.

- `991885d` - Wait for signaling channels before starting calls
  Prevented camera/screen-share call startup before Supabase signaling channels are actually subscribed.

- `e502563` - Sync whiteboard mode and auto-start room call
  Made editor/whiteboard a shared workspace mode, hard-switched both users together, made the interviewee the whiteboard editor, and moved the main call toward auto-start.

- `247e967` - Stabilize random match lobby channel
  Stopped the random-match lobby from resubscribing on every `tempId` change and gated sends on a ready realtime channel.

- `b88b806` - Separate dashboard presence from matchmaking
  Split dashboard presence into its own stable effect with a user-based presence key so online users and matchmaking no longer fight each other.

- `3a3c93e` - Allow either participant to receive screen share
  Removed role-hardcoded screen-share negotiation so either interviewer or interviewee can start sharing.

- `3dbf9e0` - Attach remote screen stream after viewer mounts
  Fixed the black remote screen issue by persisting the incoming screen-share stream and attaching it when the viewer video element actually mounts.

## Current Branch Work
Branch: `codex/editor-whiteboard-screenshare`

- Uncommitted branch changes add dedicated UX for maximizing participant video and shared-screen views inside the interview room without changing the underlying code-sync path.
- Screen share remains on its own signaling channel, and the room now has a whiteboard workspace toggle above the editor backed by a separate Supabase whiteboard channel plus Excalidraw.
- Excalidraw was installed locally on this branch only and is wired through `components/interview/WhiteboardPanel.tsx`, with debounced scene sync so whiteboard traffic stays isolated from editor/video traffic.
