# VS Code extension

## Develop

```bash
pnpm install
pnpm --filter @actionlens/core build
pnpm --filter actionlens-vscode dev
```

Open the `packages/vscode-extension` folder in VS Code and press **F5** to
launch an Extension Development Host.

## Package as `.vsix`

```bash
pnpm --filter actionlens-vscode build
pnpm --filter actionlens-vscode exec vsce package --no-dependencies
```

Install the produced `.vsix` via the VS Code command palette
`Extensions: Install from VSIX…`.

## Commands

| Command id                          | Title                            |
| ----------------------------------- | -------------------------------- |
| `actionlens.refresh`                | ActionLens: Refresh              |
| `actionlens.openJobLog`             | ActionLens: Open Job Log         |
| `actionlens.copyErrorSnippet`       | ActionLens: Copy Error Snippet   |
| `actionlens.copyAiDebugPrompt`      | ActionLens: Copy AI Debug Prompt |
| `actionlens.openInGithub`           | ActionLens: Open in GitHub       |
| `actionlens.configureToken`         | ActionLens: Configure Token      |

## Settings

| Key                                   | Default | Description                                          |
| ------------------------------------- | ------- | ---------------------------------------------------- |
| `actionlens.autoRefresh.enabled`      | `false` | Re-poll in-progress runs                             |
| `actionlens.autoRefresh.intervalSeconds` | `15`  | Interval when auto-refresh is on                     |
| `actionlens.defaultBranchOnly`        | `false` | Only show runs for the current branch                |
| `actionlens.matchCurrentCommit`       | `false` | Only show runs for the current commit SHA            |
| `actionlens.maxRuns`                  | `25`    | Maximum runs shown per repo                          |
| `actionlens.log.maxLines`             | `5000`  | Truncate log display past this many lines            |
| `actionlens.errorHighlight.enabled`   | `true`  | Paint decorations on detected error lines            |

## Tokens

ActionLens first tries `vscode.authentication.getSession('github')`. If that
fails or you choose `Configure Token`, a token is stored in
`SecretStorage` (never in `settings.json`).
