# Roadmap

## Shipping in MVP

- Shared core (TypeScript)
- VS Code extension: tree view + log viewer + error highlighting + Copy
  Error Snippet + Copy AI Debug Prompt + Open in GitHub + Refresh
- JetBrains plugin: tool window with the same set of commands

## Next

### GitHub Enterprise support

`GitHubClient` already accepts a `baseUrl`. Surface a setting:
`actionlens.githubBaseUrl` (default `https://api.github.com`). Document
GHES PAT scopes.

### Rerun failed jobs

The endpoint is already in the core client API
(`POST /actions/runs/{run_id}/rerun-failed-jobs`). Adapter work:

- VS Code: command `actionlens.rerunFailedJobs` with a confirmation dialog,
  enablement when the selected run has `conclusion === "failure"`.
- JetBrains: matching action under the tree popup.

Requires **Actions: Write** on the PAT.

### Cancel workflow

`POST /actions/runs/{run_id}/cancel`. Same UX pattern as rerun.

### AI explanation (opt-in)

Add `aiProvider` interface in core. Built-in providers:

- Local — does nothing, current behavior.
- Bring-your-own — user pastes a model endpoint + key into settings
  (separate `SecretStorage` slot).

New command: `actionlens.explainFailure` — composes the prompt internally
and shows the response in a webview / tool window panel.

### Local workflow file analysis

Parse `.github/workflows/*.yml` and cross-reference run results — e.g.
"this step has never passed on this branch", "this step takes 4× longer
than last week".

### Problem matcher integration (VS Code)

Map detected error lines to `Problems` view via
`vscode.languages.createDiagnosticCollection`.

### Inline annotations on source files

When the GitHub Actions log references a file/line in the workspace, paint
a gutter icon there.
