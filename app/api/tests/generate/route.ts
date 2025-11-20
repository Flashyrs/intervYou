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

    let prompt = "";
    const lang = (language || "").toLowerCase();

    if (lang === "javascript" || lang === "js") {
      prompt = `
You are an assistant that generates a driver function and test cases for a coding interview problem.

Problem:
${problemText}

Language: JavaScript

Your task:
- Generate a valid JavaScript driver function named runTests(tests) that executes the user's solution and returns an array of results.
- Assume the user's solution is a function named 'solve'.
- Generate 2 to 5 test cases.
- Each test case should be an object with "input" and "output" fields.
- Return ONLY a valid JSON object with the following structure:

{
  "driver": "string", // JavaScript code for function runTests(tests) { ... }
  "tests": [
    { "input": "...", "output": "..." }
  ]
}

Important rules for driver:
- Must define: function runTests(tests) { ... }
- It should iterate over 'tests', call solve(t.input), and compare with t.output.
- Return the array of results.
- Do NOT include any explanations.
- Return only valid JSON.
`;
    } else if (lang === "java") {
      prompt = `
You are an assistant that generates a driver function and test cases for a coding interview problem.

Problem:
${problemText}

Language: Java

Your task:
- Generate a valid Java driver function named Driver.runTests(List<Map<String,Object>> tests) that executes the user's solution and RETURNS a JSON array string.
- Generate 2 to 5 test cases.
- Each test case should be an object with "input" and "output" fields.
- Return ONLY a valid JSON object with the following structure:

{
  "driver": "string", // Java code snippet implementing class Driver
  "tests": [
    { "input": "...", "output": "..." }
  ]
}

Important rules for driver:
- Must define: class Driver { public static List<String> runTests(List<Map<String,Object>> tests) { ... } }
- It MUST compute pass = deep equality between got and exp.
- It MUST return a single-element List<String> where the only element is the JSON array string of results.
- Do NOT print inside driver.
- Do NOT include any explanations.
- Return only valid JSON.
`;
    } else {
      // Default / C++ (Basic fallback)
      prompt = `
You are an assistant that generates a driver function and test cases for a coding interview problem.

Problem:
${problemText}

Language: ${language}

Your task:
- Generate a driver function and 2-5 test cases.
- Return ONLY a valid JSON object with the following structure:

{
  "driver": "string",
  "tests": [
    { "input": "...", "output": "..." }
  ]
}

Do NOT include any explanations.
Return only valid JSON.
`;
    }

    const models = [
      "gemini-2.0-flash",
      "gemini-flash-latest",
      "gemini-pro-latest"
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

    console.log("Gemini Raw Response Text:", text); // DEBUG

    // --- Robust JSON Extraction ---
    let cleanText = text.trim();
    // Find the first '{' and the last '}'
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
