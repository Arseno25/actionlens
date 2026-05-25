<div align="center">
  <img src="logo.png" alt="ActionLens Logo" width="128" height="128">
  <h1>ActionLens</h1>
  <p><strong>Inspect GitHub Actions workflow runs, jobs, and logs without leaving VS Code.</strong></p>
</div>

ActionLens is a powerful Visual Studio Code extension that brings the full power of GitHub Actions directly into your editor. Stop context-switching to your browser just to check why a build failed.

## ✨ Features

- 🚀 **Real-time Workflow Monitoring**: View the status of your GitHub Actions runs instantly from the VS Code sidebar.
- 🎯 **Smart Error Detection**: Automatically highlights the exact lines where your CI/CD pipeline failed, so you don't have to scroll through thousands of lines of logs.
- 🤖 **AI-Ready Debugging**: With a single click, copy a pre-formatted "AI Debug Prompt" containing your repository context, branch name, and the exact error snippet. Paste it into your favorite LLM (Claude, ChatGPT) for an instant fix!
- 🔒 **Secure & Local**: Works with your local Git repository and uses your Personal Access Token securely stored in the VS Code credential manager.

## 🚀 Getting Started

1. Install **ActionLens** from the VS Code Marketplace.
2. Open a project that has a Git remote pointing to GitHub.
3. Click the ActionLens icon in the Activity Bar.
4. Click **Sign in with GitHub** or **Enter Token Manually** to authenticate.
5. Watch your workflow runs stream right into your editor!

---

## ❓ Q & A (Frequently Asked Questions)

### Q: Why do I need to authenticate? Can't I view public repositories?
**A:** While GitHub allows viewing public logs anonymously, doing so is heavily rate-limited (60 requests per hour). Authenticating gives you a generous rate limit (5,000 requests per hour) and allows you to view logs for private repositories securely.

### Q: How do I authenticate manually with a Token?
**A:** You can generate a Personal Access Token (PAT) from your GitHub Developer Settings.
- For **Fine-grained PATs**, you only need `Actions: Read` permission.
- For **Classic PATs**, you need the `repo` scope.
Once generated, click "Enter Token Manually" in the ActionLens sidebar and paste it there.

### Q: Does this support GitHub Enterprise Server (GHES)?
**A:** Yes! ActionLens automatically detects your remote Git URL. If your repository points to a GitHub Enterprise host, it will attempt to communicate with that specific host.

### Q: How does the "Copy AI Debug Prompt" feature work?
**A:** When a job fails, ActionLens parses the log, finds the exact error block, and bundles it with context about your repository (e.g., branch name, workflow name). It copies a ready-to-paste prompt to your clipboard so your AI assistant knows exactly what went wrong without you explaining it manually.

### Q: Will this extension send my code to the cloud?
**A:** No. ActionLens only communicates directly with the official GitHub API to fetch your logs. We do not store, track, or send your code or logs to any third-party servers. The AI prompt feature simply copies text to your local clipboard.

## 📄 License
This extension is licensed under the MIT License.
