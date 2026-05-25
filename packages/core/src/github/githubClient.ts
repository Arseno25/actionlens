import { GitHubApiError, type GitHubErrorKind } from "./errors";

export interface GitHubClientOptions {
  /** Defaults to https://api.github.com — override for GitHub Enterprise. */
  baseUrl?: string;
  /** Returns the current token (or null). Called per-request so token rotation works. */
  getToken: () => string | null | Promise<string | null>;
  /** Custom fetch (e.g. for tests). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** User-Agent string. GitHub requires a UA header. */
  userAgent?: string;
  /** API version, sent as `X-GitHub-Api-Version`. */
  apiVersion?: string;
  /** Default retry count for transient (5xx, network) failures. */
  maxTransientRetries?: number;
}

export interface GitHubResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface RawResponse {
  status: number;
  body: string;
  headers: Headers;
}

/** Low-level GitHub HTTP client. */
export class GitHubClient {
  private readonly baseUrl: string;
  private readonly getToken: GitHubClientOptions["getToken"];
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly apiVersion: string;
  private readonly maxTransientRetries: number;

  constructor(opts: GitHubClientOptions) {
    this.baseUrl = (opts.baseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.getToken = opts.getToken;
    const f = opts.fetchImpl ?? globalThis.fetch;
    if (!f) {
      throw new Error("No fetch implementation available. Provide fetchImpl or run on Node ≥18.");
    }
    this.fetchImpl = f.bind(globalThis);
    this.userAgent = opts.userAgent ?? "ActionLens";
    this.apiVersion = opts.apiVersion ?? "2022-11-28";
    this.maxTransientRetries = opts.maxTransientRetries ?? 2;
  }

  async getJson<T>(pathAndQuery: string): Promise<GitHubResponse<T>> {
    const res = await this.requestWithRetry(pathAndQuery, { method: "GET" });
    if (res.status === 204) return { data: undefined as unknown as T, status: 204, headers: res.headers };
    try {
      const data = JSON.parse(res.body) as T;
      return { data, status: res.status, headers: res.headers };
    } catch (cause) {
      throw new GitHubApiError("UNKNOWN", "Failed to parse GitHub response as JSON.", {
        status: res.status,
        cause,
      });
    }
  }

  /**
   * Follow GitHub's log redirect once, then download the signed URL with
   * no Authorization header. The redirect URL is never returned to callers.
   */
  async fetchRedirectedText(pathAndQuery: string): Promise<string> {
    const url = this.absoluteUrl(pathAndQuery);
    const headers = await this.baseHeaders();

    let response: Response;
    try {
      response = await this.fetchImpl(url, { method: "GET", headers, redirect: "manual" });
    } catch (cause) {
      throw new GitHubApiError("NETWORK", "Network error while requesting GitHub log redirect.", { cause });
    }

    if (response.status === 302 || response.status === 301 || response.status === 307) {
      const location = response.headers.get("location");
      if (!location) {
        throw new GitHubApiError("UNKNOWN", "GitHub returned a redirect without a Location header.", {
          status: response.status,
        });
      }
      let signed: Response;
      try {
        signed = await this.fetchImpl(location, { method: "GET" });
      } catch (cause) {
        throw new GitHubApiError("NETWORK", "Network error while fetching signed log URL.", { cause });
      }
      if (signed.status === 410 || signed.status === 403) {
        throw new GitHubApiError("LOG_EXPIRED", "Signed log URL expired.", { status: signed.status });
      }
      if (signed.status === 404) {
        throw new GitHubApiError("LOG_NOT_READY", "Log not available yet.", { status: signed.status });
      }
      if (!signed.ok) {
        throw new GitHubApiError("UNKNOWN", "Failed to download signed log URL.", { status: signed.status });
      }
      return await signed.text();
    }

    if (response.status === 404) {
      throw new GitHubApiError("LOG_NOT_READY", "Log not available yet.", { status: 404 });
    }

    // Some GitHub clients (and our test stub) may auto-follow and return text.
    if (response.ok) return await response.text();

    throw toErrorFromResponse(response.status, response.headers);
  }

  private async requestWithRetry(pathAndQuery: string, init: RequestInit): Promise<RawResponse> {
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.maxTransientRetries) {
      try {
        return await this.requestOnce(pathAndQuery, init);
      } catch (e) {
        lastError = e;
        if (e instanceof GitHubApiError && (e.kind === "TRANSIENT" || e.kind === "NETWORK")) {
          attempt += 1;
          if (attempt <= this.maxTransientRetries) {
            await delay(200 * Math.pow(2, attempt));
            continue;
          }
        }
        throw e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Unknown transient failure");
  }

  private async requestOnce(pathAndQuery: string, init: RequestInit): Promise<RawResponse> {
    const headers = await this.baseHeaders();
    let response: Response;
    try {
      response = await this.fetchImpl(this.absoluteUrl(pathAndQuery), { ...init, headers });
    } catch (cause) {
      throw new GitHubApiError("NETWORK", "Network error while contacting GitHub.", { cause });
    }

    if (!response.ok) {
      throw toErrorFromResponse(response.status, response.headers);
    }
    const body = await response.text();
    return { status: response.status, body, headers: response.headers };
  }

  private absoluteUrl(pathAndQuery: string): string {
    if (/^https?:\/\//i.test(pathAndQuery)) return pathAndQuery;
    return `${this.baseUrl}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  }

  private async baseHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": this.apiVersion,
      "User-Agent": this.userAgent,
    };
    const token = await this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }
}

function toErrorFromResponse(status: number, headers: Headers): GitHubApiError {
  const kind = classify(status, headers);
  const retryAfter = headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) || null : null;
  return new GitHubApiError(kind, `GitHub API responded with ${status}.`, { status, retryAfterSeconds });
}

function classify(status: number, headers: Headers): GitHubErrorKind {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) {
    // 403 + remaining=0 is a rate limit, not a permissions issue.
    if (headers.get("x-ratelimit-remaining") === "0") return "RATE_LIMITED";
    return "FORBIDDEN";
  }
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500 && status < 600) return "TRANSIENT";
  return "UNKNOWN";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
