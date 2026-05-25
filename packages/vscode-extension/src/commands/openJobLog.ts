import * as vscode from "vscode";
import { buildLogUri, type LogDocumentProvider } from "../logs/logDocumentProvider";
import type { LogDecorationProvider } from "../logs/logDecorationProvider";
import { JobNode } from "../tree/treeItems";

export function registerOpenJobLogCommand(
  docs: LogDocumentProvider,
  decorations: LogDecorationProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand("actionlens.openJobLog", async (node?: JobNode) => {
    if (!(node instanceof JobNode)) {
      vscode.window.showInformationMessage("Select a job in the ActionLens sidebar first.");
      return;
    }
    const uri = buildLogUri(
      { owner: node.repo.remote.owner, repo: node.repo.remote.repo, jobId: node.job.id },
      `${node.run.name ?? `run-${node.run.runNumber}`} / ${node.job.name}.log`,
    );
    docs.invalidate(uri);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    decorations.apply(editor);

    // Jump cursor to the first detected error block if any.
    const parsed = docs.getParsed(node.job.id);
    if (parsed?.firstErrorLine) {
      const line = Math.max(0, parsed.firstErrorLine - 1);
      const pos = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
  });
}
