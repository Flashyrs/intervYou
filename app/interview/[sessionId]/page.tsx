"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CheckCircle2 } from "lucide-react";
import VideoCall from "@/components/VideoCall";
import { useInterviewState } from "@/hooks/useInterviewState";
import { useCodeExecution } from "@/hooks/useCodeExecution";
import { ControlBar } from "@/components/interview/ControlBar";
import { OutputPanel } from "@/components/interview/OutputPanel";
import { TestPanel } from "@/components/interview/TestPanel";
import { AuthModal } from "@/components/interview/AuthModal";
import { getWebRtcChannel } from "@/lib/sessionChannels";

const MonacoEditor: any = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function InterviewPage() {
  const { sessionId } = useParams() as { sessionId: string };

    const {
    language,
    code,
    problemId,
    problemText,
    problemTitle,
    sampleTests,
    privateTests,
    driver,
    role,
    showAuthModal,
    setShowAuthModal,
    setPrivateTests,
    updateLanguage,
    updateCode,
    updateProblemText,
    updateProblemTitle,
    updateSampleTests,
    setCodeMapFull,
    setDriverMapFull,
    updateDriver,
    executionResult,
    broadcastExecutionResult,
    remoteCursors,
    broadcastCursor,
    lastEditor,
    isFrozen,
    toggleFreeze,
    timerState,
    updateTimerState,
    interviewerNotes,
    persistInterviewerNotes,
    endSession,
    resetSessionForNextQuestion
  } = useInterviewState(sessionId);

  const {
    runOutput,
    caseResults,
    submitting,
    metrics,
    onRun,
    onSubmitFinal,
    resetExecutionState,
    setRunOutput,
    setCaseResults,
    setMetrics,
  } = useCodeExecution({
    sessionId,
    language,
    code,
    driver,
    sampleTests,
    privateTests,
    problemId,
    problemText,
    problemTitle,
  });

  // Sync execution results from other participants
  useEffect(() => {
    if (executionResult) {
      if (executionResult.runOutput !== undefined) setRunOutput(executionResult.runOutput);
      if (executionResult.caseResults !== undefined) setCaseResults(executionResult.caseResults);
      if (executionResult.metrics !== undefined) setMetrics(executionResult.metrics);
    }
  }, [executionResult, setRunOutput, setCaseResults, setMetrics]);

  const handleRun = async () => {
    const result = await onRun();
    if (result) {
      broadcastExecutionResult(result);
    }
  };

  const handleNextQuestion = () => {
    resetExecutionState();
    resetSessionForNextQuestion();
  };

  // Render remote cursors
  useEffect(() => {
    const editor = (window as any)[`__editor_${sessionId}`];
    const monaco = (window as any)[`__monaco_${sessionId}`];

    if (editor && monaco && remoteCursors) {
      const decorations: any[] = [];

      Object.entries(remoteCursors).forEach(([clientId, cursor]: [string, any]) => {
        if (cursor?.lineNumber && cursor?.column) {
          decorations.push({
            range: new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
            options: {
              className: 'remote-cursor',
              hoverMessage: { value: `User ${clientId.substring(0, 4)}` },
              beforeContentClassName: 'remote-cursor-carets'
            }
          });
        }
      });

      // Maintain decorations
      const oldDecorations = (editor as any).__oldDecorations || [];
      (editor as any).__oldDecorations = editor.deltaDecorations(oldDecorations, decorations);
    }
  }, [remoteCursors, sessionId]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f3f4f6] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* Top Navigation / Global Header */}
      <header className="shrink-0 h-[60px] bg-white border-b border-gray-200 px-4 flex items-center justify-between shadow-sm relative z-20">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-gray-900 leading-tight">IntervYou</h1>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{role}</p>
          </div>
        </div>

        <div className="flex-1 flex justify-end">
          <ControlBar
            language={language}
            setLanguage={updateLanguage}
            onRun={handleRun}
            onSubmitFinal={onSubmitFinal}
            submitting={submitting}
            role={role}
            lastEditor={lastEditor}
            isFrozen={isFrozen}
            onToggleFreeze={toggleFreeze}
            timerState={timerState}
            updateTimerState={updateTimerState}
            sessionId={sessionId}
            endSession={endSession}
            onNextQuestion={handleNextQuestion}
          />
        </div>
      </header>

      {/* Main 3-Pane Workspace */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-2.5 gap-2.5">
        
        {/* Left Pane: Problem Definition & Tests (25%) */}
        <aside className="w-full md:w-[25%] flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Problem Details
            </h2>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-1">
            <TestPanel
              sampleTests={sampleTests}
              setSampleTests={updateSampleTests}
              privateTests={privateTests}
              setPrivateTests={setPrivateTests}
              problemText={problemText}
              problemTitle={problemTitle}
              setProblemText={updateProblemText}
              setProblemTitle={updateProblemTitle}
              role={role}
              language={language}
              code={code}
              driver={driver}
              sessionId={sessionId}
              setDriver={updateDriver}
              setCodeMapFull={setCodeMapFull}
              setDriverMapFull={setDriverMapFull}
              interviewerNotes={interviewerNotes}
              setInterviewerNotes={persistInterviewerNotes}
            />
          </div>
        </aside>

        {/* Center Pane: Solution Editor (50%) */}
        <section className="w-full md:w-[50%] flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative group">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Code Editor
            </h2>
            <div className="flex gap-1.5">
               <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
               <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
               <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
            </div>
          </div>
          <div className="flex-1 relative">
            {/* Frozen State Overlay */}
            {isFrozen && role === 'interviewee' && (
              <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-100 text-center max-w-sm transform transition-all duration-300">
                  <div className="mb-5 flex justify-center">
                    <div className="p-4 bg-indigo-50 rounded-full animate-bounce">
                      <CheckCircle2 className="w-10 h-10 text-indigo-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Session Paused</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    The interviewer is explaining a concept. Please wait for them to resume the session before typing.
                  </p>
                </div>
              </div>
            )}

            <MonacoEditor
              key={`${language}-${sessionId}`}
              height="100%"
              defaultLanguage="javascript"
              language={language}
              value={code}
              onChange={(v: string | undefined) => updateCode(v || "")}
              onMount={(editor: any, monaco: any) => {
                editor.onDidChangeCursorPosition((e: any) => {
                  broadcastCursor({ lineNumber: e.position.lineNumber, column: e.position.column });
                });
                (window as any)[`__editor_${sessionId}`] = editor;
                (window as any)[`__monaco_${sessionId}`] = monaco;
              }}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: isFrozen && role === 'interviewee',
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                lineHeight: 1.6,
                padding: { top: 16, bottom: 16 },
                roundedSelection: true,
                cursorBlinking: "smooth",
              }}
            />
          </div>
        </section>

        {/* Right Pane: Video Call & Output Console (25%) */}
        <aside className="w-full md:w-[25%] flex flex-col gap-2.5 h-full">
          {/* Video Container */}
          <div className="h-[280px] shrink-0 bg-gray-900 rounded-xl shadow-sm border border-gray-800 overflow-hidden relative group">
             <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-start pt-3 px-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <h2 className="text-[11px] font-bold text-white/90 uppercase tracking-wider flex items-center gap-2 drop-shadow-md">
                 <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                 Live Video
               </h2>
            </div>
            <div className="w-full h-full flex items-center justify-center">
               {/* Use a dedicated webrtc channel to prevent collisions with the code editor channel */}
               <VideoCall room={getWebRtcChannel(sessionId)} role={role} />
            </div>
          </div>

          {/* Execution Output Panel */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Console Output
              </h2>
            </div>
            <div className="flex-1 relative z-10 overflow-hidden">
               <OutputPanel
                runOutput={runOutput}
                caseResults={caseResults}
                sampleTests={sampleTests}
                privateTests={privateTests}
                role={role}
                metrics={metrics}
              />
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}
