export type Role = "interviewer" | "interviewee";

export interface TestCaseResult {
    pass: boolean;
    error?: string;
    got?: any;
    exp?: any;
    [key: string]: any;
}
