"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
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
          />
        </div>

        { }
        <div className="flex-1 relative min-h-0">
          <MonacoEditor
            key={`${language}-${sessionId}`}
            height="100%"
            defaultLanguage="javascript"
            language={language}
            value={code}
            onChange={(v: string | undefined) => updateCode(v || "")}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              readOnly: false
            }}
          />
        </div>

        { }
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