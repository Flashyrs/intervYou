import { submitToJudge0 } from "./judge0";

export async function executeCode(body: any) {
  const { language_id, source_code, stdin } = body;

  let pistonLang = "";
  if (language_id === 63) pistonLang = "javascript";
  else if (language_id === 62) pistonLang = "java";
  else if (language_id === 54) pistonLang = "cpp";
  else if (language_id === 71) pistonLang = "python";
  else if (language_id === 60) pistonLang = "go";
  else if (language_id === 50) pistonLang = "c";

  const enablePiston = process.env.ENABLE_PISTON === "true";
  const pistonUrl = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";

  if (enablePiston && pistonLang) {
    try {
      console.log(`[CodeExecutor] Routing execution to Piston (${pistonLang})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Handle compilation errors or invalid payloads as failure to route to Judge0
        if (!data || data.error || !data.run) {
          throw new Error("Invalid response payload from Piston endpoint");
        }
        
        if (data.compile && data.compile.code !== 0 && data.compile.stderr) {
          throw new Error(`Piston compiler error: ${data.compile.stderr}`);
        }

        return {
          stdout: data.run?.stdout || "",
          stderr: data.run?.stderr || "",
          compile_output: data.compile?.stderr || data.compile?.stdout || null,
          time: null,
          memory: null,
        };
      } else {
        throw new Error(`Piston execution failed with status ${response.status}`);
      }
    } catch (e: any) {
      console.warn(`[CodeExecutor] Piston execution failed: ${e.message || e}. Falling back to Judge0.`);
    }
  }

  console.log(`[CodeExecutor] Routing execution to Judge0...`);
  return submitToJudge0(body);
}
