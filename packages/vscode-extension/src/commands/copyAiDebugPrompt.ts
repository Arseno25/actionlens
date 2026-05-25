import * as vscode from "vscode";
import { createAiDebugPrompt } from "@actionlens/core";
import type { LogDocumentProvider } from "../logs/logDocumentProvider";
import { JobNode } from "../tree/treeItems";

export function registerCopyAiDebugPromptCommand(docs: LogDocumentProvider): vscode.Disposable {
  return vscode.commands.registerCommand("actionlens.copyAiDebugPrompt", async (node?: JobNode) => {
    if (!(node instanceof JobNode)) {
      vscode.window.showInformationMessage("Select a job in the ActionLens sidebar first.");
      return;
    }
    const parsed = docs.getParsed(node.job.id);
    const failedStep = node.job.steps.find((s) => s.conclusion === "failure");
    const prompt = createAiDebugPrompt({
      repository: `${node.repo.remote.owner}/${node.repo.remote.repo}`,
      branch: node.run.headBranch,
      commitSha: node.run.headSha,
      workflowName: node.run.name,
      jobName: node.job.name,
      failedStepName: failedStep?.name ?? null,
      parsedLog: parsed ?? undefined,
    });
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage("AI debug prompt copied to clipboard.");
  });
}
