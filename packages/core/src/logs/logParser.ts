import { classify, stripTimestamp } from "./errorDetector";
import type { ClassifiedLine, ErrorBlock, ParsedLog } from "./types";

export interface ParseOptions {
  /** Truncate the log past this many lines (kept from the *end*). */
  maxLines?: number;
  /** Lines of context to include on either side of an error block. */
  contextLines?: number;
}

export class LogParser {
  private readonly maxLines: number;
  private readonly contextLines: number;

  constructor(opts: ParseOptions = {}) {
    this.maxLines = opts.maxLines ?? 5000;
    this.contextLines = opts.contextLines ?? 3;
  }

  parse(raw: string): ParsedLog {
    const allLines = raw.split(/\r?\n/);
    const truncated = allLines.length > this.maxLines
      ? allLines.slice(allLines.length - this.maxLines)
      : allLines;

    const lines: ClassifiedLine[] = truncated.map((rawLine, idx) => {
      const { severity, matchedPattern } = classify(rawLine);
      const line: ClassifiedLine = {
        number: idx + 1,
        text: stripTimestamp(rawLine),
        raw: rawLine,
        severity,
      };
      if (matchedPattern !== undefined) line.matchedPattern = matchedPattern;
      return line;
    });

    const errorLineNumbers = lines.filter((l) => l.severity === "error").map((l) => l.number);
    const warningLineNumbers = lines.filter((l) => l.severity === "warning").map((l) => l.number);

    const errorBlocks = groupBlocks(errorLineNumbers, lines, this.contextLines);
    const firstErrorLine = errorLineNumbers[0] ?? null;
    const summary = buildSummary({ totalLines: lines.length, errors: errorLineNumbers.length, warnings: warningLineNumbers.length });

    return { lines, errorLineNumbers, warningLineNumbers, errorBlocks, firstErrorLine, summary };
  }
}

function groupBlocks(errorLines: number[], lines: ClassifiedLine[], contextLines: number): ErrorBlock[] {
  if (errorLines.length === 0) return [];
  const blocks: ErrorBlock[] = [];
  let current: number[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    const start = Math.max(1, current[0]! - contextLines);
    const end = Math.min(lines.length, current[current.length - 1]! + contextLines);
    const lineNumbers: number[] = [];
    for (let n = start; n <= end; n++) lineNumbers.push(n);
    const preview = lineNumbers
      .map((n) => lines[n - 1]?.text ?? "")
      .join("\n");
    blocks.push({ lineNumbers, startLine: start, endLine: end, preview });
    current = [];
  };

  for (const lineNo of errorLines) {
    if (current.length === 0 || lineNo - current[current.length - 1]! <= contextLines + 1) {
      current.push(lineNo);
    } else {
      flush();
      current.push(lineNo);
    }
  }
  flush();
  return blocks;
}

function buildSummary(input: { totalLines: number; errors: number; warnings: number }): string {
  if (input.errors === 0 && input.warnings === 0) return `${input.totalLines} lines, no errors detected.`;
  const parts: string[] = [`${input.totalLines} lines`];
  if (input.errors > 0) parts.push(`${input.errors} error${input.errors === 1 ? "" : "s"}`);
  if (input.warnings > 0) parts.push(`${input.warnings} warning${input.warnings === 1 ? "" : "s"}`);
  return parts.join(", ") + ".";
}

/** Convenience: extract the first error block as plain text for "Copy Error Snippet". */
export function extractErrorSnippet(parsed: ParsedLog): string {
  const first = parsed.errorBlocks[0];
  if (!first) return parsed.summary;
  return first.preview;
}
