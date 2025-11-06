import { submitToJudge0 } from "@/lib/judge0";

export async function executeCode(payload: {
  language_id: number;
  source_code: string;
  stdin?: string;
}) {
  return submitToJudge0(payload);
}
