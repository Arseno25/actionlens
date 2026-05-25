export type LineSeverity = "error" | "warning" | "info";

export interface ClassifiedLine {
  number: number;          // 1-based
  text: string;            // line content with timestamp prefix stripped
  raw: string;             // original line as received
  severity: LineSeverity;
  /** Identifier of the matched pattern, useful for tests/debugging. */
  matchedPattern?: string;
}

export interface ErrorBlock {
  /** 1-based line numbers in the block (contiguous, including context lines). */
  lineNumbers: number[];
  startLine: number;
  endLine: number;
  preview: string;
}

export interface ParsedLog {
  lines: ClassifiedLine[];
  errorLineNumbers: number[];
  warningLineNumbers: number[];
  errorBlocks: ErrorBlock[];
  firstErrorLine: number | null;
  summary: string;
}
