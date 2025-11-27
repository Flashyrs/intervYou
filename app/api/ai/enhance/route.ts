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

        const prompt = `
      You are an expert technical interviewer. I will give you a raw problem description.
      Your task is to:
      1. Clean up and format the problem description clearly (using Markdown).
      2. Extract or generate 3-5 diverse test cases (including edge cases) in a specific JSON format.
      3. Generate solution skeletons (class/function structures) for JavaScript, Java, and C++.
      4. Generate driver code for JavaScript, Java, and C++ that runs the solution against the provided test cases.
      
      Raw Problem:
      ${problemText}

      Output must be valid JSON with this structure:
      {
        "enhancedProblem": "markdown string...",
        "testCases": [
          { "input": [arg1, arg2], "output": expectedResult },
          ...
        ],
        "skeletons": {
          "javascript": "function solve(args) { ... }",
          "java": "class Solution { ... }",
          "cpp": "class Solution { ... };"
        },
        "drivers": {
          "javascript": "...",
          "java": "...",
          "cpp": "..."
        }
      }
      
      Details:
      - "input" must be an array of arguments.
      - Skeletons should use a "Solution" class structure where appropriate (Java, C++) or function (JS).
      - Drivers must be complete code that instantiates the Solution, runs the tests, and returns the results.
      - CRITICAL: Drivers MUST NOT hardcode test cases. They must use the 'tests' argument passed to them.
      - For Java Driver: It must be a class named 'Driver' with a static method 'public static List<String> runTests(String jsonTests)'. The driver must parse the JSON and RETURN a list of JSON strings (e.g. "{\"pass\":true}"). DO NOT print to stdout.
      - IMPORTANT for Java: When casting numeric inputs from the parsed JSON map (which are Objects), ALWAYS cast to Number first and then use .doubleValue(), .longValue(), or .intValue(). Example: ((Number) args.get(0)).doubleValue(). DO NOT cast directly to Double or Integer as the underlying type might be Long.
      - For C++ Driver: It must be a function 'void runTests(const std::string& jsonTests)'. The driver must parse the JSON.
      - For JS Driver: It must be a function 'runTests(tests)'. (JS receives parsed object).
      - Ensure all strings in the generated code are properly escaped.
      
      Do not wrap the JSON in markdown code blocks. Return raw JSON only.
    `;

        const models = [
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-2.0-flash-exp"
        ];

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
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    }
                );

                if (response.ok) {
                    break;
                } else {
                    const t = await response.text();
                    console.warn(`Model ${model} failed: ${response.status} - ${t}`);
                    lastError = t;
                }
            } catch (e: any) {
                console.warn(`Model ${model} error:`, e);
                lastError = e.message;
            }
        }

        if (!response || !response.ok) {
            console.error("All Gemini models failed. Last error:", lastError);
            return NextResponse.json({ error: "Failed to call AI service" }, { status: 500 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return NextResponse.json({ error: "No response from AI" }, { status: 500 });
        }


        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const result = JSON.parse(cleanJson);
            return NextResponse.json(result);
        } catch (e) {
            console.error("JSON parse error:", e, cleanJson);
            return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
        }

    } catch (e) {
        console.error("Handler error:", e);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
