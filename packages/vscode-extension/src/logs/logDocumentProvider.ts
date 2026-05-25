import * as vscode from "vscode";
import {
  GitHubApiError,
  LogParser,
  TtlCache,
  type GitHubActionsApi,
  type ParsedLog,
  userFacingMessage,
} from "@actionlens/core";

export const LOG_SCHEME = "actionlens-log";

interface LogKey {
  owner: string;
  repo: string;
  jobId: number;
}

/**
 * Encode/decode helpers for the actionlens-log: URI:
 *   actionlens-log://<owner>/<repo>/<jobId>?display=<safe name>
 */
export function buildLogUri(key: LogKey, displayName: string): vscode.Uri {
  return vscode.Uri.parse(
    `${LOG_SCHEME}://${encodeURIComponent(key.owner)}/${encodeURIComponent(key.repo)}/${key.jobId}?display=${encodeURIComponent(displayName)}`,
  );
}

export function parseLogUri(uri: vscode.Uri): LogKey | null {
  if (uri.scheme !== LOG_SCHEME) return null;
  const segments = uri.path.split("/").filter(Boolean);
  if (segments.length !== 2) return null;
  const jobId = Number(segments[1]);
  if (!Number.isFinite(jobId)) return null;
  return {
    owner: decodeURIComponent(uri.authority),
    repo: decodeURIComponent(segments[0]!),
    jobId,
  };
}

export class LogDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;

  private readonly parser: LogParser;
  private readonly cache = new TtlCache<number, { raw: string; parsed: ParsedLog }>(60_000);

  constructor(
    private readonly getApi: () => GitHubActionsApi | null,
    private readonly getMaxLines: () => number,
    private readonly output: vscode.OutputChannel,
  ) {
    this.parser = new LogParser({ maxLines: this.getMaxLines() });
  }

  invalidate(uri: vscode.Uri): void {
    const key = parseLogUri(uri);
    if (key) this.cache.delete(key.jobId);
    this.emitter.fire(uri);
  }

  getParsed(jobId: number): ParsedLog | null {
    return this.cache.get(jobId)?.parsed ?? null;
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const key = parseLogUri(uri);
    if (!key) return "Invalid ActionLens log URI.";
    const api = this.getApi();
    if (!api) return "GitHub authentication required to download logs.";

    const cached = this.cache.get(key.jobId);
    if (cached) return cached.raw;

    try {
      const raw = await api.downloadJobLog(key.owner, key.repo, key.jobId);
      const parser = new LogParser({ maxLines: this.getMaxLines() });
      const parsed = parser.parse(raw);
      this.cache.set(key.jobId, { raw, parsed });
      this.output.appendLine(
        `[log] ${key.owner}/${key.repo} job=${key.jobId} → ${parsed.summary}`,
      );
      return raw;
    } catch (e) {
      if (e instanceof GitHubApiError) {
        this.output.appendLine(`[error:${e.kind}] downloadJobLog ${key.jobId}`);
        return `// ActionLens: ${userFacingMessage(e)}`;
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.output.appendLine(`[error] downloadJobLog ${key.jobId}: ${msg}`);
      return `// ActionLens: ${msg}`;
    }
  }
}
