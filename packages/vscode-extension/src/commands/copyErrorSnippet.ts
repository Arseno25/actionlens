import * as vscode from "vscode";
import { extractErrorSnippet, sanitiseLogText } from "@actionlens/core";
import type { LogDocumentProvider } from "../logs/logDocumentProvider";
import { JobNode } from "../tree/treeItems";

export function registerCopyErrorSnippetCommand(docs: LogDocumentProvider): vscode.Disposable {
  return vscode.commands.registerCommand("actionlens.copyErrorSnippet", async (node?: JobNode) => {
    if (!(node instanceof JobNode)) {
      vscode.window.showInformationMessage("Select a job in the ActionLens sidebar first.");
      return;
    }
    const parsed = docs.getParsed(node.job.id);
    if (!parsed) {
      vscode.window.showWarningMessage("Open the job log first so ActionLens can parse it.");
      return;
    }
    const snippet = sanitiseLogText(extractErrorSnippet(parsed));
    await vscode.env.clipboard.writeText(snippet);
    vscode.window.showInformationMessage("Error snippet copied to clipboard.");
  });
}
