// import { NextResponse } from "next/server";
// import { requireAuth } from "@/lib/utils";

// export async function POST(req: Request) {
//   try {
//     await requireAuth();
//     const { problemText, language } = await req.json();

//     if (!process.env.GEMINI_API_KEY) {
//       return NextResponse.json({ error: "Gemini not configured" }, { status: 501 });
//     }
//     if (!problemText || !language) {
//       return NextResponse.json({ error: "problemText and language required" }, { status: 400 });
//     }

// const prompt = `
// You are an assistant that generates a driver function and test cases for a coding interview problem.

// Problem:
// ${problemText}

// Language: ${language}

// Your task:
// - Generate a valid driver function (as a string) that can run the solution for this problem.
// - Generate 2 to 5 test cases.
// - Each test case should be an object with "input" and "output" fields.
// - Return ONLY a valid JSON object with the following structure:

// {
//   "driver": "string",
//   "tests": [
//     { "input": "...", "output": "..." },
//     ...
//   ]
// }

// Do NOT include any explanations, markdown, or comments.
// Return only valid JSON.
// `;

//     const res = await fetch(
//       "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent" +
//         `?key=${process.env.GEMINI_API_KEY}`,
//       {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
//       }
//     );

//     if (!res.ok) {
//       const t = await res.text();
//       return NextResponse.json({ error: `Gemini error ${res.status}: ${t}` }, { status: 502 });
//     }

//     const data = await res.json();
//     const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

//     // Try to parse the JSON block from the response
//     let parsed: any = null;
//     try {
//       const start = text.indexOf("{");
//       const end = text.lastIndexOf("}");
//       parsed = JSON.parse(text.slice(start, end + 1));
//     } catch {}

//     if (!parsed || !parsed.tests || !Array.isArray(parsed.tests) || typeof parsed.driver !== "string") {
//       return NextResponse.json({ error: "Invalid response from Gemini" }, { status: 502 });
//     }

//     return NextResponse.json(parsed, { status: 200 });
//   } catch (e: any) {
//     return NextResponse.json({ error: e?.message || "Generation failed" }, { status: 500 });
//   }
// }

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    await requireAuth();
    const { problemText, language } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini not configured" }, { status: 501 });
    }

    if (!problemText || !language) {
      return NextResponse.json({ error: "problemText and language required" }, { status: 400 });
    }

    const prompt = `
You are an assistant that generates a driver function and test cases for a coding interview problem.

Problem:
${problemText}

Language: ${language}

Your task:
- Generate a valid Java driver function named Driver.runTests(List<Map<String,Object>> tests) that executes the user's solution and RETURNS a JSON array string where each element is an object of the shape { "got": any, "exp": any, "pass": boolean } or { "error": string, "pass": false }.
- Prefer returning a single JSON array string (not printing) so our harness can print it directly.
- Generate 2 to 5 test cases.
- Each test case should be an object with "input" and "output" fields.
- Return ONLY a valid JSON object with the following structure:

{
  "driver": "string", // Java code snippet implementing class Driver with method: public static List<String> runTests(List<Map<String,Object>> tests)
  "tests": [
    { "input": "...", "output": "..." }
  ]
}

Important rules for driver:
- Must define: class Driver { public static List<String> runTests(List<Map<String,Object>> tests) { ... } }
- It MUST compute pass = deep equality between got and exp, and build array entries with fields: got, exp, pass (or error, pass: false on failure)
- It MUST return a single-element List<String> where the only element is the JSON array string of results.
- Do NOT print inside driver; just return the results array as one JSON string element.

Do NOT include any explanations, markdown, or comments.
Return only valid JSON.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Gemini error ${response.status}: ${errorText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // --- Robust JSON Extraction ---
    let parsed: any;
    try {
      // Use regex to extract the first valid JSON block, safer than slice
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON block found");
      parsed = JSON.parse(match[0]);
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON in Gemini response" }, { status: 502 });
    }

    if (
      !parsed ||
      typeof parsed.driver !== "string" ||
      !Array.isArray(parsed.tests)
    ) {
      return NextResponse.json({ error: "Incomplete Gemini response" }, { status: 502 });
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
