import { sanitiseLogText } from "../logs/logHighlighter";
import type { ParsedLog } from "../logs/types";

export interface AiDebugPromptInput {
  repository: string;       // e.g. "owner/repo"
  branch?: string | null;
  commitSha?: string | null;
  workflowName?: string | null;
  jobName?: string;
  failedStepName?: string | null;
  parsedLog?: ParsedLog;
  /** Raw snippet to use when parsedLog isn't available. */
  snippet?: string;
  /** Optional stack trace excerpt the IDE adapter has already isolated. */
  stack?: string;
}

const INSTRUCTION =
  "Analyze this GitHub Actions failure. Identify the root cause, explain why it happened, and suggest the minimal safe fix. Focus on the relevant log lines and avoid guessing.";

/**
 * Build a clipboard-ready prompt that summarises the failure for an AI tool.
 * All log content is run through {@link sanitiseLogText} to mask common secrets.
 */
export function createAiDebugPrompt(input: AiDebugPromptInput): string {
  const lines: string[] = [];
  lines.push(INSTRUCTION);
  lines.push("");
  lines.push("Context:");
  lines.push(`- Repository: ${input.repository}`);
  if (input.branch) lines.push(`- Branch: ${input.branch}`);
  if (input.commitSha) lines.push(`- Commit: ${input.commitSha}`);
  if (input.workflowName) lines.push(`- Workflow: ${input.workflowName}`);
  if (input.jobName) lines.push(`- Job: ${input.jobName}`);
  if (input.failedStepName) lines.push(`- Failed step: ${input.failedStepName}`);

  const snippet = chooseSnippet(input);
  if (snippet) {
    lines.push("");
    lines.push("Relevant log lines:");
    lines.push("```");
    lines.push(sanitiseLogText(snippet).trimEnd());
    lines.push("```");
  }

  if (input.stack) {
    lines.push("");
    lines.push("Stack:");
    lines.push("```");
    lines.push(sanitiseLogText(input.stack).trimEnd());
    lines.push("```");
  }

  if (input.parsedLog) {
    lines.push("");
    lines.push(`Summary: ${input.parsedLog.summary}`);
  }

  return lines.join("\n");
}

function chooseSnippet(input: AiDebugPromptInput): string | null {
  if (input.parsedLog && input.parsedLog.errorBlocks.length > 0) {
    return input.parsedLog.errorBlocks[0]!.preview;
  }
  if (input.snippet && input.snippet.trim().length > 0) return input.snippet;
  return null;
}
