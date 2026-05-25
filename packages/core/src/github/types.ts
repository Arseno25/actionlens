export type WorkflowRunStatus = "queued" | "in_progress" | "completed";

export type WorkflowConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | null;

export interface WorkflowRun {
  id: number;
  name: string | null;
  workflowId: number;
  headBranch: string | null;
  headSha: string;
  event: string;
  status: WorkflowRunStatus;
  conclusion: WorkflowConclusion;
  runNumber: number;
  runAttempt: number;
  actor: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export type JobStatus = WorkflowRunStatus;

export interface JobStep {
  name: string;
  number: number;
  status: JobStatus;
  conclusion: WorkflowConclusion;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkflowJob {
  id: number;
  runId: number;
  name: string;
  status: JobStatus;
  conclusion: WorkflowConclusion;
  startedAt: string | null;
  completedAt: string | null;
  runnerName: string | null;
  runnerOs: string | null;
  htmlUrl: string;
  steps: JobStep[];
}

export interface WorkflowRunListFilters {
  branch?: string;
  status?: WorkflowRunStatus;
  event?: string;
  actor?: string;
  workflowName?: string;
  /** Filtered client-side (the v3 list endpoint doesn't accept SHA). */
  headSha?: string;
  /** Filtered client-side. */
  conclusion?: Exclude<WorkflowConclusion, null>;
  perPage?: number;
  page?: number;
}
