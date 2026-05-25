import { describe, expect, it, vi } from "vitest";
import { GitHubClient } from "../src/github/githubClient";
import { GitHubApiError } from "../src/github/errors";
import { createGitHubActionsApi } from "../src/github/githubActionsApi";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("GitHubClient error mapping", () => {
  it("maps 401 → UNAUTHENTICATED", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    const client = new GitHubClient({ getToken: () => "x", fetchImpl, maxTransientRetries: 0 });
    await expect(client.getJson("/foo")).rejects.toMatchObject({ kind: "UNAUTHENTICATED" });
  });

  it("maps 403 with remaining=0 → RATE_LIMITED", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } }),
    ) as unknown as typeof fetch;
    const client = new GitHubClient({ getToken: () => "x", fetchImpl, maxTransientRetries: 0 });
    await expect(client.getJson("/foo")).rejects.toMatchObject({ kind: "RATE_LIMITED" });
  });

  it("maps plain 403 → FORBIDDEN", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    const client = new GitHubClient({ getToken: () => "x", fetchImpl, maxTransientRetries: 0 });
    await expect(client.getJson("/foo")).rejects.toMatchObject({ kind: "FORBIDDEN" });
  });

  it("maps 404 → NOT_FOUND", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    const client = new GitHubClient({ getToken: () => "x", fetchImpl, maxTransientRetries: 0 });
    await expect(client.getJson("/foo")).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });

  it("retries 5xx then surfaces the error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("oops", { status: 500 }));
    const client = new GitHubClient({ getToken: () => "x", fetchImpl, maxTransientRetries: 2 });
    await expect(client.getJson("/foo")).rejects.toBeInstanceOf(GitHubApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("never sends Authorization to the signed log URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/actions/jobs/123/logs")) {
        return new Response(null, { status: 302, headers: { location: "https://signed.example/log" } });
      }
      // The signed fetch — assert no auth header.
      const headers = new Headers(init?.headers ?? {});
      expect(headers.get("authorization")).toBeNull();
      return new Response("log body", { status: 200 });
    });

    const client = new GitHubClient({ getToken: () => "secret", fetchImpl, maxTransientRetries: 0 });
    const text = await client.fetchRedirectedText("/repos/foo/bar/actions/jobs/123/logs");
    expect(text).toBe("log body");
  });

  it("raises LOG_EXPIRED when the signed URL returns 410", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/actions/jobs/123/logs")) {
        return new Response(null, { status: 302, headers: { location: "https://signed.example/log" } });
      }
      return new Response("gone", { status: 410 });
    });
    const client = new GitHubClient({ getToken: () => "x", fetchImpl, maxTransientRetries: 0 });
    await expect(client.fetchRedirectedText("/repos/foo/bar/actions/jobs/123/logs"))
      .rejects.toMatchObject({ kind: "LOG_EXPIRED" });
  });
});

describe("GitHubActionsApi", () => {
  it("filters runs by workflowName / headSha / conclusion client-side", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        total_count: 3,
        workflow_runs: [
          rawRun({ id: 1, name: "CI", head_sha: "abc", conclusion: "failure" }),
          rawRun({ id: 2, name: "Deploy", head_sha: "abc", conclusion: "success" }),
          rawRun({ id: 3, name: "CI", head_sha: "def", conclusion: "failure" }),
        ],
      }),
    );
    const client = new GitHubClient({ getToken: () => null, fetchImpl, maxTransientRetries: 0 });
    const api = createGitHubActionsApi(client);
    const runs = await api.getWorkflowRuns("foo", "bar", {
      workflowName: "CI",
      headSha: "abc",
      conclusion: "failure",
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe(1);
  });
});

function rawRun(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    name: "CI",
    workflow_id: 99,
    head_branch: "main",
    head_sha: "abc",
    event: "push",
    status: "completed",
    conclusion: "success",
    run_number: 1,
    run_attempt: 1,
    actor: { login: "octocat" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:01:00Z",
    html_url: "https://github.com/foo/bar/actions/runs/1",
    ...overrides,
  };
}
