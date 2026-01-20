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

        // Updated model list: prioritize stable models, then experimental
        const models = [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-2.0-flash-exp"
        ];

        let response;
        let lastError;
        let successfulModel = "";

        for (const model of models) {
            try {
                console.log(`Attempting AI Enhance with model: ${model}`);
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.3,
                                responseMimeType: "application/json" // Hint for JSON output
                            }
                        })
                    }
                );

                if (response.ok) {
                    successfulModel = model;
                    break;
                }

                const errorText = await response.text();
                console.warn(`Model ${model} failed:`, errorText);
                lastError = `Model ${model} error: ${response.status} ${response.statusText}`;
            } catch (e: any) {
                console.warn(`Model ${model} network error:`, e.message);
                lastError = e.message;
            }
        }

        if (!response || !response.ok) {
            console.error("All AI models failed. Last error:", lastError);
            return NextResponse.json({ error: "AI service failed to respond. Please try again later. Details: " + lastError }, { status: 500 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error("No text in AI response from model:", successfulModel);
            return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
        }

        let cleanJson = text;
        // Aggressive JSON cleanup
        if (cleanJson.includes("```")) {
            cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "");
        }
        cleanJson = cleanJson.trim();

        let aiResult;
        try {
            aiResult = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error("JSON parse failed:", parseError, "Content:", cleanJson);
            // Last ditch effort: try to find start/end braces
            const start = cleanJson.indexOf('{');
            const end = cleanJson.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                try {
                    aiResult = JSON.parse(cleanJson.substring(start, end + 1));
                } catch (e) {
                    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
                }
            } else {
                return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
            }
        }

        const funcInfo = aiResult.functionInfo || {
            javascript: { name: "solve", params: ["input"] },
            java: { name: "solve", returnType: "int", params: ["int[] input"] },
            cpp: { name: "solve", returnType: "int", params: ["vector<int> input"] }
        };

        // Build skeletons (ensure robust type handling)
        const skeletons = {
            javascript: `function ${funcInfo.javascript?.name || "solve"}(${(funcInfo.javascript?.params || []).join(", ")}) {\n  // TODO: Implement solution\n  return null;\n}`,
            java: `import java.util.*;\n\nclass Solution {\n  public ${funcInfo.java?.returnType || "void"} ${funcInfo.java?.name || "solve"}(${(funcInfo.java?.params || []).join(", ")}) {\n    // TODO: Implement solution\n    return 0;\n  }\n}`,
            cpp: `#include <vector>\n#include <string>\n#include <algorithm>\nusing namespace std;\n\nclass Solution {\npublic:\n  ${funcInfo.cpp?.returnType || "void"} ${funcInfo.cpp?.name || "solve"}(${(funcInfo.cpp?.params || []).join(", ")}) {\n    // TODO: Implement solution\n    return 0;\n  }\n};`
        };

        // Build working drivers
        const jsFunc = funcInfo.javascript?.name || "solve";
        const drivers = {
            javascript: `function runTests(tests) {\n  const results = [];\n  for (const test of tests) {\n    try {\n      const output = ${jsFunc}(...test.input);\n      results.push({ pass: JSON.stringify(output) === JSON.stringify(test.output), got: output, exp: test.output });\n    } catch (error) {\n      results.push({ pass: false, error: error.message });\n    }\n  }\n  return results;\n}`,
            java: "", // Drivers generated on client/execute side for now or unused
            cpp: ""
        };

        // Generate 20 hidden tests by cycling
        const hiddenTests = [];
        const baseTests = aiResult.testCases || [];
        if (baseTests.length > 0) {
            for (let i = 0; i < 20; i++) {
                hiddenTests.push({
                    ...baseTests[i % baseTests.length],
                    category: "hidden"
                });
            }
        }

        const allTestCases = [...baseTests, ...hiddenTests];

        const result = {
            enhancedProblem: aiResult.enhancedProblem,
            testCases: baseTests.filter((t: any) => t.category === "sample"),
            allTestCases: allTestCases,
            skeletons,
            drivers
        };

        return NextResponse.json(result);

    } catch (e: any) {
        console.error("AI Enhance Fatal Error:", e);
        return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
