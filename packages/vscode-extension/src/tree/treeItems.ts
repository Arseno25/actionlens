import * as vscode from "vscode";
import type { JobStep, RepoContext, WorkflowJob, WorkflowRun } from "@actionlens/core";
import { formatDuration, formatRelative } from "@actionlens/core";

export type ActionLensNode = RepoNode | RunNode | JobNode | StepNode | MessageNode;

export class RepoNode extends vscode.TreeItem {
  readonly kind = "repo" as const;
  constructor(public readonly repo: RepoContext) {
    super(`${repo.remote.owner}/${repo.remote.repo}`, vscode.TreeItemCollapsibleState.Expanded);
    const branch = repo.branch ? `branch ${repo.branch}` : "detached HEAD";
    this.description = branch;
    this.tooltip = `${repo.remote.host} • ${branch}${repo.commitSha ? ` • ${repo.commitSha.slice(0, 7)}` : ""}`;
    this.contextValue = "actionlens.repo";
    this.iconPath = new vscode.ThemeIcon("repo");
  }
}

export class RunNode extends vscode.TreeItem {
  readonly kind = "run" as const;
  constructor(public readonly repo: RepoContext, public readonly run: WorkflowRun) {
    super(run.name ?? `Run #${run.runNumber}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `#${run.runNumber} • ${run.event} • ${formatRelative(run.updatedAt)}`;
    this.tooltip = buildRunTooltip(run);
    this.contextValue = "actionlens.run";
    this.iconPath = iconForStatus(run.status, run.conclusion);
  }
}

export class JobNode extends vscode.TreeItem {
  readonly kind = "job" as const;
  constructor(
    public readonly repo: RepoContext,
    public readonly run: WorkflowRun,
    public readonly job: WorkflowJob,
  ) {
    super(job.name, jobCollapsibleState(job));
    this.description = formatDuration(job.startedAt, job.completedAt);
    this.tooltip = buildJobTooltip(job);
    this.contextValue = "actionlens.job";
    this.iconPath = iconForStatus(job.status, job.conclusion);
    this.command = {
      command: "actionlens.openJobLog",
      title: "Open Job Log",
      arguments: [this],
    };
  }
}

export class StepNode extends vscode.TreeItem {
  readonly kind = "step" as const;
  constructor(
    public readonly repo: RepoContext,
    public readonly run: WorkflowRun,
    public readonly job: WorkflowJob,
    public readonly step: JobStep,
  ) {
    super(`${step.number}. ${step.name}`, vscode.TreeItemCollapsibleState.None);
    this.description = formatDuration(step.startedAt, step.completedAt);
    this.tooltip = `Status: ${step.status}${step.conclusion ? `\nConclusion: ${step.conclusion}` : ""}`;
    this.contextValue = "actionlens.step";
    this.iconPath = iconForStatus(step.status, step.conclusion);
  }
}

export class MessageNode extends vscode.TreeItem {
  readonly kind = "message" as const;
  constructor(message: string, icon = "info") {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "actionlens.message";
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

function jobCollapsibleState(job: WorkflowJob): vscode.TreeItemCollapsibleState {
  if (job.steps.length === 0) return vscode.TreeItemCollapsibleState.None;
  if (job.conclusion === "failure") return vscode.TreeItemCollapsibleState.Expanded;
  return vscode.TreeItemCollapsibleState.Collapsed;
}

function iconForStatus(status: WorkflowRun["status"], conclusion: WorkflowRun["conclusion"]): vscode.ThemeIcon {
  if (status === "queued") return new vscode.ThemeIcon("clock", new vscode.ThemeColor("charts.yellow"));
  if (status === "in_progress") return new vscode.ThemeIcon("loading~spin", new vscode.ThemeColor("charts.blue"));
  switch (conclusion) {
    case "success":
      return new vscode.ThemeIcon("pass", new vscode.ThemeColor("testing.iconPassed"));
    case "failure":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
    case "cancelled":
      return new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("disabledForeground"));
    case "skipped":
      return new vscode.ThemeIcon("debug-step-over", new vscode.ThemeColor("disabledForeground"));
    case "timed_out":
      return new vscode.ThemeIcon("watch", new vscode.ThemeColor("charts.orange"));
    case "action_required":
      return new vscode.ThemeIcon("warning", new vscode.ThemeColor("charts.orange"));
    case "neutral":
      return new vscode.ThemeIcon("dash");
    default:
      return new vscode.ThemeIcon("question");
  }
}

function buildRunTooltip(run: WorkflowRun): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`**${run.name ?? `Run #${run.runNumber}`}**\n\n`);
  md.appendMarkdown(`- Status: \`${run.status}\`${run.conclusion ? ` (\`${run.conclusion}\`)` : ""}\n`);
  md.appendMarkdown(`- Branch: \`${run.headBranch ?? "—"}\`\n`);
  md.appendMarkdown(`- Commit: \`${run.headSha.slice(0, 7)}\`\n`);
  md.appendMarkdown(`- Event: \`${run.event}\`\n`);
  md.appendMarkdown(`- Actor: ${run.actor ?? "—"}\n`);
  md.appendMarkdown(`- Created: ${formatRelative(run.createdAt)}\n`);
  md.appendMarkdown(`- Updated: ${formatRelative(run.updatedAt)}\n`);
  return md;
}

function buildJobTooltip(job: WorkflowJob): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`**${job.name}**\n\n`);
  md.appendMarkdown(`- Status: \`${job.status}\`${job.conclusion ? ` (\`${job.conclusion}\`)` : ""}\n`);
  if (job.runnerName) md.appendMarkdown(`- Runner: ${job.runnerName}\n`);
  if (job.runnerOs) md.appendMarkdown(`- OS: ${job.runnerOs}\n`);
  if (job.startedAt) md.appendMarkdown(`- Started: ${formatRelative(job.startedAt)}\n`);
  if (job.completedAt) md.appendMarkdown(`- Completed: ${formatRelative(job.completedAt)}\n`);
  return md;
}
