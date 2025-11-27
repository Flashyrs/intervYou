"use client";
import { useEffect, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { ProblemPanel } from "@/components/ProblemPanel";

export default function InterviewClient({ sessionId }: { sessionId: string }) {
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  async function runCode() {
    try {
      setIsRunning(true);
      setOutput("Running tests...");

      // 1. Get user's code
      const source_code = (document.querySelector("textarea[name=__monaco_value]") as HTMLTextAreaElement)?.value || "";

      if (!source_code.trim()) {
        setOutput("❌ Error: No code to run");
        return;
      }

      // 2. Fetch interview state (contains tests, driver, problem)
      const stateRes = await fetch(`/api/interview/state?sessionId=${sessionId}`);
      if (!stateRes.ok) {
        setOutput("❌ Error: Failed to load interview state");
        return;
      }

      const state = await stateRes.json();
      const sampleTests = state.sampleTests || "[]";
      const driver = state.driver || "";

      // Parse tests
      let tests = [];
      try {
        tests = JSON.parse(sampleTests);
      } catch (e) {
        console.error("Failed to parse tests:", e);
      }

      // If no tests, generate some
      if (!tests || tests.length === 0) {
        setOutput("⚠️ No test cases found. Please use 'Enhance with AI' to generate tests first.");
        return;
      }

      // 3. Build test harness (this wraps user code + driver + tests)
      const harnessRes = await fetch("/api/execute/harness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          userCode: source_code,
          driver,
          tests,
        }),
      });

      if (!harnessRes.ok) {
        setOutput("❌ Error: Failed to build test harness");
        return;
      }

      const { harnessCode } = await harnessRes.json();

      // 4. Execute the harness
      const execRes = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          source_code: harnessCode,
          sessionId,
        }),
      });

      const execData = await execRes.json();

      // 5. Parse results and display
      if (execData.error) {
        setOutput(`❌ Error: ${execData.error}`);
        return;
      }

      // Check for compilation errors
      if (execData.compile_output) {
        setOutput(`❌ Compilation Error:\n${execData.compile_output}`);
        return;
      }

      // Check for runtime errors
      if (execData.stderr) {
        setOutput(`❌ Runtime Error:\n${execData.stderr}`);
        return;
      }

      // Parse test results from stdout
      const stdout = execData.stdout || "";
      let results = [];

      try {
        results = JSON.parse(stdout);
      } catch (e) {
        // Try to extract JSON from output
        const jsonMatch = stdout.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            results = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            setOutput(`❌ Failed to parse test results:\n${stdout}`);
            return;
          }
        } else {
          setOutput(`❌ Unexpected output format:\n${stdout}`);
          return;
        }
      }

      // Calculate pass/fail
      const passed = results.filter((r: any) => r.pass === true).length;
      const total = results.length;
      const failed = total - passed;

      // Format output
      let formattedOutput = `\n`;
      formattedOutput += `════════════════════════════════════════\n`;
      formattedOutput += `📊 TEST RESULTS\n`;
      formattedOutput += `════════════════════════════════════════\n\n`;

      if (passed === total) {
        formattedOutput += `✅ ALL TESTS PASSED! (${passed}/${total})\n\n`;
      } else {
        formattedOutput += `❌ TESTS FAILED: ${failed}/${total} failed\n`;
        formattedOutput += `✅ TESTS PASSED: ${passed}/${total}\n\n`;
      }

      // Show individual test results
      formattedOutput += `────────────────────────────────────────\n`;
      formattedOutput += `INDIVIDUAL TEST RESULTS:\n`;
      formattedOutput += `────────────────────────────────────────\n\n`;

      results.forEach((result: any, idx: number) => {
        const testNum = idx + 1;
        if (result.error) {
          formattedOutput += `Test ${testNum}: ❌ ERROR\n`;
          formattedOutput += `  Error: ${result.error}\n\n`;
        } else if (result.pass) {
          formattedOutput += `Test ${testNum}: ✅ PASS\n`;
          if (result.got !== undefined) {
            formattedOutput += `  Output: ${JSON.stringify(result.got)}\n\n`;
          }
        } else {
          formattedOutput += `Test ${testNum}: ❌ FAIL\n`;
          formattedOutput += `  Expected: ${JSON.stringify(result.exp)}\n`;
          formattedOutput += `  Got:      ${JSON.stringify(result.got)}\n\n`;
        }
      });

      setOutput(formattedOutput);

    } catch (error: any) {
      setOutput(`❌ Unexpected Error:\n${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <ProblemPanel />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>javascript</option>
            <option>java</option>
            <option>cpp</option>
          </select>
          <button
            onClick={runCode}
            disabled={isRunning}
            className={`px-3 py-2 rounded text-white ${isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}
          >
            {isRunning ? "Running..." : "Run Tests"}
          </button>
        </div>
        <CodeEditor />
        <pre className="bg-gray-50 border rounded p-3 overflow-auto max-h-96 text-sm font-mono whitespace-pre-wrap">{output}</pre>
      </div>
    </div>
  );
}
