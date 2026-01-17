
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
      return `// Implement solve(...) and use tests to validate
function solve(input) {
  // TODO: Implement solution
  return input;
}
`;
    case 'java':
      return `class Solution {
    public Object solve(Object input) {
        // TODO: Implement solution
        return input;
    }
}
`;
    case 'cpp':
      return `class Solution {
public:
    // Adjust return type and arguments as needed
    int solve(vector<int>& nums) {
        // TODO: Implement solution
        return 0;
    }
};
`;
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


  const lines = userCode.split('\n');
  const imports: string[] = [];
  const code: string[] = [];

  lines.forEach(line => {
    if (line.trim().startsWith('import ') || line.trim().startsWith('require(')) {
      imports.push(line);
    } else {
      code.push(line);
    }
  });

  const importsStr = imports.join('\n');
  const codeStr = code.join('\n');

  return `${importsStr}
"use strict";

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
  console.log("___JSON_RESULT___");
  console.log(JSON.stringify(results));
})();`;
}

function buildJava(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);

  // 1. Extract Imports
  const importLines: Set<string> = new Set();
  const codeLines: string[] = [];

  // Default imports
  importLines.add("import java.util.*;");
  importLines.add("import java.io.*;");

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('package ')) {
      // Ignore packages
    } else if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
      if (!trimmed.includes('org.json')) { // Strip external JSON libs
        importLines.add(trimmed);
      }
    } else {
      codeLines.push(line);
    }
  };

  (userCode || '').split('\n').forEach(processLine);

  const userCodeWithoutImports = codeLines.join('\n');

  // 2. Check for existing classes
  const hasSolutionClass = /class\s+Solution\b/.test(userCodeWithoutImports);
  const hasPairClass = /class\s+Pair\b/.test(userCodeWithoutImports);

  // 3. Process Driver Code
  let driverCode = (driver && driver.trim().length) ? driver : '';

  // Remove "public" from Driver class
  driverCode = driverCode.replace(/public\s+class\s+Driver/g, 'class Driver');

  // More robust Solution class removal using brace counting
  function removeSolutionClass(code: string): string {
    const lines = code.split('\n');
    const result: string[] = [];
    let inSolutionClass = false;
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if this line starts a Solution class
      if (trimmed.startsWith('class Solution')) {
        inSolutionClass = true;
        braceDepth = 0;
      }

      if (inSolutionClass) {
        // Count braces to track class boundaries
        for (const char of line) {
          if (char === '{') braceDepth++;
          if (char === '}') braceDepth--;
        }

        // If we've closed all braces, we're done with the Solution class
        if (braceDepth === 0 && line.includes('}')) {
          inSolutionClass = false;
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  driverCode = removeSolutionClass(driverCode);

  const driverLines: string[] = [];
  driverCode.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
      if (!trimmed.includes('org.json')) {
        importLines.add(trimmed);
      }
    } else if (!trimmed.startsWith('package ')) {
      driverLines.push(line);
    }
  });

  const driverWithoutImports = driverLines.join('\n');
  const allImports = Array.from(importLines).join('\n') + '\n';

  // 4. Construct Final Code
  const expectsString = driverCode.includes('runTests(String') || driverCode.includes('runTests(java.lang.String');

  const finalDriver = driverWithoutImports || `
class Driver {
  public static List<String> runTests(List<Map<String,Object>> tests) {
    List<String> out = new ArrayList<>();
    // Return a valid JSON result indicating no driver
    out.add("{\\\"pass\\\":false,\\\"error\\\":\\\"No driver implementation provided\\\"}");
    return out;
  }
}`;

  // Polyfills
  const pairPolyfill = hasPairClass ? '' : `
class Pair<K, V> {
    public K key;
    public V value;
    public K first; // Alias
    public V second; // Alias
    public Pair(K key, V value) {
        this.key = key;
        this.value = value;
        this.first = key;
        this.second = value;
    }
}`;

  const jsonPolyfills = `
class JSONObject extends java.util.LinkedHashMap<String, Object> {
    public Object get(Object key) { return super.get(key); }
    public String toJSONString() { return Main.objToJson(this); }
    public String toString() { return toJSONString(); }
}
class JSONArray extends java.util.ArrayList<Object> {
    public Object get(int index) { return super.get(index); }
    public String toJSONString() { return Main.listToJson(this); }
    public String toString() { return toJSONString(); }
}
class JSONParser {
    public Object parse(String s) throws ParseException {
        try {
            return Main.parseJson(s);
        } catch (Exception e) {
            throw new ParseException(e.toString());
        }
    }
}
class ParseException extends Exception {
    public ParseException(String s) { super(s); }
}`;

  // Wrap user code if Solution class is missing
  // Also ensure all code is inside the Solution class  
  let finalUserCode: string;
  if (hasSolutionClass) {
    // Check if there's any code after the Solution class that needs to be moved inside
    const lines = userCodeWithoutImports.split('\n');
    let inSolutionClass = false;
    let solutionClassDepth = 0;
    let solutionEndLine = -1;
    const solutionLines: string[] = [];
    const orphanedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect Solution class start
      if (trimmed.includes('class Solution')) {
        inSolutionClass = true;
        solutionClassDepth = 0;
      }

      if (inSolutionClass) {
        // Count braces
        for (const char of line) {
          if (char === '{') solutionClassDepth++;
          if (char === '}') solutionClassDepth--;
        }

        solutionLines.push(line);

        // Check if Solution class ended
        if (solutionClassDepth === 0 && line.includes('}')) {
          inSolutionClass = false;
          solutionEndLine = i;
        }
      } else if (solutionEndLine !== -1) {
        // Code after Solution class ended - this is orphaned
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
          orphanedLines.push(line);
        }
      }
    }

    // If we found orphaned code, inject it back into Solution class
    if (orphanedLines.length > 0 && solutionLines.length > 0) {
      // Remove the last closing brace from Solution
      let lastBraceIndex = -1;
      for (let i = solutionLines.length - 1; i >= 0; i--) {
        if (solutionLines[i].includes('}')) {
          lastBraceIndex = i;
          break;
        }
      }

      if (lastBraceIndex !== -1) {
        // Insert orphaned code before the closing brace
        const beforeClose = solutionLines.slice(0, lastBraceIndex);
        const indentedOrphaned = orphanedLines.map(line =>
          line.trim() ? '    ' + line : line
        );
        finalUserCode = [...beforeClose, ...indentedOrphaned, solutionLines[lastBraceIndex]].join('\n');
      } else {
        finalUserCode = userCodeWithoutImports;
      }
    } else {
      // No orphaned code - use as is
      finalUserCode = userCodeWithoutImports;
    }
  } else {
    // Need to wrap user code in Solution class
    const indentedCode = userCodeWithoutImports.split('\n')
      .map(line => line.trim() ? '    ' + line : line)
      .join('\n');
    finalUserCode = `class Solution {\n${indentedCode}\n}`;
  }

  return `${allImports}

${pairPolyfill}
${jsonPolyfills}

${finalUserCode}

${finalDriver}

class Main {
  public static void main(String[] args) throws Exception {
    String json = "${testStr.replace(/"/g, '\\"')}";
    
    List<Map<String,Object>> results = new ArrayList<>();
    try {
        List<String> lines = null;
        ${expectsString
      ? 'lines = Driver.runTests(json);'
      : 'List<Map<String,Object>> tests = Main.parseTests(json); lines = Driver.runTests(tests);'
    }
        
        if (lines != null) {
            System.out.println("___JSON_RESULT___");
            System.out.print("[");
            for (int i = 0; i < lines.size(); i++) {
                if (i > 0) System.out.print(",");
                System.out.print(lines.get(i));
            }
            System.out.println("]");
            // Driver should return lines of JSON, but if it returns raw strings, we might need to handle it.
            // Actually, the Java driver in buildJava seems to return List<String> which are printed.
            // Wait, the Java driver logic is a bit complex.
            // Let's look at lines 352-355:
            // lines = Driver.runTests(json);
            // The default driver returns a List<String> where the first element is the JSON array string?
            // No, look at line 225: out.add("No driver provided.");
            // Look at line 495 in C++: cout << json.dump()
            // In Java, we need to make sure we print the delimiter.
            // The current Java driver implementation seems to assume Driver.runTests returns a list of strings to print.
            // If the user uses the default driver, it returns a list.
            // If we inject a delimiter, we should do it in Main.
        } else {
            System.out.println("___JSON_RESULT___");
            System.out.println("[{\\"error\\":\\"Driver returned null\\"}]");
        }
    } catch (Throwable t) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        t.printStackTrace(pw);
        
        Map<String,Object> r = new LinkedHashMap<>();
        r.put("error", "Runtime Error: " + sw.toString());
        results.add(r);
        System.out.println("___JSON_RESULT___");
        System.out.println(toJson(results));
    }
  }

  static List<Map<String,Object>> parseTests(String json) {
      Object o = parseJson(json);
      if (o instanceof List) {
          List<Object> l = (List<Object>)o;
          List<Map<String,Object>> res = new ArrayList<>();
          for(Object i : l) {
              if (i instanceof Map) res.add((Map<String,Object>)i);
          }
          return res;
      }
      return new ArrayList<>();
  }

  static double asDouble(Object o) { return ((Number)o).doubleValue(); }
  static int asInt(Object o) { return ((Number)o).intValue(); }
  static long asLong(Object o) { return ((Number)o).longValue(); }

  static Object parseJson(String json) {
      json = json.trim();
      if (json.startsWith("{")) {
          JSONObject map = new JSONObject();
          if (json.equals("{}")) return map;
          String inner = json.substring(1, json.length()-1);
          List<String> parts = splitJson(inner);
          for(String part : parts) {
              int colon = part.indexOf(':');
              String key = unquote(part.substring(0, colon).trim());
              Object val = parseJson(part.substring(colon+1));
              map.put(key, val);
          }
          return map;
      } else if (json.startsWith("[")) {
          JSONArray list = new JSONArray();
          if (json.equals("[]")) return list;
          String inner = json.substring(1, json.length()-1);
          List<String> parts = splitJson(inner);
          for(String part : parts) list.add(parseJson(part));
          return list;
      } else if (json.startsWith("\\"")) {
          return unquote(json);
      } else if (json.equals("true")) return true;
      else if (json.equals("false")) return false;
      else if (json.equals("null")) return null;
      else {
          try { return Long.parseLong(json); } catch(Exception e){}
          try { return Double.parseDouble(json); } catch(Exception e){}
          return json;
      }
  }

  static List<String> splitJson(String inner) {
      List<String> res = new ArrayList<>();
      int depth = 0;
      boolean inQuote = false;
      int start = 0;
      for(int i=0; i<inner.length(); i++) {
          char c = inner.charAt(i);
          if (c == '\\"' && (i==0 || inner.charAt(i-1) != '\\\\')) inQuote = !inQuote;
          else if (!inQuote) {
              if (c == '{' || c == '[') depth++;
              else if (c == '}' || c == ']') depth--;
              else if (c == ',' && depth == 0) {
                  res.add(inner.substring(start, i).trim());
                  start = i+1;
              }
          }
      }
      res.add(inner.substring(start).trim());
      return res;
  }

  static String unquote(String s) {
      if (s.startsWith("\\"") && s.endsWith("\\"")) return s.substring(1, s.length()-1).replace("\\\\n", "\\n").replace("\\\\\\"", "\\"");
      return s;
  }

  static String toJson(List<Map<String,Object>> list){
    return listToJson(list);
  }
  static String listToJson(List<?> list){
    StringBuilder sb = new StringBuilder();
    sb.append("[");
    for (int i=0;i<list.size();i++){ if (i>0) sb.append(","); sb.append(valToJson(list.get(i))); }
    sb.append("]");
    return sb.toString();
  }
  static String objToJson(Map<String,Object> m){
    StringBuilder sb = new StringBuilder(); sb.append("{"); boolean first=true;
    for (Map.Entry<String,Object> e: m.entrySet()){ if (!first) sb.append(","); first=false; sb.append(quote(e.getKey())).append(":" ).append(valToJson(e.getValue())); }
    sb.append("}"); return sb.toString();
  }
  static String quote(String s){ return "\\""+s.replace("\\\\","\\\\\\\\").replace("\\"","\\\\\\"")+"\\"";}  
  static String valToJson(Object v){ 
      if (v==null) return "null"; 
      if (v instanceof String) return quote((String)v); 
      if (v instanceof Number || v instanceof Boolean) return String.valueOf(v); 
      if (v instanceof Map) return objToJson((Map<String,Object>)v);
      if (v instanceof List) return listToJson((List<?>)v);
      return quote(String.valueOf(v)); 
  }
}
`;
}

function buildCpp(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);
  // Default driver if none provided - assumes int solve(vector<int>) for demo purposes
  // In reality, the driver should match the problem signature.
  const drv = (driver && driver.trim().length)
    ? driver
    : `
  // Default Driver for int solve(vector<int>&)
  // Requires nlohmann/json.hpp
  void runTests(const std::string& jsonTests) {
    try {
      auto tests = nlohmann::json::parse(jsonTests);
      Solution sol;
      std::vector<std::map<std::string, nlohmann::json>> results;

      for (const auto& t : tests) {
        std::map<std::string, nlohmann::json> result;
        try {
          // Parse input - assuming single vector<int> arg for demo
          std::vector<int> input = t["input"].get<std::vector<int>>();
          auto output = sol.solve(input);

          result["got"] = output;
          result["exp"] = t["output"];
          result["pass"] = (output == t["output"].get<int>()); // Assuming int return
        } catch (const std::exception& e) {
          result["error"] = e.what();
          result["pass"] = false;
        }
        results.push_back(result);
      }
      std::cout << "___JSON_RESULT___" << std::endl;
      std::cout << nlohmann::json(results).dump() << std::endl;
    } catch (const std::exception& e) {
      std::cout << "___JSON_RESULT___" << std::endl;
      std::cout << "[{\\"error\\":\\"" << e.what() << "\\"}]" << std::endl;
    }
  }
  `;

  const lines = userCode.split('\\n');
  const includes: string[] = [];
  const code: string[] = [];

  lines.forEach(line => {
    if (line.trim().startsWith('#include')) {
      includes.push(line);
    } else {
      code.push(line);
    }
  });

  const includesStr = includes.join('\\n');
  const codeStr = code.join('\\n');

  return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <map>
#include <algorithm>
// Assuming nlohmann/json is available in the environment
#include <nlohmann/json.hpp>

using namespace std;

${includesStr}

// User Solution
${codeStr}

// Driver (must implement void runTests(string jsonTests))
${drv}

int main() {
  // Pass raw JSON string to driver's runTests
  string json = "${testStr.replace(/"/g, '\\"')}";
  try {
    runTests(json);
  } catch (...) {
    cout << "[{\\"error\\":\\"Unknown runtime error\\"}]" << endl;
  }
  return 0;
}
`;
}
