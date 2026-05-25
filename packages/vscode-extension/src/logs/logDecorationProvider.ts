import * as vscode from "vscode";
import { buildLineRanges, type ParsedLog } from "@actionlens/core";
import { LOG_SCHEME, parseLogUri, type LogDocumentProvider } from "./logDocumentProvider";

export class LogDecorationProvider implements vscode.Disposable {
  private readonly errorType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("inputValidation.errorBackground"),
    overviewRulerColor: new vscode.ThemeColor("errorForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    gutterIconPath: undefined,
  });
  private readonly warningType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("inputValidation.warningBackground"),
    overviewRulerColor: new vscode.ThemeColor("editorWarning.foreground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly docs: LogDocumentProvider,
    private readonly isEnabled: () => boolean,
  ) {
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => this.applyToAll()),
      vscode.workspace.onDidOpenTextDocument(() => this.applyToAll()),
    );
  }

  applyToAll(): void {
    for (const editor of vscode.window.visibleTextEditors) this.apply(editor);
  }

  apply(editor: vscode.TextEditor): void {
    if (editor.document.uri.scheme !== LOG_SCHEME) return;
    if (!this.isEnabled()) {
      editor.setDecorations(this.errorType, []);
      editor.setDecorations(this.warningType, []);
      return;
    }
    const key = parseLogUri(editor.document.uri);
    if (!key) return;
    const parsed = this.docs.getParsed(key.jobId);
    if (!parsed) return;
    editor.setDecorations(this.errorType, rangesFor(parsed, "error"));
    editor.setDecorations(this.warningType, rangesFor(parsed, "warning"));
  }

  dispose(): void {
    this.errorType.dispose();
    this.warningType.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

function rangesFor(parsed: ParsedLog, severity: "error" | "warning"): vscode.Range[] {
  return buildLineRanges(parsed, [severity]).map(
    (r) => new vscode.Range(r.start - 1, 0, r.end - 1, Number.MAX_SAFE_INTEGER),
  );
}
