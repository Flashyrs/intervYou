"use client";

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
  } = useInterviewState(sessionId);

  const {
    runOutput,
    caseResults,
    submitting,
    onRun,
    onSubmitFinal,
  } = useCodeExecution({
    sessionId,
    language,
    code,
    driver,
    sampleTests,
    privateTests,
  });

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-gray-100 overflow-hidden">

      {}
      <div className="w-full md:w-[40%] flex flex-col bg-white border-r overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4">
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

      {}
      <div className="w-full md:w-[60%] flex flex-col h-full relative bg-gray-50">
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}

        {}
        <div className="h-32 md:h-64 bg-gray-900 p-1 md:p-2 shrink-0">
          <VideoCall room={`interview-${sessionId}`} role={role} />
        </div>

        {}
        <div className="p-2 border-b bg-white shrink-0">
          <ControlBar
            language={language}
            setLanguage={updateLanguage}
            onRun={onRun}
            onSubmitFinal={onSubmitFinal}
            submitting={submitting}
            role={role}
          />
        </div>

        {}
        <div className="flex-1 relative min-h-0">
          <MonacoEditor
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

        {}
        <div className="h-32 md:h-48 border-t bg-gray-50 overflow-y-auto p-1 md:p-2 shrink-0">
          <OutputPanel
            runOutput={runOutput}
            caseResults={caseResults}
            sampleTests={sampleTests}
            role={role}
          />
        </div>
      </div>
    </div>
  );
}