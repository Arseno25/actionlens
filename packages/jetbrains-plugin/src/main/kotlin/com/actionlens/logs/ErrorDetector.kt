package com.actionlens.logs

enum class LineSeverity { ERROR, WARNING, INFO }

private data class Pattern(val id: String, val severity: LineSeverity, val regex: Regex)

private val TIMESTAMP_RE = Regex("""^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s""")

private val PATTERNS = listOf(
    // Warnings first.
    Pattern("warning-prefix", LineSeverity.WARNING, Regex("""^(?:\s*\[?)?warning\b""", RegexOption.IGNORE_CASE)),
    Pattern("warn-prefix", LineSeverity.WARNING, Regex("""^(?:\s*\[?)?warn\b""", RegexOption.IGNORE_CASE)),
    Pattern("deprecated", LineSeverity.WARNING, Regex("""\bdeprecat(?:ed|ion)\b""", RegexOption.IGNORE_CASE)),

    // GitHub Actions infra.
    Pattern("process-exit", LineSeverity.ERROR, Regex("""process completed with exit code\s+[1-9]""", RegexOption.IGNORE_CASE)),
    Pattern("github-error-prefix", LineSeverity.ERROR, Regex("""^##\[error\]""", RegexOption.IGNORE_CASE)),

    // JS / Node tooling.
    Pattern("npm-err", LineSeverity.ERROR, Regex("""^npm\s+ERR!""")),
    Pattern("pnpm-err", LineSeverity.ERROR, Regex("""^\s*(?:ELIFECYCLE|ERR_PNPM_[A-Z0-9_]+)\b""")),
    Pattern("yarn-error", LineSeverity.ERROR, Regex("""^(?:yarn\s+)?error\s""", RegexOption.IGNORE_CASE)),

    // PHP / Laravel.
    Pattern("phpunit-fail", LineSeverity.ERROR, Regex("""\bFAILURES!\b|^FAILED\b""")),
    Pattern("pest-fail", LineSeverity.ERROR, Regex("""^\s*(?:FAIL|FAILED)\s+Tests\\""")),
    Pattern("laravel-exception", LineSeverity.ERROR, Regex("""\b(?:Illuminate\\|Symfony\\Component\\).+Exception\b""")),
    Pattern("composer-error", LineSeverity.ERROR, Regex("""^\s*\[?(?:RuntimeException|ErrorException)\]?\b""")),
    Pattern("sqlstate", LineSeverity.ERROR, Regex("""\bSQLSTATE\[[A-Z0-9]+]""")),

    // TS / ESLint.
    Pattern("ts-error", LineSeverity.ERROR, Regex(""":\s*error TS\d+:""")),
    Pattern("eslint-error", LineSeverity.ERROR, Regex("""^\s*\d+:\d+\s+error\s""", RegexOption.IGNORE_CASE)),

    // Docker.
    Pattern("docker-build-failed", LineSeverity.ERROR, Regex("""^(?:ERROR:\s+)?failed to (?:build|solve)""", RegexOption.IGNORE_CASE)),
    Pattern("docker-no-such-image", LineSeverity.ERROR, Regex("""^(?:Error response from daemon|docker:)\s+""", RegexOption.IGNORE_CASE)),

    // Shell.
    Pattern("permission-denied", LineSeverity.ERROR, Regex("""\bpermission denied\b""", RegexOption.IGNORE_CASE)),
    Pattern("command-not-found", LineSeverity.ERROR, Regex("""\b(?:command not found|No such file or directory)\b""", RegexOption.IGNORE_CASE)),

    // Generic.
    Pattern("traceback", LineSeverity.ERROR, Regex("""^Traceback \(most recent call last\):""")),
    Pattern("exception", LineSeverity.ERROR, Regex("""^\s*[\w.]*Exception(?:\s*[:\[]|\s+in\s)""")),
    Pattern("fatal", LineSeverity.ERROR, Regex("""^\s*fatal[:\s]""", RegexOption.IGNORE_CASE)),
    Pattern("error-prefix", LineSeverity.ERROR, Regex("""^(?:\s*\[?)?error[:\s]""", RegexOption.IGNORE_CASE)),
    Pattern("failed-prefix", LineSeverity.ERROR, Regex("""^(?:\s*\[?)?failed[:\s]""", RegexOption.IGNORE_CASE)),
)

object ErrorDetector {
    fun stripTimestamp(line: String): String = TIMESTAMP_RE.replace(line, "")

    fun classify(line: String): Pair<LineSeverity, String?> {
        val cleaned = stripTimestamp(line)
        for (p in PATTERNS) {
            if (p.regex.containsMatchIn(cleaned)) return p.severity to p.id
        }
        return LineSeverity.INFO to null
    }
}
