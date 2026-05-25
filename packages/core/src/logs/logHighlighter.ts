import type { ClassifiedLine, ParsedLog } from "./types";

export interface LineRange {
  start: number; // 1-based inclusive
  end: number;   // 1-based inclusive
  severity: ClassifiedLine["severity"];
}

/**
 * Collapse consecutive same-severity lines into ranges. IDE adapters consume
 * these ranges to paint decorations without having to iterate per-line.
 */
export function buildLineRanges(parsed: ParsedLog, severities: ClassifiedLine["severity"][] = ["error", "warning"]): LineRange[] {
  const filter = new Set(severities);
  const ranges: LineRange[] = [];
  let current: LineRange | null = null;

  for (const line of parsed.lines) {
    if (!filter.has(line.severity)) {
      if (current) {
        ranges.push(current);
        current = null;
      }
      continue;
    }
    if (current && current.severity === line.severity && current.end + 1 === line.number) {
      current.end = line.number;
    } else {
      if (current) ranges.push(current);
      current = { start: line.number, end: line.number, severity: line.severity };
    }
  }
  if (current) ranges.push(current);
  return ranges;
}

const TOKEN_PATTERNS: { id: string; regex: RegExp; replacement: string }[] = [
  { id: "github-pat", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, replacement: "[REDACTED:GITHUB_TOKEN]" },
  { id: "github-fine-grained", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}/g, replacement: "[REDACTED:GITHUB_TOKEN]" },
  { id: "bearer", regex: /(authorization:\s*bearer\s+)[A-Za-z0-9._\-+/=]+/gi, replacement: "$1[REDACTED]" },
  { id: "aws-key", regex: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED:AWS_KEY]" },
  { id: "generic-secret", regex: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9._\-+/=]{8,}['"]?/gi, replacement: "$1=[REDACTED]" },
  { id: "private-key", regex: /-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, replacement: "[REDACTED:PRIVATE_KEY]" },
];

/**
 * Best-effort masking of secrets before a log snippet is exported (e.g. to the
 * clipboard for an AI prompt). Not a substitute for human review.
 */
export function sanitiseLogText(text: string): string {
  let out = text;
  for (const p of TOKEN_PATTERNS) out = out.replace(p.regex, p.replacement);
  return out;
}
