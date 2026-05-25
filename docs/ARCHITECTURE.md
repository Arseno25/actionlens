# Architecture

ActionLens is a monorepo with a shared TypeScript core and two IDE-specific
adapters: a VS Code extension (TypeScript) and a JetBrains plugin (Kotlin).

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         IDE-specific adapter                               │
│   (VS Code extension OR JetBrains plugin — chooses one runtime)            │
│                                                                            │
│   • UI (tree view / tool window)                                           │
│   • Secret storage                                                         │
│   • IDE commands & decorations                                             │
│                                                                            │
│        ▼ calls                            ▼ calls                          │
│   ┌──────────────────────┐         ┌──────────────────────┐                │
│   │  @actionlens/core    │         │  Local Kotlin port   │                │
│   │  (TS, IDE-agnostic)  │         │  (mirrors core API)  │                │
│   └──────────────────────┘         └──────────────────────┘                │
│        ▼ HTTP                                                              │
│   ┌────────────────────────────────────────────────┐                       │
│   │   GitHub REST API (api.github.com)              │                       │
│   └────────────────────────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────────────────┘
```

## Packages

### `packages/core`

Pure TypeScript. No `vscode` import, no IntelliJ import. Exposes:

- `GitHubActionsApi` — typed client over GitHub REST.
- `parseGitHubRemote(url)` — accepts HTTPS, SSH, and bare URLs.
- `LogParser` / `ErrorDetector` — turn raw text logs into structured findings.
- `TtlCache` — small TTL cache for parsed logs (never used for the redirect
  URL returned by the log endpoint, which expires in ~60s).
- `createAiDebugPrompt(input)` — assembles the clipboard prompt.

The IDE adapters depend on this package as a normal Node/NPM dependency.

### `packages/vscode-extension`

Thin VS Code wrapper:

- `actionsTreeProvider.ts` builds a `TreeDataProvider` whose nodes are
  Repository → Run → Job → Step.
- `logDocumentProvider.ts` is a `TextDocumentContentProvider` registered on
  the `actionlens-log:` URI scheme so logs are read-only virtual documents.
- `logDecorationProvider.ts` paints decorations on error/warning lines.
- `auth/vscodeAuthProvider.ts` prefers `vscode.authentication.getSession`
  and falls back to a manual token in `SecretStorage`.

### `packages/jetbrains-plugin`

Kotlin / IntelliJ Platform Plugin (Gradle 2.x). Mirrors the TS core in Kotlin
so we don't ship a JS runtime inside the plugin:

- `GitHubActionsClient` — Ktor / `HttpClient`-style wrapper.
- `LogParser` + `ErrorDetector` — same regex set as the TS version.
- `ActionLensToolWindowFactory` registers a tool window with a tree + log
  viewer split.
- `TokenStorage` uses `PasswordSafe` (`CredentialAttributes`).

## API flow

```
User opens IDE
   │
   ▼
GitRepositoryDetector
   ├── read `.git/config` (origin URL)
   ├── parseGitHubRemote → { owner, repo, host }
   ├── read HEAD branch + commit SHA
   ▼
GitHubActionsApi.getWorkflowRuns(filters)
   ▼
Render Tree (Run nodes)
   │
   ▼ on expand
GitHubActionsApi.getJobsForRun(runId)
   ▼
Render Job + Step nodes
   │
   ▼ on "Open log"
GitHubActionsApi.downloadJobLog(jobId)
   ├── GET /repos/.../jobs/{id}/logs   → 302 redirect to a signed URL
   ├── follow redirect (no caching of the URL)
   └── GET signed URL → text
   ▼
LogParser → { lines, errorLineNumbers, warningLineNumbers, firstError }
   ▼
TtlCache.put(jobId, parsed, 60s)
   ▼
IDE adapter renders log + paints decorations
```

## Log parsing flow

`LogParser` is two-phase:

1. **Tokenize** — split on `\n`, strip GitHub's leading timestamp where
   present (`2024-12-31T12:34:56.789Z `).
2. **Classify** — for each line, apply ordered `ErrorPattern[]` and
   `WarningPattern[]` from `errorDetector.ts`. The first matching pattern wins.

Findings are grouped:

- contiguous error lines collapse into one "error block";
- the first error block determines `firstErrorLine` which IDE adapters use to
  jump the cursor when a log is opened.

## Caching

Two layers:

- **Parsed logs** (`TtlCache`) — keyed by job ID, 60s TTL. Cuts repeat reads
  when the user toggles between jobs.
- **API metadata** (run list, jobs list) — short cache (15s) primarily to
  smooth out fast user clicks. Never cached when auto-refresh is active.

The redirect URL from `/jobs/{id}/logs` is **never cached**.

## Error handling

`GitHubApiError` carries `status` and a `kind` enum
(`UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | RATE_LIMITED | LOG_EXPIRED | TRANSIENT | UNKNOWN`).
Adapters translate `kind` into IDE-friendly messages — they never read
status codes directly.

## Extensibility

- **GitHub Enterprise**: `GitHubClient` accepts `baseUrl` (default
  `https://api.github.com`). The settings UI surfaces this when we enable it.
- **Rerun failed jobs**: `GitHubActionsApi.rerunFailedJobs(runId)` is
  stubbed but unused. Adapters can wire a command when we lift the MVP gate.
- **AI integration**: `createAiDebugPrompt` returns plain text. A future
  opt-in `aiProvider` interface in core can consume that prompt and call a
  remote model.
