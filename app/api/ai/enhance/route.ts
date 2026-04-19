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
    "enhancedTitle": "Short descriptive title of the problem",
    "enhancedProblem": "formatted markdown problem description",
    "testCases": [
      {"input": [arg1, arg2], "output": result, "category": "sample"},
      ...
    ],
    "functionInfo": {
      "javascript": {"name": "actualFunctionName", "params": ["actualParam1", "actualParam2"]},
      "java": {"name": "actualFunctionName", "returnType": "int[]", "params": [{"name": "nums", "type": "int[]"}, {"name": "target", "type": "int"}]},
      "cpp": {"name": "actualFunctionName", "returnType": "vector<int>", "params": [{"name": "nums", "type": "vector<int>&"}, {"name": "target", "type": "int"}]}
    }
  }
  
  IMPORTANT RULES:
  1. Generate 9 test cases: 4 sample + 5 edge cases.
  2. You MUST use explicit, correct, and descriptive types for Java (e.g., int[], List<Integer>, String, long, double, ArrayList<Integer>) and C++ (e.g., vector<int>&, string, int).
  3. Ensure the test case inputs are ARRAYS of arguments, one for each parameter.
  4. For Java, use return types like ArrayList<Integer> if the problem involves dynamic lists, or int[] for fixed arrays.`;

        const models = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash"
        ];

        let response;
        let lastError = "";
        let lastStatus = 500;
        let successfulModel = "";

        for (const model of models) {
            try {
                console.log(`Attempting AI Enhance with model: ${model}`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60000);
                try {
                    response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            signal: controller.signal,
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: prompt }] }],
                                generationConfig: {
                                    temperature: 0.3,
                                    maxOutputTokens: 2048,
                                    responseMimeType: "application/json"
                                }
                            })
                        }
                    );
                } finally {
                    clearTimeout(timeout);
                }

                if (response.ok) {
                    successfulModel = model;
                    break;
                }

                const errorText = await response.text();
                lastStatus = response.status;
                lastError = `Model ${model} error: ${response.status} ${response.statusText}`;
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
            return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
        }
        let cleanJson = text.trim();
        if (cleanJson.includes("```")) {
            cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        let aiResult;
        try {
            aiResult = JSON.parse(cleanJson);
        } catch (e) {
            // Fallback: try to extract substring between first { and last }
            const start = cleanJson.indexOf('{');
            const end = cleanJson.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                try {
                    aiResult = JSON.parse(cleanJson.substring(start, end + 1));
                } catch (e2) {
                    throw new Error("Failed to parse AI response: " + cleanJson);
                }
            } else {
                throw new Error("Invalid AI response format: " + cleanJson);
            }
        }
        
        const funcInfo = aiResult.functionInfo || {
            javascript: { name: "solve", params: ["input"] },
            java: { name: "solve", returnType: "int", params: [{ name: "input", type: "int[]" }] },
            cpp: { name: "solve", returnType: "int", params: [{ name: "input", type: "vector<int>" }] }
        };

        const skeletons = {
            javascript: `function ${funcInfo.javascript?.name || "solve"}(${(funcInfo.javascript?.params || []).join(", ")}) {\n  // TODO: Implement solution\n  return null;\n}`,
            java: `import java.util.*;\n\nclass Solution {\n  public ${funcInfo.java?.returnType || "void"} ${funcInfo.java?.name || "solve"}(${(funcInfo.java?.params || []).map((p: any) => `${p.type || 'Object'} ${p.name || 'arg'}`).join(", ")}) {\n    // TODO: Implement solution\n    return 0;\n  }\n}`,
            cpp: `#include <vector>\n#include <string>\n#include <algorithm>\n#include <map>\n#include <set>\nusing namespace std;\n\nclass Solution {\npublic:\n  ${funcInfo.cpp?.returnType || "void"} ${funcInfo.cpp?.name || "solve"}(${(funcInfo.cpp?.params || []).map((p: any) => `${p.type || 'int'} ${p.name || 'arg'}`).join(", ")}) {\n    // TODO: Implement solution\n    return 0;\n  }\n};`
        };

        const jsFunc = funcInfo.javascript?.name || "solve";
        const drivers = {
            javascript: `function runTests(tests) {
  const results = [];
  for (const test of tests) {
    try {
      const output = ${jsFunc}(...test.input);
      results.push({ pass: JSON.stringify(output) === JSON.stringify(test.output), got: output, exp: test.output });
    } catch (error) {
      results.push({ pass: false, error: error.message });
    }
  }
  return results;
}`,
            java: `import java.util.*;
import java.lang.reflect.Method;
import java.lang.reflect.Array;

class Driver {
    public static List<String> runTests(List<Map<String, Object>> tests) {
        List<String> outcomes = new ArrayList<>();
        Solution sol = new Solution();
        Method solveMethod = null;
        for (Method m : Solution.class.getDeclaredMethods()) {
            if (m.getName().equals("${funcInfo.java?.name || "solve"}")) {
                solveMethod = m;
                break;
            }
        }
        if (solveMethod == null) {
            outcomes.add("{\\"error\\":\\"Method not found: ${funcInfo.java?.name}\\" }");
            return outcomes;
        }

        for (Map<String, Object> test : tests) {
            Map<String, Object> result = new LinkedHashMap<>();
            try {
                Object rawInput = test.get("input");
                List<Object> argsList = new ArrayList<>();
                java.lang.reflect.Type[] paramTypes = solveMethod.getGenericParameterTypes();
                
                if (rawInput instanceof List) {
                    List<?> asList = (List<?>) rawInput;
                    if (asList.size() == paramTypes.length) {
                        argsList.addAll(asList);
                    } else if (paramTypes.length == 1) {
                        argsList.add(rawInput);
                    }
                } else {
                    argsList.add(rawInput);
                }

                Object[] convertedArgs = new Object[paramTypes.length];
                for (int i = 0; i < paramTypes.length; i++) {
                    convertedArgs[i] = convert(i < argsList.size() ? argsList.get(i) : null, paramTypes[i]);
                }

                Object res = solveMethod.invoke(sol, convertedArgs);
                result.put("got", res);
                result.put("exp", test.get("output"));
                result.put("pass", deepEquals(res, test.get("output")));
            } catch (Exception e) {
                result.put("pass", false);
                Throwable cause = (e.getCause() != null) ? e.getCause() : e;
                result.put("error", cause.getClass().getSimpleName() + ": " + cause.getMessage());
            }
            outcomes.add(Main.objToJson(result));
        }
        return outcomes;
    }

    private static Object convert(Object o, java.lang.reflect.Type targetType) {
        if (o == null) return null;
        Class<?> targetClass;
        if (targetType instanceof Class<?>) {
            targetClass = (Class<?>) targetType;
        } else {
            targetClass = (Class<?>) ((java.lang.reflect.ParameterizedType) targetType).getRawType();
        }

        if (targetClass == int.class || targetClass == Integer.class) return ((Number)o).intValue();
        if (targetClass == long.class || targetClass == Long.class) return ((Number)o).longValue();
        if (targetClass == double.class || targetClass == Double.class) return ((Number)o).doubleValue();
        if (targetClass == String.class) return String.valueOf(o);
        if (targetClass == boolean.class || targetClass == Boolean.class) return (Boolean)o;

        if (targetClass.isArray() && o instanceof List) {
            List<?> list = (List<?>) o;
            Class<?> comp = targetClass.getComponentType();
            Object arr = Array.newInstance(comp, list.size());
            for (int i = 0; i < list.size(); i++) Array.set(arr, i, convert(list.get(i), comp));
            return arr;
        }
        
        if (List.class.isAssignableFrom(targetClass) && o instanceof List) {
            List<?> list = (List<?>) o;
            java.lang.reflect.Type elType = (targetType instanceof java.lang.reflect.ParameterizedType) 
                ? ((java.lang.reflect.ParameterizedType) targetType).getActualTypeArguments()[0] 
                : Object.class;
            List<Object> newList = new ArrayList<>();
            for (Object item : list) newList.add(convert(item, elType));
            return newList;
        }
        return o;
    }

    private static boolean deepEquals(Object a, Object b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        return Main.valToJson(a).equals(Main.valToJson(b));
    }
}
`,
            cpp: `#include <iostream>
#include <vector>
#include <map>
#include <string>
#include <algorithm>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using namespace std;

void runTests(const string& jsonTests) {
    try {
        auto tests = json::parse(jsonTests);
        Solution sol;
        vector<map<string, json>> results;

        for (const auto& t : tests) {
            map<string, json> res;
            try {
                auto args = t["input"];
                ${(funcInfo.cpp?.params || []).map((p: any, i: number) => {
                    let type = (typeof p === 'string' ? 'int' : (p.type || 'int'));
                    type = type.replace('&', '').trim();
                    return `auto arg${i} = args[${i}].get<${type}>();`;
                }).join("\n                ")}
                
                auto output = sol.${funcInfo.cpp?.name || "solve"}(${(funcInfo.cpp?.params || []).map((_: any, i: number) => `arg${i}`).join(", ")});
                
                res["got"] = output;
                res["exp"] = t["output"];
                res["pass"] = (output == t["output"]);
            } catch (const std::exception& e) {
                res["pass"] = false;
                res["error"] = e.what();
            }
            results.push_back(res);
        }
        cout << "___JSON_RESULT___" << endl;
        cout << json(results).dump() << endl;
    } catch (...) {
        cout << "___JSON_RESULT___" << endl;
        cout << "[{\\"error\\":\\"Hard crash in driver\\"}]" << endl;
    }
}`
        };

        const baseTests = aiResult.testCases || [];
        const hiddenTests = [];
        if (baseTests.length > 0) {
            for (let i = 0; i < 20; i++) {
                hiddenTests.push({ ...baseTests[i % baseTests.length], category: "hidden" });
            }
        }

        return NextResponse.json({
            enhancedTitle: aiResult.enhancedTitle,
            enhancedProblem: aiResult.enhancedProblem,
            testCases: baseTests.filter((t: any) => t.category === "sample"),
            allTestCases: [...baseTests, ...hiddenTests],
            skeletons,
            drivers
        });

    } catch (e: any) {
        console.error("AI Enhance Fatal Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
