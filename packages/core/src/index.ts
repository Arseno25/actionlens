export * from "./github/types";
export * from "./github/errors";
export { GitHubClient } from "./github/githubClient";
export type { GitHubClientOptions, GitHubResponse } from "./github/githubClient";
export { createGitHubActionsApi } from "./github/githubActionsApi";
export type { GitHubActionsApi } from "./github/githubActionsApi";

export * from "./git/types";
export { parseGitHubRemote, isGitHubDotCom } from "./git/remoteParser";
export { detectRepoContext, findGitRoot, readOriginUrl, readHead } from "./git/repoDetector";

export * from "./logs/types";
export { LogParser, extractErrorSnippet } from "./logs/logParser";
export { classify, stripTimestamp } from "./logs/errorDetector";
export { buildLineRanges, sanitiseLogText } from "./logs/logHighlighter";
export type { LineRange } from "./logs/logHighlighter";

export { TtlCache } from "./cache/ttlCache";

export { noopLogger, consoleLogger } from "./utils/logger";
export type { Logger, LogLevel } from "./utils/logger";
export { formatRelative, formatDuration } from "./utils/date";
export { ok, err, unwrap } from "./utils/result";
export type { Result, Ok, Err } from "./utils/result";

export { createAiDebugPrompt } from "./ai/debugPrompt";
export type { AiDebugPromptInput } from "./ai/debugPrompt";
