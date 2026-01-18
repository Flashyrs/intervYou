"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { presenceChannel } from "@/lib/presence";
import { useToast } from "@/components/Toast";
import { ScheduleModal } from "@/components/interview/ScheduleModal";
import { Clock, HardDrive, Code2, Calendar, CheckCircle, XCircle, Eye, Play, Plus } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const [incoming, setIncoming] = useState<{ from: string; tempId: string; initiatorId?: string; name?: string } | null>(null);
  const [status, setStatus] = useState<string>("");
  const [tempId, setTempId] = useState<string | null>(null);
  const channelRef = useRef<any | null>(null);
  const presenceRef = useRef<any | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"interviews" | "submissions" | "upcoming" | "history">("interviews");
  const [history, setHistory] = useState<{ upcoming: any[]; past: any[] }>({ upcoming: [], past: [] });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmissionCode, setSelectedSubmissionCode] = useState<string | null>(null);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  // State for expanded history sorting
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionSubmissions, setSessionSubmissions] = useState<any[]>([]);
  const [loadingSessionSubmissions, setLoadingSessionSubmissions] = useState(false);

  const router = useRouter();
  const { push } = useToast();

  const userId = (session?.user as any)?.id as string | undefined;

  useEffect(() => {
    if (session?.user) {
      setLoadingHistory(true);
      fetch("/api/history")
        .then(res => res.json())
        .then(data => {
          if (data.upcoming || data.past) setHistory(data);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingHistory(false));
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === 'submissions') {
      setLoadingSubmissions(true);
      const endpoint = viewingSessionId
        ? `/api/submissions?sessionId=${viewingSessionId}`
        : `/api/submissions`;

      fetch(endpoint)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSubmissions(data);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingSubmissions(false));
    }
  }, [activeTab, viewingSessionId]);

  useEffect(() => {
    if (!supabase) return;

    const ch = supabase.channel("random-call-lobby");
    channelRef.current = ch;

    ch.on("broadcast", { event: "lobby" }, (payload: any) => {
      const msg = payload?.payload;
      if (msg?.type === "random-invite") {
        if (msg.initiatorId && userId && msg.initiatorId === userId) return;
        setIncoming({ from: msg.from, tempId: msg.tempId, initiatorId: msg.initiatorId, name: msg.name });
      } else if (msg?.type === "random-accept") {
        if (tempId && msg.tempId === tempId && msg.sessionId) {
          push({ message: "Matched! Redirecting…", type: "success" });
          router.push(`/interview/${msg.sessionId}`);
        }
      }
    });

    ch.subscribe();

    const pres = presenceChannel("presence-lobby");
    presenceRef.current = pres;

    pres?.on("presence", { event: "sync" }, () => {
      const state = pres?.presenceState();
      const users = Object.values(state || {})
        .flatMap((arr: any) => arr.map((i: any) => i.name || i.email)) // prioritize name, then email
        .filter((u: any) => u && u !== "undefined" && u !== "null"); // filter garbage
      setOnline(Array.from(new Set(users)) as string[]);
    });

    pres?.subscribe((status: any) => {
      if (status === "SUBSCRIBED" && userId) {
        // Only track if we have a valid user
        pres.track({ userId, name: session?.user?.name, email: session?.user?.email });
      }
    });

    return () => {
      if (channelRef.current && supabase) supabase.removeChannel(channelRef.current);
      if (presenceRef.current && supabase) supabase.removeChannel(presenceRef.current);
    };
  }, [tempId, router, userId, push, session]);

  const startRandom = async () => {
    if (!session) { signIn(); return; }
    if (!supabase) { push({ message: "Realtime not configured", type: "error" }); return; }

    if (!userId) {
      push({ message: "User ID missing. Please sign out and sign in again.", type: "error" });
      return;
    }

    setStatus("Looking for interviewer...");
    const id = Math.random().toString(36).slice(2, 10);
    setTempId(id);

    const payload = {
      type: "random-invite",
      from: "interviewee",
      tempId: id,
      initiatorId: userId,
      name: session.user?.name || "Unknown User"
    };

    channelRef.current?.send({
      type: "broadcast",
      event: "lobby",
      payload,
    });
  };

  const accept = async () => {
    if (!supabase || !incoming) return;
    if (!session) { signIn(); return; }

    const res = await fetch("/api/random/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempId: incoming.tempId, initiatorId: incoming.initiatorId || "" }),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ message: data?.error || "Accept failed", type: "error" });
      return;
    }

    const sessionId = data.sessionId;
    channelRef.current?.send({
      type: "broadcast",
      event: "lobby",
      payload: { type: "random-accept", from: "interviewer", tempId: incoming.tempId, sessionId },
    });
    setIncoming(null);
    router.push(`/interview/${sessionId}`);
  };

  const handleViewRecords = (sessionId: string) => {
    setSubmissions([]); // Clear previous
    setViewingSessionId(sessionId);
    setActiveTab('submissions');
  };

  if (authStatus === "loading") return <div className="mx-auto max-w-3xl p-6 text-center text-gray-600">Loading…</div>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 mt-10 border rounded bg-white">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-2 text-gray-600">Sign in to start a random interview</p>
        <button
          className="mt-6 w-full px-4 py-2 bg-black text-white rounded"
          onClick={() => signIn("google")}
        >
          Sign in with Google
        </button>
      </div>
    );
  }


  // Function to toggle expansion
  const toggleSessionExpansion = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setSessionSubmissions([]);
      return;
    }

    setExpandedSessionId(sessionId);
    setLoadingSessionSubmissions(true);
    try {
      const res = await fetch(`/api/submissions?sessionId=${sessionId}`);
      const data = await res.json();
      if (Array.isArray(data)) setSessionSubmissions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessionSubmissions(false);
    }
  };

  const renderSessionCard = (s: any, type: "upcoming" | "history") => {
    const isUpcoming = type === "upcoming";
    const invitee = s.inviteeName || s.inviteeEmail || "Guest";
    const date = s.scheduledFor ? new Date(s.scheduledFor) : new Date(s.createdAt);

    const canJoin = isUpcoming ? (
      // Can join if instant (scheduledFor null) OR now >= scheduled - 5 min
      !s.scheduledFor || new Date().getTime() >= new Date(s.scheduledFor).getTime() - 5 * 60 * 1000
    ) : false;

    const isExpanded = expandedSessionId === s.id;

    return (
      <div key={s.id} className="border rounded-lg bg-white shadow-sm flex flex-col transition-all duration-200">
        <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-medium text-lg">{s.isScheduled ? "Scheduled Interview" : "Instant Interview"}</h3>
            <p className="text-sm text-gray-500">With: <span className="text-black font-medium">{invitee}</span></p>
            <p className="text-xs text-gray-400 mt-1">
              {date.toLocaleString()}
            </p>
            {s.status === 'completed' && <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Completed</span>}
          </div>

          <div className="flex gap-2">
            {isUpcoming && (
              <button
                onClick={() => router.push(`/interview/${s.id}`)}
                disabled={!canJoin}
                className={`px-4 py-2 rounded text-sm font-medium transition ${canJoin ? "bg-black text-white hover:bg-gray-800" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {canJoin ? "Join Now" : "Wait to Join"}
              </button>
            )}
            {!isUpcoming && (
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm cursor-not-allowed"
                >
                  Ended
                </button>
                <button
                  onClick={() => toggleSessionExpansion(s.id)}
                  className={`px-4 py-2 border text-sm font-medium rounded transition flex items-center gap-2 ${isExpanded ? "bg-gray-100 border-gray-300 text-gray-900" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {isExpanded ? "Hide Records" : "View Records"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* INLINE SUBMISSIONS EXPANSION */}
        {isExpanded && (
          <div className="border-t bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">Session Records</h4>
            {loadingSessionSubmissions ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading records...</div>
            ) : sessionSubmissions.length > 0 ? (
              <div className="space-y-3">
                {sessionSubmissions.map(sub => renderSubmissionCard(sub))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm italic">No submissions found for this session.</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSubmissionCard = (sub: any) => {
    const results = Array.isArray(sub.results) ? sub.results : JSON.parse(sub.results || "[]");
    const totalTests = results.length;
    const passedTests = results.filter((r: any) => r.pass).length;

    // Parse title: First sentence or up to first newline
    const rawTitle = sub.problemText || "Submission"; // Fallback
    const firstSentence = rawTitle.split(/[.\n]/)[0]; // Split by dot or newline
    const displayTitle = firstSentence.length > 80 ? firstSentence.substring(0, 80) + "..." : firstSentence;

    // Identify User
    const submitterName = sub.user?.name || sub.user?.email || "Unknown User";
    const isMe = sub.userId === userId;

    // Identify Session Context
    const sessionDate = sub.session?.createdAt ? new Date(sub.session.createdAt).toLocaleDateString() : "";
    const participants = sub.session?.participants?.map((p: any) => p.name || p.email).join(", ") || "";

    return (
      <div key={sub.id} className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition overflow-hidden mb-4 ${sub.passed ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {sub.passed ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <h4 className="font-semibold text-lg text-gray-900">{displayTitle}</h4>
              </div>

              <div className="text-xs text-gray-500 mb-2">
                <span className="font-medium text-gray-700">{isMe ? "You" : submitterName}</span>
                {sessionDate && <span> • Session on {sessionDate} with {participants}</span>}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(sub.createdAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" />
                  <span className="uppercase">{sub.language}</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-medium ${sub.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {passedTests}/{totalTests} tests passed
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedSubmissionCode(selectedSubmissionCode === sub.id ? null : sub.id)}
              className="flex items-center gap-2 px-3 py-1.5 border hover:bg-gray-50 rounded-md text-sm font-medium transition"
            >
              <Eye className="w-4 h-4" />
              {selectedSubmissionCode === sub.id ? "Hide Code" : "Show Code"}
            </button>
          </div>

          {(sub.time !== null || sub.memory !== null) && (
            <div className="flex gap-3 mb-4">
              {sub.time !== null && (
                <div className="flex items-center gap-1.5 text-xs bg-gray-50 px-2 py-1 rounded border">
                  <Clock className="w-3 h-3 text-gray-500" />
                  <span className="font-medium text-gray-700">{Number(sub.time).toFixed(2)} ms</span>
                </div>
              )}
              {sub.memory !== null && (
                <div className="flex items-center gap-1.5 text-xs bg-gray-50 px-2 py-1 rounded border">
                  <HardDrive className="w-3 h-3 text-gray-500" />
                  <span className="font-medium text-gray-700">{(Number(sub.memory) / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </div>
          )}

          {selectedSubmissionCode === sub.id && (
            <div className="mt-4 border-t pt-4">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Submitted Code</div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
                <code>{sub.code}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl p-2 md:p-4 space-y-3 md:space-y-6">
      {incoming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Random Interview Request</h2>
            <p className="text-gray-700 mb-6">
              <span className="font-medium">{incoming.name || "A user"}</span> is looking for an interviewer.
              Would you like to accept this random interview?
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
                onClick={accept}
              >
                Accept
              </button>
              <button
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition"
                onClick={() => setIncoming(null)}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="flex border-b overflow-x-auto">
          <button
            className={`flex-1 min-w-[100px] py-3 text-sm font-medium ${activeTab === 'interviews' ? 'bg-gray-50 text-black border-b-2 border-black' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('interviews')}
          >
            Interviews
          </button>
          <button
            className={`flex-1 min-w-[100px] py-3 text-sm font-medium ${activeTab === 'submissions' ? 'bg-gray-50 text-black border-b-2 border-black' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setViewingSessionId(null); setActiveTab('submissions'); }}
          >
            Submissions
          </button>
          <button
            className={`flex-1 min-w-[100px] py-3 text-sm font-medium ${activeTab === 'upcoming' ? 'bg-gray-50 text-black border-b-2 border-black' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
          </button>
          <button
            className={`flex-1 min-w-[100px] py-3 text-sm font-medium ${activeTab === 'history' ? 'bg-gray-50 text-black border-b-2 border-black' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* INTERVIEWS TAB: Actions + Online Users */}
          {activeTab === 'interviews' && (
            <div className="space-y-6">
              <div className="flex gap-4 p-4 bg-gray-50 rounded-lg items-center">
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-md shadow-sm hover:bg-gray-800 transition"
                  onClick={startRandom}
                >
                  <Play className="w-4 h-4" />
                  Random Match
                </button>

                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition"
                  onClick={() => setShowScheduleModal(true)}
                >
                  <Plus className="w-4 h-4" />
                  Schedule Interview
                </button>
              </div>

              <div className="border rounded-xl p-4 bg-white shadow-sm">
                <h3 className="font-semibold mb-3">Online Interviewers ({online.length})</h3>
                {online.length > 0 ? (
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {online.map((o, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {o}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No one else is online.</p>
                )}
              </div>
            </div>
          )}

          {/* SUBMISSIONS TAB */}
          {activeTab === 'submissions' && (
            loadingSubmissions ? <div className="text-center py-8 text-gray-500">Loading submissions...</div> :
              submissions.length > 0 ? submissions.map(sub => renderSubmissionCard(sub)) :
                <div className="text-center py-8 text-gray-500">No submissions found. Start an interview to submit code.</div>
          )}

          {/* UPCOMING TAB */}
          {activeTab === 'upcoming' && (
            loadingHistory ? <div className="text-center py-8 text-gray-500">Loading...</div> :
              history.upcoming.length > 0 ? history.upcoming.map(s => renderSessionCard(s, 'upcoming')) :
                <div className="text-center py-8 text-gray-500">No upcoming interviews scheduled.</div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            loadingHistory ? <div className="text-center py-8 text-gray-500">Loading...</div> :
              history.past.length > 0 ? history.past.map(s => renderSessionCard(s, 'history')) :
                <div className="text-center py-8 text-gray-500">No interview history.</div>
          )}
        </div>
      </div>

      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={(sessionId, link) => {
            setShowScheduleModal(false);
            fetch("/api/history")
              .then(res => res.json())
              .then(data => {
                if (data.upcoming || data.past) setHistory(data);
              });
          }}
        />
      )}
    </div>
  );
}
