import * as vscode from "vscode";
import {
  TtlCache,
  type GitHubActionsApi,
  type RepoContext,
  type WorkflowJob,
  type WorkflowRun,
  type WorkflowRunListFilters,
} from "@actionlens/core";
import { GitHubApiError, userFacingMessage } from "@actionlens/core";
import {
  type ActionLensNode,
  JobNode,
  MessageNode,
  RepoNode,
  RunNode,
  StepNode,
} from "./treeItems";
import type { ActionLensSettings } from "../config/settings";

export class ActionsTreeProvider implements vscode.TreeDataProvider<ActionLensNode> {
  private readonly emitter = new vscode.EventEmitter<ActionLensNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private readonly jobsCache = new TtlCache<number, WorkflowJob[]>(15_000);

  constructor(
    private readonly getRepo: () => RepoContext | null,
    private readonly getApi: () => GitHubActionsApi | null,
    private readonly getSettings: () => ActionLensSettings,
    private readonly getIsSignedIn: () => boolean,
    private readonly output: vscode.OutputChannel,
  ) {}

  refresh(): void {
    this.jobsCache.clear();
    this.emitter.fire();
  }

  getTreeItem(element: ActionLensNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ActionLensNode): Promise<ActionLensNode[]> {
    const repo = this.getRepo();
    if (!repo) return [];
    if (!this.getIsSignedIn()) return [];
    if (!element) {
      return [new RepoNode(repo)];
    }
    if (element instanceof RepoNode) return this.loadRuns(repo);
    if (element instanceof RunNode) return this.loadJobs(repo, element.run);
    if (element instanceof JobNode) {
      return element.job.steps.map((s) => new StepNode(repo, element.run, element.job, s));
    }
    return [];
  }

  private async loadRuns(repo: RepoContext): Promise<ActionLensNode[]> {
    const api = this.getApi();
    if (!api) return [new MessageNode("GitHub authentication required to access this repository's Actions.", "key")];

    const settings = this.getSettings();
    const filters: WorkflowRunListFilters = { perPage: settings.maxRuns };
    if (settings.defaultBranchOnly && repo.branch) filters.branch = repo.branch;
    if (settings.matchCurrentCommit && repo.commitSha) filters.headSha = repo.commitSha;

    try {
      const runs = await api.getWorkflowRuns(repo.remote.owner, repo.remote.repo, filters);
      if (runs.length === 0) return [new MessageNode("No workflow runs found for the current filters.")];
      return prioritiseFailed(runs).map((run) => new RunNode(repo, run));
    } catch (e) {
      return [this.errorNode(e)];
    }
  }

  private async loadJobs(repo: RepoContext, run: WorkflowRun): Promise<ActionLensNode[]> {
    const api = this.getApi();
    if (!api) return [new MessageNode("GitHub authentication required.", "key")];
    try {
      let jobs = this.jobsCache.get(run.id);
      if (!jobs) {
        jobs = await api.getJobsForRun(repo.remote.owner, repo.remote.repo, run.id);
        this.jobsCache.set(run.id, jobs);
      }
      if (jobs.length === 0) return [new MessageNode("Workflow run has no jobs yet.", "clock")];
      return prioritiseFailedJobs(jobs).map((job) => new JobNode(repo, run, job));
    } catch (e) {
      return [this.errorNode(e)];
    }
  }

  private errorNode(e: unknown): MessageNode {
    if (e instanceof GitHubApiError) {
      this.output.appendLine(`[error:${e.kind}] ${e.message}`);
      return new MessageNode(userFacingMessage(e), "error");
    }
    const msg = e instanceof Error ? e.message : String(e);
    this.output.appendLine(`[error] ${msg}`);
    return new MessageNode(msg, "error");
  }
}

function prioritiseFailed(runs: WorkflowRun[]): WorkflowRun[] {
  return [...runs].sort((a, b) => {
    const aFailed = a.conclusion === "failure" ? 0 : 1;
    const bFailed = b.conclusion === "failure" ? 0 : 1;
    if (aFailed !== bFailed) return aFailed - bFailed;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function prioritiseFailedJobs(jobs: WorkflowJob[]): WorkflowJob[] {
  return [...jobs].sort((a, b) => {
    const aFailed = a.conclusion === "failure" ? 0 : 1;
    const bFailed = b.conclusion === "failure" ? 0 : 1;
    return aFailed - bFailed;
  });
}
