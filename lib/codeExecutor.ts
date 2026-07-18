import { submitToJudge0 } from "./judge0";

export async function executeCode(body: any) {
  const { language_id, source_code, stdin } = body;

  let pistonLang = "";
  if (language_id === 63) pistonLang = "javascript";
  else if (language_id === 62) pistonLang = "java";
  else if (language_id === 54) pistonLang = "cpp";

  const enablePiston = process.env.ENABLE_PISTON === "true";
  const pistonUrl = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";

  if (enablePiston && pistonLang) {
    try {
      console.log(`[CodeExecutor] Routing execution to Piston (${pistonLang})...`);
      const response = await fetch(`${pistonUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: pistonLang,
          version: "*",
          files: [
            {
              content: source_code
            }
          ],
          stdin: stdin || "",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          stdout: data.run?.stdout || "",
          stderr: data.run?.stderr || "",
          compile_output: data.compile?.stderr || data.compile?.stdout || null,
          time: null,
          memory: null,
        };
      } else {
        console.warn(`[CodeExecutor] Piston execution failed with status: ${response.status}. Falling back to Judge0.`);
      }
    } catch (e: any) {
      console.warn(`[CodeExecutor] Piston failed: ${e.message}. Falling back to Judge0.`);
    }
  }

  console.log(`[CodeExecutor] Routing execution to Judge0...`);
  return submitToJudge0(body);
}
