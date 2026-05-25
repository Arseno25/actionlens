# ActionLens — JetBrains plugin

Kotlin / IntelliJ Platform plugin (Gradle 2.x). Runs on IDEA, WebStorm,
PhpStorm, PyCharm, GoLand, CLion.

## Run in a sandbox IDE

```bash
./gradlew runIde       # macOS / Linux
gradlew.bat runIde     # Windows
```

This builds the plugin and launches a sandbox IDE (defaults to IntelliJ IDEA
Community for the version in `gradle.properties`).

## Build a distributable

```bash
./gradlew buildPlugin
# Output: build/distributions/actionlens-<version>.zip
```

Install with **Settings → Plugins → ⚙ → Install Plugin from Disk**.

## Token

Open **Settings → Tools → ActionLens**. The token field writes through to
`PasswordSafe` (OS keychain when available) — never to project XML.

## Where things live

| Concern         | File                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Tool window     | `toolwindow/ActionLensToolWindowFactory.kt`                          |
| Tree + log split| `toolwindow/ActionLensPanel.kt`, `toolwindow/LogViewerPanel.kt`       |
| GitHub client   | `github/GitHubActionsClient.kt`                                       |
| Git detection   | `git/GitRepositoryDetector.kt` (uses bundled Git4Idea)               |
| Log parsing     | `logs/LogParser.kt`, `logs/ErrorDetector.kt`                          |
| Token storage   | `security/TokenStorage.kt`                                            |
| Settings        | `settings/ActionLensSettings.kt`, `settings/ActionLensConfigurable.kt`|

## Tests

```bash
./gradlew test
```

Tests live under `src/test/kotlin`.
