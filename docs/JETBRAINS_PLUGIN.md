# JetBrains plugin

Tested on the IntelliJ Platform 2024.1+ (IDEA, WebStorm, PhpStorm, PyCharm,
GoLand, CLion). Built with **IntelliJ Platform Gradle Plugin 2.x**.

## Develop

```bash
cd packages/jetbrains-plugin
./gradlew runIde       # macOS / Linux
gradlew.bat runIde     # Windows
```

That launches a sandbox IDE with ActionLens installed. Edit Kotlin files and
re-run.

## Package as a distributable

```bash
./gradlew buildPlugin
# Output: build/distributions/actionlens-<version>.zip
```

Install via **Settings → Plugins → ⚙ → Install Plugin from Disk**.

## Tool window

**View → Tool Windows → ActionLens** (right side by default).

The tool window has a toolbar with refresh and tree pane (Repo → Run → Job →
Step). Double-clicking a job opens the log in the lower split.

## Actions

| Action id                              | Where it appears        |
| -------------------------------------- | ----------------------- |
| `ActionLens.Refresh`                   | Toolbar + popup menu    |
| `ActionLens.OpenJobLog`                | Tree popup              |
| `ActionLens.CopyErrorSnippet`          | Log viewer toolbar      |
| `ActionLens.CopyAiDebugPrompt`         | Log viewer toolbar      |
| `ActionLens.OpenInGithub`              | Tree popup              |

## Authentication

ActionLens picks a token in this order:

1. **Manual PAT** — paste into Settings → Tools → ActionLens (stored in `PasswordSafe`).
2. **Bundled GitHub plugin** — if you're already signed in via
   *Settings → Version Control → GitHub*, ActionLens reuses that account's
   OAuth token. No setup needed.
3. **Unauthenticated** — public repos only, rate-limited.

The auth source in use is shown at the top of Settings → Tools → ActionLens
and in the tool window's status bar.

## Settings

**Settings → Tools → ActionLens**:

- Manual GitHub PAT (optional — leave blank to use the IDE GitHub account)
- API base URL
- Auto-refresh on/off + interval
- Default branch only
- Max runs / Max log lines
- Error highlighting on/off

## Supported IDEs

`build.gradle.kts` targets the IntelliJ platform base, so the plugin runs on
IntelliJ IDEA, WebStorm, PhpStorm, PyCharm, GoLand, and CLion (any
IntelliJ-based IDE on the configured platform version).
