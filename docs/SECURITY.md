# Security

## Token storage

| IDE       | Storage                                              |
| --------- | ---------------------------------------------------- |
| VS Code   | `vscode.ExtensionContext.secrets` (`SecretStorage`) — or OAuth session from the built-in `github` authentication provider |
| JetBrains | `com.intellij.credentialStore.PasswordSafe` — or OAuth token reused from the bundled GitHub plugin (`org.jetbrains.plugins.github`) |

Tokens are **never**:

- written to `settings.json`, `workspace.xml`, or any other on-disk config;
- included in error messages shown to the user;
- printed to the VS Code Output channel or the IntelliJ log;
- transmitted to any host other than `api.github.com` (and the signed log
  URL returned by GitHub, with no Authorization header).

## Required token permissions

| Token type        | Minimum permission                                |
| ----------------- | ------------------------------------------------- |
| Fine-grained PAT  | Repository → **Actions: Read**                    |
| Classic PAT       | `repo` for private repos (no scope for public)    |
| VS Code GitHub OAuth | Default scopes from `vscode.authentication`    |

For "rerun failed jobs" (future, opt-in), the token needs **Actions: Write**.

## Secret masking in `Copy AI Debug Prompt`

Before the prompt is written to the clipboard, the log snippet is passed
through a sanitiser that masks:

- GitHub tokens: `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`
- Bearer tokens in `Authorization:` headers
- Generic API key patterns (`key`, `secret`, `password`, `token` followed
  by an `=` or `:` and a value)
- Private SSH keys (`-----BEGIN .* PRIVATE KEY-----` blocks)
- AWS-style access keys

Masking is best-effort; users should still review the prompt before pasting.

## No third-party AI calls by default

`Copy AI Debug Prompt` only copies text. ActionLens does **not** ship with
any AI provider integration. A future opt-in `aiProvider` interface is
described in `ROADMAP.md`.

## Network

The only outgoing hosts are:

- `api.github.com` (or a configured GHES base URL — future)
- Short-lived signed URLs returned from GitHub's logs redirect (the URL is
  fetched once, never stored)

## Disclosure

Please report security issues privately to the maintainers; please do not
open public issues for vulnerabilities.
