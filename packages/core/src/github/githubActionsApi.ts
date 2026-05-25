import type { GitHubClient } from "./githubClient";
import type {
  JobStep,
  WorkflowJob,
  WorkflowRun,
  WorkflowRunListFilters,
} from "./types";

interface RawRun {
  id: number;
  name: string | null;
  workflow_id: number;
  head_branch: string | null;
  head_sha: string;
  event: string;
  status: string;
  conclusion: string | null;
  run_number: number;
  run_attempt: number;
  actor?: { login?: string } | null;
  triggering_actor?: { login?: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface RawRunsResponse {
  total_count: number;
  workflow_runs: RawRun[];
}

interface RawStep {
  name: string;
  number: number;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface RawJob {
  id: number;
  run_id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  runner_name?: string | null;
  runner_group_name?: string | null;
  runner_os?: string | null;
  html_url: string;
  steps?: RawStep[];
}

interface RawJobsResponse {
  total_count: number;
  jobs: RawJob[];
}

export interface GitHubActionsApi {
  getWorkflowRuns(owner: string, repo: string, filters?: WorkflowRunListFilters): Promise<WorkflowRun[]>;
  getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun>;
  getJobsForRun(owner: string, repo: string, runId: number): Promise<WorkflowJob[]>;
  getJob(owner: string, repo: string, jobId: number): Promise<WorkflowJob>;
  downloadJobLog(owner: string, repo: string, jobId: number): Promise<string>;
  downloadRunLogs(owner: string, repo: string, runId: number): Promise<string>;
  /** Reserved for a post-MVP command; not wired into any adapter today. */
  rerunFailedJobs(owner: string, repo: string, runId: number): Promise<void>;
}

export function createGitHubActionsApi(client: GitHubClient): GitHubActionsApi {
  return {
    async getWorkflowRuns(owner, repo, filters = {}): Promise<WorkflowRun[]> {
      const params = new URLSearchParams();
      if (filters.branch) params.set("branch", filters.branch);
      if (filters.status) params.set("status", filters.status);
      if (filters.event) params.set("event", filters.event);
      if (filters.actor) params.set("actor", filters.actor);
      params.set("per_page", String(filters.perPage ?? 25));
      if (filters.page) params.set("page", String(filters.page));

      const qs = params.toString();
      const path = `/repos/${enc(owner)}/${enc(repo)}/actions/runs${qs ? `?${qs}` : ""}`;
      const res = await client.getJson<RawRunsResponse>(path);
      let runs = (res.data.workflow_runs ?? []).map(mapRun);

      if (filters.workflowName) {
        const wanted = filters.workflowName.toLowerCase();
        runs = runs.filter((r) => (r.name ?? "").toLowerCase() === wanted);
      }
      if (filters.headSha) {
        runs = runs.filter((r) => r.headSha === filters.headSha);
      }
      if (filters.conclusion) {
        runs = runs.filter((r) => r.conclusion === filters.conclusion);
      }
      return runs;
    },

    async getWorkflowRun(owner, repo, runId): Promise<WorkflowRun> {
      const res = await client.getJson<RawRun>(`/repos/${enc(owner)}/${enc(repo)}/actions/runs/${runId}`);
      return mapRun(res.data);
    },

    async getJobsForRun(owner, repo, runId): Promise<WorkflowJob[]> {
      const res = await client.getJson<RawJobsResponse>(
        `/repos/${enc(owner)}/${enc(repo)}/actions/runs/${runId}/jobs?per_page=100`,
      );
      return (res.data.jobs ?? []).map(mapJob);
    },

    async getJob(owner, repo, jobId): Promise<WorkflowJob> {
      const res = await client.getJson<RawJob>(`/repos/${enc(owner)}/${enc(repo)}/actions/jobs/${jobId}`);
      return mapJob(res.data);
    },

    downloadJobLog(owner, repo, jobId): Promise<string> {
      return client.fetchRedirectedText(`/repos/${enc(owner)}/${enc(repo)}/actions/jobs/${jobId}/logs`);
    },

    downloadRunLogs(owner, repo, runId): Promise<string> {
      return client.fetchRedirectedText(`/repos/${enc(owner)}/${enc(repo)}/actions/runs/${runId}/logs`);
    },

    async rerunFailedJobs(owner, repo, runId): Promise<void> {
      // Implementation left for the post-MVP feature; using fetchRedirectedText
      // here would be wrong (POST). Adapters should not call this yet.
      throw new Error(
        `rerunFailedJobs(${owner}/${repo}, runId=${runId}) is not enabled in the MVP. See docs/ROADMAP.md.`,
      );
    },
  };
}

function mapRun(raw: RawRun): WorkflowRun {
  return {
    id: raw.id,
    name: raw.name,
    workflowId: raw.workflow_id,
    headBranch: raw.head_branch,
    headSha: raw.head_sha,
    event: raw.event,
    status: normaliseStatus(raw.status),
    conclusion: normaliseConclusion(raw.conclusion),
    runNumber: raw.run_number,
    runAttempt: raw.run_attempt,
    actor: raw.actor?.login ?? raw.triggering_actor?.login ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    htmlUrl: raw.html_url,
  };
}

function mapJob(raw: RawJob): WorkflowJob {
  return {
    id: raw.id,
    runId: raw.run_id,
    name: raw.name,
    status: normaliseStatus(raw.status),
    conclusion: normaliseConclusion(raw.conclusion),
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    runnerName: raw.runner_name ?? raw.runner_group_name ?? null,
    runnerOs: raw.runner_os ?? null,
    htmlUrl: raw.html_url,
    steps: (raw.steps ?? []).map(mapStep),
  };
}

function mapStep(raw: RawStep): JobStep {
  return {
    name: raw.name,
    number: raw.number,
    status: normaliseStatus(raw.status),
    conclusion: normaliseConclusion(raw.conclusion),
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
  };
}

function normaliseStatus(value: string): WorkflowJob["status"] {
  if (value === "queued" || value === "in_progress" || value === "completed") return value;
  // "waiting", "pending", "requested" → treat as queued for UI purposes.
  if (value === "waiting" || value === "pending" || value === "requested") return "queued";
  return "completed";
}

function normaliseConclusion(value: string | null): WorkflowJob["conclusion"] {
  if (value === null) return null;
  switch (value) {
    case "success":
    case "failure":
    case "cancelled":
    case "skipped":
    case "timed_out":
    case "action_required":
    case "neutral":
      return value;
    default:
      return null;
  }
}

function enc(part: string): string {
  return encodeURIComponent(part);
}
