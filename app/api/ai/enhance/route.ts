import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { problemText } = await req.json();

        if (!problemText || problemText.trim().length < 10) {
            return NextResponse.json({ error: "Problem text is too short" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
        }

        const prompt = `Analyze this coding problem and return JSON.

Problem: ${problemText}

Return ONLY this JSON (no markdown):
{
  "enhancedProblem": "formatted markdown problem description",
  "testCases": [
    {"input": [arg1], "output": result, "category": "sample"},
    {"input": [arg2], "output": result2, "category": "sample"},
    {"input": [arg3], "output": result3, "category": "sample"},
    {"input": [arg4], "output": result4, "category": "sample"},
    {"input": [edge1], "output": result5, "category": "edge"},
    {"input": [edge2], "output": result6, "category": "edge"},
    {"input": [edge3], "output": result7, "category": "edge"},
    {"input": [edge4], "output": result8, "category": "edge"},
    {"input": [edge5], "output": result9, "category": "edge"}
  ],
  "functionInfo": {
    "javascript": {"name": "functionName", "params": ["param1", "param2"]},
    "java": {"name": "functionName", "returnType": "int", "params": ["int[] nums"]},
    "cpp": {"name": "functionName", "returnType": "int", "params": ["vector<int>& nums"]}
  }
}

Generate 9 test cases: 4 sample + 5 edge cases.`;

        const models = ["gemini-2.0-flash-exp", "gemini-2.0-flash", "gemini-1.5-flash"];
        let response;
        let lastError;

        for (const model of models) {
            try {
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.3 }
                        })
                    }
                );

                if (response.ok) break;
                lastError = await response.text();
            } catch (e: any) {
                lastError = e.message;
            }
        }

        if (!response || !response.ok) {
            return NextResponse.json({ error: "AI service failed: " + lastError }, { status: 500 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            return NextResponse.json({ error: "No AI response" }, { status: 500 });
        }

        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const aiResult = JSON.parse(cleanJson);

        const funcInfo = aiResult.functionInfo || {
            javascript: { name: "solve", params: ["input"] },
            java: { name: "solve", returnType: "int", params: ["int[] input"] },
            cpp: { name: "solve", returnType: "int", params: ["vector<int> input"] }
        };

        // Build skeletons
        const skeletons = {
            javascript: `function ${funcInfo.javascript.name}(${funcInfo.javascript.params.join(", ")}) {\n  // TODO: Implement solution\n  return null;\n}`,
            java: `import java.util.*;\n\nclass Solution {\n  public ${funcInfo.java.returnType} ${funcInfo.java.name}(${funcInfo.java.params.join(", ")}) {\n    // TODO: Implement solution\n    return 0;\n  }\n}`,
            cpp: `#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n  ${funcInfo.cpp.returnType} ${funcInfo.cpp.name}(${funcInfo.cpp.params.join(", ")}) {\n    return 0;\n  }\n};`
        };

        // Build working drivers
        const jsFunc = funcInfo.javascript.name;
        const drivers = {
            javascript: `function runTests(tests) {\n  const results = [];\n  for (const test of tests) {\n    try {\n      const output = ${jsFunc}(...test.input);\n      results.push({ pass: JSON.stringify(output) === JSON.stringify(test.output), got: output, exp: test.output });\n    } catch (error) {\n      results.push({ pass: false, error: error.message });\n    }\n  }\n  return results;\n}`,
            java: "",
            cpp: ""
        };

        // Generate 20 hidden tests
        const hiddenTests = [];
        for (let i = 0; i < 20; i++) {
            hiddenTests.push({
                ...aiResult.testCases[i % aiResult.testCases.length],
                category: "hidden"
            });
        }

        const allTestCases = [...aiResult.testCases, ...hiddenTests];

        const result = {
            enhancedProblem: aiResult.enhancedProblem,
            testCases: aiResult.testCases.filter((t: any) => t.category === "sample"),
            allTestCases: allTestCases,
            skeletons,
            drivers
        };


        return NextResponse.json(result);

    } catch (e: any) {
        console.error("AI Enhance Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
