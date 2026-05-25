package com.actionlens.github

enum class WorkflowRunStatus { QUEUED, IN_PROGRESS, COMPLETED }

enum class WorkflowConclusion {
    SUCCESS, FAILURE, CANCELLED, SKIPPED, TIMED_OUT, ACTION_REQUIRED, NEUTRAL;

    companion object {
        fun fromApi(value: String?): WorkflowConclusion? = when (value) {
            "success" -> SUCCESS
            "failure" -> FAILURE
            "cancelled" -> CANCELLED
            "skipped" -> SKIPPED
            "timed_out" -> TIMED_OUT
            "action_required" -> ACTION_REQUIRED
            "neutral" -> NEUTRAL
            else -> null
        }
    }
}

fun parseStatus(value: String?): WorkflowRunStatus = when (value) {
    "queued", "waiting", "pending", "requested" -> WorkflowRunStatus.QUEUED
    "in_progress" -> WorkflowRunStatus.IN_PROGRESS
    else -> WorkflowRunStatus.COMPLETED
}

data class WorkflowRun(
    val id: Long,
    val name: String?,
    val workflowId: Long,
    val headBranch: String?,
    val headSha: String,
    val event: String,
    val status: WorkflowRunStatus,
    val conclusion: WorkflowConclusion?,
    val runNumber: Int,
    val runAttempt: Int,
    val actor: String?,
    val createdAt: String,
    val updatedAt: String,
    val htmlUrl: String,
)

data class JobStep(
    val name: String,
    val number: Int,
    val status: WorkflowRunStatus,
    val conclusion: WorkflowConclusion?,
    val startedAt: String?,
    val completedAt: String?,
)

data class WorkflowJob(
    val id: Long,
    val runId: Long,
    val name: String,
    val status: WorkflowRunStatus,
    val conclusion: WorkflowConclusion?,
    val startedAt: String?,
    val completedAt: String?,
    val runnerName: String?,
    val runnerOs: String?,
    val htmlUrl: String,
    val steps: List<JobStep>,
)

data class WorkflowRunListFilters(
    val branch: String? = null,
    val status: WorkflowRunStatus? = null,
    val event: String? = null,
    val actor: String? = null,
    val workflowName: String? = null,
    val headSha: String? = null,
    val conclusion: WorkflowConclusion? = null,
    val perPage: Int = 25,
    val page: Int? = null,
)

enum class GitHubErrorKind {
    UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMITED,
    LOG_EXPIRED, LOG_NOT_READY, TRANSIENT, NETWORK, UNKNOWN;

    fun userMessage(retryAfterSeconds: Int? = null): String = when (this) {
        UNAUTHENTICATED -> "GitHub token is missing or invalid. Configure a token to view Actions for this repository."
        FORBIDDEN -> "Your GitHub token is missing the required permissions (Actions: Read for this repository)."
        NOT_FOUND -> "Repository, run, or job was not found. Check the remote URL or your token's access."
        RATE_LIMITED -> retryAfterSeconds?.let { "GitHub API rate limit hit. Retry in ${it}s." }
            ?: "GitHub API rate limit hit. Wait a few minutes before retrying."
        LOG_EXPIRED -> "The log download link has expired. Refresh and try again."
        LOG_NOT_READY -> "Logs are not available yet for this job."
        TRANSIENT -> "Temporary GitHub API error. Please try again."
        NETWORK -> "Network error while contacting GitHub."
        UNKNOWN -> "An unexpected error occurred while contacting GitHub."
    }
}

class GitHubApiException(
    val kind: GitHubErrorKind,
    message: String,
    val httpStatus: Int = 0,
    val retryAfterSeconds: Int? = null,
    cause: Throwable? = null,
) : RuntimeException(message, cause)
