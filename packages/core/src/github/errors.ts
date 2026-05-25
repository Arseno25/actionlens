export type GitHubErrorKind =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "LOG_EXPIRED"
  | "LOG_NOT_READY"
  | "TRANSIENT"
  | "NETWORK"
  | "UNKNOWN";

/**
 * Domain error for everything that touches the GitHub API.
 *
 * The IDE adapters look at `kind` (not `status`) to decide what to show the
 * user, so we never leak HTTP status codes into UI strings.
 */
export class GitHubApiError extends Error {
  readonly kind: GitHubErrorKind;
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: GitHubErrorKind,
    message: string,
    options: { status?: number; retryAfterSeconds?: number | null; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.kind = kind;
    this.status = options.status ?? 0;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    if (options.cause) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function userFacingMessage(error: GitHubApiError): string {
  switch (error.kind) {
    case "UNAUTHENTICATED":
      return "GitHub token is missing or invalid. Configure a token to view Actions for this repository.";
    case "FORBIDDEN":
      return "Your GitHub token is missing the required permissions (Actions: Read for this repository).";
    case "NOT_FOUND":
      return "Repository, run, or job was not found. Check the remote URL or your token's access.";
    case "RATE_LIMITED": {
      const wait = error.retryAfterSeconds;
      return wait
        ? `GitHub API rate limit hit. Retry in ${wait}s.`
        : "GitHub API rate limit hit. Wait a few minutes before retrying.";
    }
    case "LOG_EXPIRED":
      return "The log download link has expired. Refresh and try again.";
    case "LOG_NOT_READY":
      return "Logs are not available yet for this job.";
    case "TRANSIENT":
      return "Temporary GitHub API error. Please try again.";
    case "NETWORK":
      return "Network error while contacting GitHub.";
    case "UNKNOWN":
    default:
      return "An unexpected error occurred while contacting GitHub.";
  }
}
