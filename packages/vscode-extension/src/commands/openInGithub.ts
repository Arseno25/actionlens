import * as vscode from "vscode";
import { JobNode, RunNode } from "../tree/treeItems";

export function registerOpenInGithubCommand(): vscode.Disposable {
  return vscode.commands.registerCommand("actionlens.openInGithub", async (node?: RunNode | JobNode) => {
    let url: string | null = null;
    if (node instanceof JobNode) url = node.job.htmlUrl;
    else if (node instanceof RunNode) url = node.run.htmlUrl;
    if (!url) {
      vscode.window.showInformationMessage("Select a run or job in the ActionLens sidebar first.");
      return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(url));
  });
}
