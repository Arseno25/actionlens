import type { LineSeverity } from "./types";

interface Pattern {
  id: string;
  severity: LineSeverity;
  regex: RegExp;
}

/**
 * Ordered list of patterns. First match wins, so put more-specific patterns
 * before generic ones (e.g. "warning" before "error").
 *
 * We deliberately match on word boundaries / line starts where possible to
 * keep false-positive rate low — many tools print decorative "Error:" headers
 * inside successful output.
 */
const PATTERNS: Pattern[] = [
  // Warnings first — many tools print "warning: this is not an error".
  { id: "warning-prefix", severity: "warning", regex: /^(?:\s*\[?)?warning\b/i },
  { id: "warn-prefix", severity: "warning", regex: /^(?:\s*\[?)?warn\b/i },
  { id: "deprecated", severity: "warning", regex: /\bdeprecat(?:ed|ion)\b/i },

  // Hard failures that GitHub itself emits.
  { id: "process-exit", severity: "error", regex: /process completed with exit code\s+[1-9]/i },
  { id: "github-error-prefix", severity: "error", regex: /^##\[error\]/i },

  // JS / Node tooling.
  { id: "npm-err", severity: "error", regex: /^npm\s+ERR!/ },
  { id: "pnpm-err", severity: "error", regex: /^\s*(?:ELIFECYCLE|ERR_PNPM_[A-Z0-9_]+)\b/ },
  { id: "yarn-error", severity: "error", regex: /^(?:yarn\s+)?error\s/i },

  // PHP / Laravel / PHPUnit / Pest.
  { id: "phpunit-fail", severity: "error", regex: /\bFAILURES!\b|^FAILED\b/ },
  { id: "pest-fail", severity: "error", regex: /^\s*(?:FAIL|FAILED)\s+Tests\\/ },
  { id: "laravel-exception", severity: "error", regex: /\b(?:Illuminate\\|Symfony\\Component\\).+Exception\b/ },
  { id: "composer-error", severity: "error", regex: /^\s*\[?(?:RuntimeException|ErrorException)\]?\b/ },
  { id: "sqlstate", severity: "error", regex: /\bSQLSTATE\[[A-Z0-9]+\]/ },

  // TypeScript / ESLint.
  { id: "ts-error", severity: "error", regex: /:\s*error TS\d+:/ },
  { id: "eslint-error", severity: "error", regex: /^\s*\d+:\d+\s+error\s/i },

  // Docker.
  { id: "docker-build-failed", severity: "error", regex: /^(?:ERROR:\s+)?failed to (?:build|solve)/i },
  { id: "docker-no-such-image", severity: "error", regex: /^(?:Error response from daemon|docker:)\s+/i },

  // Shell-level failures.
  { id: "permission-denied", severity: "error", regex: /\bpermission denied\b/i },
  { id: "command-not-found", severity: "error", regex: /\b(?:command not found|No such file or directory)\b/i },

  // Generic last resorts.
  { id: "traceback", severity: "error", regex: /^Traceback \(most recent call last\):/ },
  { id: "exception", severity: "error", regex: /^\s*[\w.]*Exception(?:\s*[:[]|\s+in\s)/ },
  { id: "fatal", severity: "error", regex: /^\s*fatal[:\s]/i },
  { id: "error-prefix", severity: "error", regex: /^(?:\s*\[?)?error[:\s]/i },
  { id: "failed-prefix", severity: "error", regex: /^(?:\s*\[?)?failed[:\s]/i },
];

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s/;

export function stripTimestamp(line: string): string {
  return line.replace(TIMESTAMP_RE, "");
}

export function classify(line: string): { severity: LineSeverity; matchedPattern?: string } {
  const cleaned = stripTimestamp(line);
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(cleaned)) {
      return { severity: pattern.severity, matchedPattern: pattern.id };
    }
  }
  return { severity: "info" };
}
