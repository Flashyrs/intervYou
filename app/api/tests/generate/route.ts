import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { problemText, language } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini not configured" }, { status: 501 });
    }

    if (!problemText) {
      return NextResponse.json({ error: "problemText required" }, { status: 400 });
    }

    const prompt = `
You are an expert at generating comprehensive test cases for coding interview problems.

Problem:
${problemText}

Your task:
- Generate EXACTLY 29 diverse test cases covering all scenarios
- Categorize them as follows:
  * 4 test cases with category: "sample" (basic examples)
  * 5 test cases with category: "edge" (edge cases and boundary conditions)
  * 20 test cases with category: "hidden" (comprehensive hidden test cases)
- Each test case must have: "input" (array of arguments), "output" (expected result), and "category"

Return ONLY valid JSON with this exact structure:
{
  "tests": [
    { "input": [...], "output": ..., "category": "sample" },
    { "input": [...], "output": ..., "category": "sample" },
    { "input": [...], "output": ..., "category": "sample" },
    { "input": [...], "output": ..., "category": "sample" },
    { "input": [...], "output": ..., "category": "edge" },
    { "input": [...], "output": ..., "category": "edge" },
    { "input": [...], "output": ..., "category": "edge" },
    { "input": [...], "output": ..., "category": "edge" },
    { "input": [...], "output": ..., "category": "edge" },
    { "input": [...], "output": ..., "category": "hidden" },
    ... (20 total hidden test cases)
  ]
}

Important:
- Total test cases: EXACTLY 29
- Categories: 4 sample + 5 edge + 20 hidden
- "input" must always be an array
- Do NOT include explanations
- Do NOT wrap in markdown code blocks
- Return raw JSON only
`;

    const models = [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash"
    ];

    let response;
    let lastError;

    for (const model of models) {
      try {
        console.log(`Trying Gemini model: ${model}`);
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );

        if (response.ok) {
          console.log(`Success with model: ${model}`);
          break;
        } else {
          const errText = await response.text();
          console.warn(`Failed with model ${model}: ${response.status} - ${errText}`);
          lastError = `Error ${response.status}: ${errText}`;
        }
      } catch (e: any) {
        console.warn(`Exception with model ${model}:`, e);
        lastError = e.message;
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `All Gemini models failed. Last error: ${lastError}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let cleanText = text.trim();

    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    let parsed: any;
    try {
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonString = cleanText.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonString);
      } else {
        throw new Error("No JSON block found");
      }
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON in Gemini response" }, { status: 502 });
    }

    if (
      !parsed ||
      !Array.isArray(parsed.tests) ||
      parsed.tests.length !== 29
    ) {
      return NextResponse.json({
        error: `Expected exactly 29 test cases, got ${parsed?.tests?.length || 0}`
      }, { status: 502 });
    }

    // Validate categories
    const sampleCount = parsed.tests.filter((t: any) => t.category === "sample").length;
    const edgeCount = parsed.tests.filter((t: any) => t.category === "edge").length;
    const hiddenCount = parsed.tests.filter((t: any) => t.category === "hidden").length;

    if (sampleCount !== 4 || edgeCount !== 5 || hiddenCount !== 20) {
      console.warn(`Test category mismatch: ${sampleCount} sample, ${edgeCount} edge, ${hiddenCount} hidden`);
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (e: any) {
    console.error("Generation error:", e);
    return NextResponse.json(
      { error: e?.message || "Generation failed" },
      { status: 500 }
    );
  }
}
