import * as vscode from "vscode";
import type { ActionsTreeProvider } from "../tree/actionsTreeProvider";

export function registerRefreshCommand(tree: ActionsTreeProvider): vscode.Disposable {
  return vscode.commands.registerCommand("actionlens.refresh", () => tree.refresh());
}
