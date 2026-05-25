import * as vscode from "vscode";

export interface ActionLensSettings {
  autoRefreshEnabled: boolean;
  autoRefreshIntervalSeconds: number;
  defaultBranchOnly: boolean;
  matchCurrentCommit: boolean;
  maxRuns: number;
  logMaxLines: number;
  errorHighlightEnabled: boolean;
}

export function readSettings(): ActionLensSettings {
  const cfg = vscode.workspace.getConfiguration("actionlens");
  return {
    autoRefreshEnabled: cfg.get<boolean>("autoRefresh.enabled", false),
    autoRefreshIntervalSeconds: cfg.get<number>("autoRefresh.intervalSeconds", 15),
    defaultBranchOnly: cfg.get<boolean>("defaultBranchOnly", false),
    matchCurrentCommit: cfg.get<boolean>("matchCurrentCommit", false),
    maxRuns: cfg.get<number>("maxRuns", 25),
    logMaxLines: cfg.get<number>("log.maxLines", 5000),
    errorHighlightEnabled: cfg.get<boolean>("errorHighlight.enabled", true),
  };
}

export function onSettingsChanged(listener: (settings: ActionLensSettings) => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("actionlens")) listener(readSettings());
  });
}
