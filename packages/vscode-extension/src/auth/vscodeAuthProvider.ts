import * as vscode from "vscode";

const SECRET_KEY = "actionlens.githubToken";

export class GitHubAuthProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Returns a token, preferring VS Code's GitHub session over the manual secret. */
  async getToken(): Promise<string | null> {
    try {
      const session = await vscode.authentication.getSession("github", ["repo"], { createIfNone: false });
      if (session?.accessToken) return session.accessToken;
    } catch {
      // fall through to manual token
    }
    const stored = await this.context.secrets.get(SECRET_KEY);
    return stored ?? null;
  }

  /** Prompt the user for a token and store it in SecretStorage. */
  async promptForToken(): Promise<string | null> {
    const value = await vscode.window.showInputBox({
      title: "ActionLens — GitHub token",
      prompt: "Paste a GitHub PAT (Actions: Read for fine-grained, or `repo` for classic). Stored in VS Code SecretStorage.",
      ignoreFocusOut: true,
      password: true,
      placeHolder: "ghp_…  /  github_pat_…",
    });
    if (!value) return null;
    await this.context.secrets.store(SECRET_KEY, value.trim());
    return value.trim();
  }

  async clearToken(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
  }

  /** Trigger a VS Code GitHub OAuth session (creates one if absent). */
  async signInInteractive(): Promise<string | null> {
    try {
      const session = await vscode.authentication.getSession("github", ["repo"], { createIfNone: true });
      return session?.accessToken ?? null;
    } catch {
      return null;
    }
  }
}
