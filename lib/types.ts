export type Role = "interviewer" | "interviewee";

export type TestCaseType = "sample" | "edge" | "hidden";

export interface TestCase {
    input: any[];
    output: any;
}

export interface TestCaseResult {
    pass: boolean;
    error?: string;
    got?: any;
    exp?: any;
    [key: string]: any;
}

export interface ExecutionMetrics {
    time?: number; // milliseconds
    memory?: number; // kilobytes
}
