
export function stringifyCompact(v: any) {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function prettyResult(out: any) {
  const s = out?.stdout || out?.compile_output || out?.message || "";
  if (!s) return JSON.stringify(out, null, 2);
  return typeof s === 'string' ? s : JSON.stringify(s, null, 2);
}

export function safeJSON(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return 'null';
  }
}

export function maybeInjectSkeleton(current: string, lang: string) {
  const trimmed = (current || '').trim();
  const looksEmpty = trimmed === '' || trimmed.startsWith('// Start coding');
  if (!looksEmpty) return current;
  switch ((lang || '').toLowerCase()) {
    case 'javascript':
      return `// Implement solve(...) and use tests to validate\nfunction solve() {\n  // TODO\n}\n`;
    case 'java':
      return `class Solution {\n  // TODO: implement methods\n}\n`;
    case 'cpp':
      return `#include <bits/stdc++.h>\nusing namespace std;\n// TODO: implement solution functions\n`;
    default:
      return current;
  }
}

export function mergeTests(sampleText: string, privateText: string) {
  const s = (() => { try { return JSON.parse(sampleText || "[]"); } catch { return []; } })();
  const p = (() => { try { return JSON.parse(privateText || "[]"); } catch { return []; } })();
  return [...s, ...p];
}

export function buildHarness(language: string, userCode: string, driver: string, tests: any[]) {
  switch ((language || '').toLowerCase()) {
    case 'javascript':
      return buildJS(userCode, driver, tests);
    case 'java':
      return buildJava(userCode, driver, tests);
    case 'cpp':
      return buildCpp(userCode, driver, tests);
    default:
      return userCode;
  }
}

function buildJS(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);
  const drv = driver || `function runTests() { return []; }`;

  // Extract imports
  const lines = userCode.split('\n');
  const imports: string[] = [];
  const code: string[] = [];

  lines.forEach(line => {
    if (line.trim().startsWith('import ')) {
      imports.push(line);
    } else {
      code.push(line);
    }
  });

  const importsStr = imports.join('\n');
  const codeStr = code.join('\n');

  return `"use strict";
${importsStr}

${codeStr}

${drv}

(function(){
  const results = [];
  const tests = ${testStr};
  try {
    if (typeof runTests === 'function') {
      const r = runTests(tests) || [];
      if (Array.isArray(r)) { for (const x of r) results.push(x); } else { results.push(r); }
    } else if (typeof solve === 'function') {
      for (const t of tests) {
        const inp = t.input;
        const exp = t.output;
        const got = Array.isArray(inp) ? solve(...inp) : solve(inp);
        results.push({ got, exp, pass: JSON.stringify(got)===JSON.stringify(exp) });
      }
    } else {
      results.push({ error: 'No solve() or runTests() defined' });
    }
  } catch (e) {
    results.push({ error: String(e&&e.message||e) });
  }
  console.log(JSON.stringify(results));
})();`;
}

function buildJava(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);

  let codeToProcess = userCode || '';

  // If user wrapped their code in "class Solution { }", unwrap it
  const classMatch = codeToProcess.match(/class\s+Solution\s*\{([\s\S]*)\}\s*$/);
  if (classMatch) {
    codeToProcess = classMatch[1].trim();
  }

  // Extract imports and remove package declarations
  const importLines: string[] = [];
  const codeLines: string[] = [];

  codeToProcess.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('package ')) {
      // Ignore package declarations
    } else if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
      importLines.push(line);
    } else if (trimmed.length > 0) {
      codeLines.push(line);
    }
  });

  const userCodeWithoutImports = codeLines.join('\n');
  const userImports = importLines.length > 0 ? importLines.join('\n') + '\n' : '';

  const drv = (driver && driver.trim().length)
    ? driver
    : `// Provide either runTests(List<Map<String,Object>> tests) or solve(...)
import java.util.*;
class Driver {
  public static List<String> runTests(List<Map<String,Object>> tests) {
    List<String> out = new ArrayList<>();
    try {
      // If user implemented solve, try to invoke reflectively assumptions kept simple for primitives/arrays
      out.add("No driver provided; implement runTests or ensure solve(...) exists.");
    } catch (Exception e) {
      out.add("Error: "+e.getMessage());
    }
    return out;
  }
}`;

  return `import java.io.*;\nimport java.util.*;\n${userImports}class Solution {\n${userCodeWithoutImports}\n}\n${drv}\nclass Main {\n  public static void main(String[] args) throws Exception {\n    List<Map<String,Object>> tests = new ArrayList<>();\n    String json = "${testStr.replace(/"/g, '\\"')}";\n    tests = parseTests(json);\n    List<Map<String,Object>> results = new ArrayList<>();\n    try {\n      List<String> lines = null;\n      try {\n        lines = Driver.runTests(tests);\n      } catch (Throwable ignore) { }\n      if (lines != null) {\n        for (String s: lines) { System.out.println(s); }\n        return;\n      } else {\n        for (int i = 0; i < tests.size(); i++) {\n          Map<String,Object> r = new LinkedHashMap<>();\n          r.put("error", "No driver provided; implement Driver.runTests");\n          r.put("pass", false);\n          results.add(r);\n        }\n      }\n    } catch (Throwable t) {\n      Map<String,Object> r = new LinkedHashMap<>();\n      r.put("error", "Driver error: "+t.getMessage());\n      r.put("pass", false);\n      results.add(r);\n    }\n    System.out.println(toJson(results));\n  }\n  static String toJson(List<Map<String,Object>> list){\n    StringBuilder sb = new StringBuilder();\n    sb.append("[");\n    for (int i=0;i<list.size();i++){ if (i>0) sb.append(","); sb.append(objToJson(list.get(i))); }\n    sb.append("]");\n    return sb.toString();\n  }\n  static String objToJson(Map<String,Object> m){\n    StringBuilder sb = new StringBuilder(); sb.append("{"); boolean first=true;\n    for (Map.Entry<String,Object> e: m.entrySet()){ if (!first) sb.append(","); first=false; sb.append(quote(e.getKey())).append(":" ).append(valToJson(e.getValue())); }\n    sb.append("}"); return sb.toString();\n  }\n  static String quote(String s){ return "\\""+s.replace("\\\\","\\\\\\\\").replace("\\"","\\\\\\"")+"\\"";}  static String valToJson(Object v){ if (v==null) return "null"; if (v instanceof String) return quote((String)v); if (v instanceof Number || v instanceof Boolean) return String.valueOf(v); return quote(String.valueOf(v)); }\n  static List<Map<String,Object>> parseTests(String json){\n    List<Map<String,Object>> list = new ArrayList<>();\n    try{ String arr = json.trim(); if (!arr.startsWith("[")) return list; arr = arr.substring(1, arr.length()-1).trim(); if (arr.isEmpty()) return list; String[] parts = arr.split("\\\\},\\\\s*\\\\{"); for (int i=0;i<parts.length;i++){ String p = parts[i]; if (!p.startsWith("{")) p = "{"+p; if (!p.endsWith("}")) p = p+"}"; Map<String,Object> m = new LinkedHashMap<>(); m.put("raw", p); list.add(m);} }catch(Exception e){}\n    return list;\n  }\n}\n`;
}

function buildCpp(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);
  const drv = (driver && driver.trim().length)
    ? driver
    : `// Provide either void runTests(const std::vector<nlohmann::json>& tests) or solve(...)
void runTests(const std::vector<std::string>& tests) {
  std::cout << "No driver provided; implement runTests or solve(...)" << std::endl;
}
`;

  // Extract includes
  const lines = userCode.split('\n');
  const includes: string[] = [];
  const code: string[] = [];

  lines.forEach(line => {
    if (line.trim().startsWith('#include')) {
      includes.push(line);
    } else {
      code.push(line);
    }
  });

  const includesStr = includes.join('\n');
  const codeStr = code.join('\n');

  return `#include <bits/stdc++.h>
using namespace std;
${includesStr}

${codeStr}
${drv}
int main(){
  string json = "${testStr.replace(/"/g, '\\"')}";
  cout<<json<<endl;
  return 0;
}
`;
}
