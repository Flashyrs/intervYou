const JUDGE0_URL = process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_KEY = process.env.JUDGE0_KEY;

export async function submitToJudge0(body: any) {
  const url = `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`;
  const headers: any = {
    "Content-Type": "application/json",
  };
  if (JUDGE0_KEY) {
    headers["X-RapidAPI-Key"] = JUDGE0_KEY;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    // do not cache, server only
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Judge0 error ${res.status}: ${t}`);
  }
  return res.json();
}
