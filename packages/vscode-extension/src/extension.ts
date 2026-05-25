import * as vscode from "vscode";
import {
  GitHubClient,
  createGitHubActionsApi,
  detectRepoContext,
  type GitHubActionsApi,
  type RepoContext,
} from "@actionlens/core";
import { GitHubAuthProvider } from "./auth/vscodeAuthProvider";
import { ActionsTreeProvider } from "./tree/actionsTreeProvider";
import { LogDocumentProvider, LOG_SCHEME } from "./logs/logDocumentProvider";
import { LogDecorationProvider } from "./logs/logDecorationProvider";
import { registerRefreshCommand } from "./commands/refreshRuns";
import { registerOpenJobLogCommand } from "./commands/openJobLog";
import { registerCopyErrorSnippetCommand } from "./commands/copyErrorSnippet";
import { registerCopyAiDebugPromptCommand } from "./commands/copyAiDebugPrompt";
import { registerOpenInGithubCommand } from "./commands/openInGithub";
import { onSettingsChanged, readSettings, type ActionLensSettings } from "./config/settings";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("ActionLens");
  context.subscriptions.push(output);

  let settings: ActionLensSettings = readSettings();
  let repo: RepoContext | null = null;
  let api: GitHubActionsApi | null = null;

  const auth = new GitHubAuthProvider(context);
  const client = new GitHubClient({
    getToken: () => auth.getToken(),
    userAgent: "ActionLens-VSCode",
  });
  api = createGitHubActionsApi(client);

  let isSignedIn = false;
  const updateAuthContext = async (): Promise<void> => {
    const token = await auth.getToken();
    isSignedIn = !!token;
    vscode.commands.executeCommand("setContext", "actionlens.isSignedIn", isSignedIn);
  };

  const tree = new ActionsTreeProvider(
    () => repo,
    () => api,
    () => settings,
    () => isSignedIn,
    output,
  );
  const treeView = vscode.window.createTreeView("actionlens.actions", { treeDataProvider: tree });
  context.subscriptions.push(treeView);

  const docs = new LogDocumentProvider(() => api, () => settings.logMaxLines, output);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(LOG_SCHEME, docs),
  );

  const decorations = new LogDecorationProvider(docs, () => settings.errorHighlightEnabled);
  context.subscriptions.push(decorations);

  context.subscriptions.push(
    registerRefreshCommand(tree),
    registerOpenJobLogCommand(docs, decorations),
    registerCopyErrorSnippetCommand(docs),
    registerCopyAiDebugPromptCommand(docs),
    registerOpenInGithubCommand(),
    vscode.commands.registerCommand("actionlens.configureToken", async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: "Sign in with GitHub", description: "Use VS Code's built-in GitHub authentication" },
          { label: "Paste a Personal Access Token", description: "Stored securely in VS Code SecretStorage" },
          { label: "Clear stored token", description: "Forget the manual token" },
        ],
        { placeHolder: "ActionLens — choose how to authenticate" },
      );
      if (!choice) return;
      if (choice.label.startsWith("Sign in")) {
        vscode.commands.executeCommand("actionlens.signIn");
      } else if (choice.label.startsWith("Paste")) {
        vscode.commands.executeCommand("actionlens.enterToken");
      } else {
        await auth.clearToken();
        vscode.window.showInformationMessage("Stored token cleared.");
        await updateAuthContext();
        tree.refresh();
      }
    }),
    vscode.commands.registerCommand("actionlens.signIn", async () => {
      const token = await auth.signInInteractive();
      vscode.window.showInformationMessage(token ? "Signed in to GitHub." : "GitHub sign-in cancelled.");
      await updateAuthContext();
      tree.refresh();
    }),
    vscode.commands.registerCommand("actionlens.enterToken", async () => {
      const token = await auth.promptForToken();
      if (token) vscode.window.showInformationMessage("Token saved.");
      await updateAuthContext();
      tree.refresh();
    })
  );

  // Detect repo on activation and whenever the workspace changes.
  const refreshRepo = async (): Promise<void> => {
    repo = await detectFirstRepo();
    vscode.commands.executeCommand("setContext", "actionlens.hasRepo", !!repo);
    tree.refresh();
  };
  await updateAuthContext();
  await refreshRepo();
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(refreshRepo));

  // React to setting changes (incl. starting/stopping auto-refresh).
  context.subscriptions.push(
    onSettingsChanged((next) => {
      settings = next;
      restartAutoRefresh();
      tree.refresh();
      decorations.applyToAll();
    }),
  );

  let autoRefreshHandle: NodeJS.Timeout | null = null;
  const restartAutoRefresh = (): void => {
    if (autoRefreshHandle) {
      clearInterval(autoRefreshHandle);
      autoRefreshHandle = null;
    }
    if (!settings.autoRefreshEnabled) return;
    autoRefreshHandle = setInterval(() => tree.refresh(), settings.autoRefreshIntervalSeconds * 1000);
  };
  restartAutoRefresh();
  context.subscriptions.push({
    dispose: () => {
      if (autoRefreshHandle) clearInterval(autoRefreshHandle);
    },
  });
}

export function deactivate(): void {
  // VS Code disposes our subscriptions automatically.
}

async function detectFirstRepo(): Promise<RepoContext | null> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  for (const folder of folders) {
    const ctx = await detectRepoContext(folder.uri.fsPath);
    if (ctx) return ctx;
  }
  return null;
}
