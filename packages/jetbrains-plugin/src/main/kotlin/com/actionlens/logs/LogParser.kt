package com.actionlens.logs

data class ClassifiedLine(
    val number: Int,
    val text: String,
    val raw: String,
    val severity: LineSeverity,
    val matchedPattern: String?,
)

data class ErrorBlock(
    val lineNumbers: List<Int>,
    val startLine: Int,
    val endLine: Int,
    val preview: String,
)

data class ParsedLog(
    val lines: List<ClassifiedLine>,
    val errorLineNumbers: List<Int>,
    val warningLineNumbers: List<Int>,
    val errorBlocks: List<ErrorBlock>,
    val firstErrorLine: Int?,
    val summary: String,
)

class LogParser(
    private val maxLines: Int = 5000,
    private val contextLines: Int = 3,
) {

    fun parse(raw: String): ParsedLog {
        val all = raw.split(Regex("\r?\n"))
        val truncated = if (all.size > maxLines) all.subList(all.size - maxLines, all.size) else all

        val lines = truncated.mapIndexed { idx, rawLine ->
            val (sev, pid) = ErrorDetector.classify(rawLine)
            ClassifiedLine(
                number = idx + 1,
                text = ErrorDetector.stripTimestamp(rawLine),
                raw = rawLine,
                severity = sev,
                matchedPattern = pid,
            )
        }

        val errorLineNumbers = lines.filter { it.severity == LineSeverity.ERROR }.map { it.number }
        val warningLineNumbers = lines.filter { it.severity == LineSeverity.WARNING }.map { it.number }
        val blocks = groupBlocks(errorLineNumbers, lines, contextLines)
        val firstError = errorLineNumbers.firstOrNull()
        val summary = buildSummary(lines.size, errorLineNumbers.size, warningLineNumbers.size)

        return ParsedLog(lines, errorLineNumbers, warningLineNumbers, blocks, firstError, summary)
    }

    private fun groupBlocks(errorLines: List<Int>, lines: List<ClassifiedLine>, ctx: Int): List<ErrorBlock> {
        if (errorLines.isEmpty()) return emptyList()
        val blocks = mutableListOf<ErrorBlock>()
        val current = mutableListOf<Int>()

        fun flush() {
            if (current.isEmpty()) return
            val start = maxOf(1, current.first() - ctx)
            val end = minOf(lines.size, current.last() + ctx)
            val nums = (start..end).toList()
            val preview = nums.joinToString("\n") { lines[it - 1].text }
            blocks += ErrorBlock(nums, start, end, preview)
            current.clear()
        }

        for (n in errorLines) {
            if (current.isEmpty() || n - current.last() <= ctx + 1) current += n
            else { flush(); current += n }
        }
        flush()
        return blocks
    }

    private fun buildSummary(total: Int, errors: Int, warnings: Int): String {
        if (errors == 0 && warnings == 0) return "$total lines, no errors detected."
        val parts = mutableListOf("$total lines")
        if (errors > 0) parts += "$errors error${if (errors == 1) "" else "s"}"
        if (warnings > 0) parts += "$warnings warning${if (warnings == 1) "" else "s"}"
        return parts.joinToString(", ") + "."
    }
}

object LogSanitiser {
    private val patterns = listOf<Pair<Regex, String>>(
        Regex("""\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}""") to "[REDACTED:GITHUB_TOKEN]",
        Regex("""\bgithub_pat_[A-Za-z0-9_]{20,}""") to "[REDACTED:GITHUB_TOKEN]",
        Regex("""(?i)(authorization:\s*bearer\s+)[A-Za-z0-9._\-+/=]+""") to "$1[REDACTED]",
        Regex("""\bAKIA[0-9A-Z]{16}\b""") to "[REDACTED:AWS_KEY]",
        Regex("""(?i)\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9._\-+/=]{8,}['"]?""") to "$1=[REDACTED]",
        Regex("""-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----""") to "[REDACTED:PRIVATE_KEY]",
    )

    fun sanitise(text: String): String = patterns.fold(text) { acc, (r, repl) -> r.replace(acc, repl) }
}

data class AiDebugPromptInput(
    val repository: String,
    val branch: String? = null,
    val commitSha: String? = null,
    val workflowName: String? = null,
    val jobName: String? = null,
    val failedStepName: String? = null,
    val parsedLog: ParsedLog? = null,
    val snippet: String? = null,
)

private const val INSTRUCTION =
    "Analyze this GitHub Actions failure. Identify the root cause, explain why it happened, and suggest the minimal safe fix. Focus on the relevant log lines and avoid guessing."

object AiDebugPrompt {
    fun create(input: AiDebugPromptInput): String {
        val sb = StringBuilder()
        sb.appendLine(INSTRUCTION)
        sb.appendLine()
        sb.appendLine("Context:")
        sb.appendLine("- Repository: ${input.repository}")
        input.branch?.let { sb.appendLine("- Branch: $it") }
        input.commitSha?.let { sb.appendLine("- Commit: $it") }
        input.workflowName?.let { sb.appendLine("- Workflow: $it") }
        input.jobName?.let { sb.appendLine("- Job: $it") }
        input.failedStepName?.let { sb.appendLine("- Failed step: $it") }

        val snippet = input.parsedLog?.errorBlocks?.firstOrNull()?.preview ?: input.snippet
        if (!snippet.isNullOrBlank()) {
            sb.appendLine()
            sb.appendLine("Relevant log lines:")
            sb.appendLine("```")
            sb.appendLine(LogSanitiser.sanitise(snippet).trimEnd())
            sb.appendLine("```")
        }
        input.parsedLog?.let {
            sb.appendLine()
            sb.appendLine("Summary: ${it.summary}")
        }
        return sb.toString().trimEnd()
    }
}
