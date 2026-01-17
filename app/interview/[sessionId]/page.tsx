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

const MonacoEditor: any = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function InterviewPage() {
  const { sessionId } = useParams() as { sessionId: string };

  const {
    language,
    code,
    problemText,
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
    toggleFreeze
  } = useInterviewState(sessionId);

  const {
    runOutput,
    caseResults,
    submitting,
    metrics,
    onRun,
    onSubmitFinal,
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
    problemText,
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

  // Render remote cursors
  useEffect(() => {
    const editor = (window as any)[`__editor_${sessionId}`];
    const monaco = (window as any)[`__monaco_${sessionId}`];

    if (editor && monaco && remoteCursors) {
      const decorations: any[] = [];

      Object.entries(remoteCursors).forEach(([clientId, cursor]: [string, any]) => {
        // Skip own cursor (already handled by echo cancellation, but double check)
        // if (clientId === myClientId) return; 

        if (cursor?.lineNumber && cursor?.column) {
          decorations.push({
            range: new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
            options: {
              className: 'remote-cursor',
              hoverMessage: { value: `User ${clientId.substring(0, 4)}` },
              beforeContentClassName: 'remote-cursor-carets' // We can add CSS for this
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
    <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-100 overflow-hidden">

      { }
      {/* Left Pane */}
      <div className="w-full md:w-[40%] flex flex-col bg-white border-r h-full overflow-hidden">
        {/* Video Section - Fixed at top */}
        <div className="bg-gray-900 p-2 shrink-0 flex justify-center border-b border-gray-700">
          <div className="w-full max-w-[400px]">
            <VideoCall room={`interview-${sessionId}`} role={role} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4">
          <TestPanel
            sampleTests={sampleTests}
            setSampleTests={updateSampleTests}
            privateTests={privateTests}
            setPrivateTests={setPrivateTests}
            problemText={problemText}
            setProblemText={updateProblemText}
            role={role}
            language={language}
            code={code}
            driver={driver}
            sessionId={sessionId}
            setDriver={updateDriver}
            setCodeMapFull={setCodeMapFull}
            setDriverMapFull={setDriverMapFull}
          />
        </div>
      </div>

      { }
      <div className="w-full md:w-[60%] flex flex-col h-full relative bg-gray-50">
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}

        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}

        { }
        <div className="p-2 border-b bg-white shrink-0">
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
          />
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative">
          {/* Frozen State Overlay */}
          {isFrozen && role === 'interviewee' && (
            <div className="absolute inset-0 z-50 bg-gray-50/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl border border-blue-100 text-center max-w-md">
                <div className="mb-4 flex justify-center">
                  <div className="p-3 bg-blue-50 rounded-full">
                    <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Paused</h3>
                <p className="text-gray-500">
                  The interviewer has paused editing to explain a concept. Please listen to the instructions.
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
              // Listen for cursor changes
              editor.onDidChangeCursorPosition((e: any) => {
                broadcastCursor({ lineNumber: e.position.lineNumber, column: e.position.column });
              });

              // Store editor instance map if needed, or just use effect
              // But since we can't easily pass editor out, we'll define the cursor effect here? 
              // Actually, better to use a ref for the editor in the component
              // But for now, let's attach the decoration logic directly or use a mutable ref
              (window as any)[`__editor_${sessionId}`] = editor;
              (window as any)[`__monaco_${sessionId}`] = monaco;
            }}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              readOnly: isFrozen && role === 'interviewee', // Soft lock for interviewee
            }}
          />
        </div>

        {/* Output Panel */}
        <div className="shrink-0 z-10">
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
    </div>
  );
}