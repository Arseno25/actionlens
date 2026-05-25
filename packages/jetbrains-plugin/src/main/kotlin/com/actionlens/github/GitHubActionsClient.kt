package com.actionlens.github

import com.google.gson.JsonElement
import com.google.gson.JsonParser
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Duration

/**
 * Minimal GitHub Actions REST client.
 *
 * Mirrors the contract of `@actionlens/core`'s `GitHubActionsApi` so the
 * JetBrains adapter can stay in pure Kotlin (no embedded JS runtime).
 */
class GitHubActionsClient(
    private val baseUrl: String = "https://api.github.com",
    private val tokenProvider: () -> String?,
    private val userAgent: String = "ActionLens-JetBrains",
    private val apiVersion: String = "2022-11-28",
    private val connectTimeout: Duration = Duration.ofSeconds(10),
    private val readTimeout: Duration = Duration.ofSeconds(30),
) {

    fun getWorkflowRuns(
        owner: String,
        repo: String,
        filters: WorkflowRunListFilters = WorkflowRunListFilters(),
    ): List<WorkflowRun> {
        val params = mutableListOf<Pair<String, String>>()
        filters.branch?.let { params += "branch" to it }
        filters.status?.let { params += "status" to it.name.lowercase() }
        filters.event?.let { params += "event" to it }
        filters.actor?.let { params += "actor" to it }
        params += "per_page" to filters.perPage.toString()
        filters.page?.let { params += "page" to it.toString() }

        val path = "/repos/${enc(owner)}/${enc(repo)}/actions/runs"
        val json = getJson(path + queryString(params))
        var runs = json.asJsonObject.getAsJsonArray("workflow_runs").map { mapRun(it) }
        filters.workflowName?.let { wanted -> runs = runs.filter { it.name?.equals(wanted, ignoreCase = true) == true } }
        filters.headSha?.let { sha -> runs = runs.filter { it.headSha == sha } }
        filters.conclusion?.let { c -> runs = runs.filter { it.conclusion == c } }
        return runs
    }

    fun getWorkflowRun(owner: String, repo: String, runId: Long): WorkflowRun =
        mapRun(getJson("/repos/${enc(owner)}/${enc(repo)}/actions/runs/$runId"))

    fun getJobsForRun(owner: String, repo: String, runId: Long): List<WorkflowJob> {
        val json = getJson("/repos/${enc(owner)}/${enc(repo)}/actions/runs/$runId/jobs?per_page=100")
        return json.asJsonObject.getAsJsonArray("jobs").map { mapJob(it) }
    }

    fun getJob(owner: String, repo: String, jobId: Long): WorkflowJob =
        mapJob(getJson("/repos/${enc(owner)}/${enc(repo)}/actions/jobs/$jobId"))

    fun downloadJobLog(owner: String, repo: String, jobId: Long): String =
        fetchRedirectedText("/repos/${enc(owner)}/${enc(repo)}/actions/jobs/$jobId/logs")

    fun downloadRunLogs(owner: String, repo: String, runId: Long): String =
        fetchRedirectedText("/repos/${enc(owner)}/${enc(repo)}/actions/runs/$runId/logs")

    // ----------------------------------------------------------------------
    // HTTP plumbing
    // ----------------------------------------------------------------------

    private fun getJson(pathAndQuery: String): JsonElement {
        val (status, body, _) = doRequest(pathAndQuery, followRedirects = true, withAuth = true)
        if (status !in 200..299) throw toException(status, emptyMap(), body)
        return JsonParser.parseString(body)
    }

    private fun fetchRedirectedText(pathAndQuery: String): String {
        // 1) GitHub call with auth, no auto-follow.
        val (status, _, headers) = doRequest(pathAndQuery, followRedirects = false, withAuth = true)
        if (status == 302 || status == 301 || status == 307) {
            val location = headers["location"] ?: headers["Location"]
                ?: throw GitHubApiException(GitHubErrorKind.UNKNOWN, "GitHub returned redirect without Location", status)
            // 2) Signed URL — no auth header. Never cache the URL.
            val (signedStatus, signedBody, _) = doAbsoluteRequest(location, withAuth = false)
            return when (signedStatus) {
                in 200..299 -> signedBody
                410, 403 -> throw GitHubApiException(GitHubErrorKind.LOG_EXPIRED, "Signed log URL expired", signedStatus)
                404 -> throw GitHubApiException(GitHubErrorKind.LOG_NOT_READY, "Log not available yet", signedStatus)
                else -> throw GitHubApiException(GitHubErrorKind.UNKNOWN, "Failed to download signed log URL", signedStatus)
            }
        }
        if (status == 404) throw GitHubApiException(GitHubErrorKind.LOG_NOT_READY, "Log not available yet", 404)
        if (status in 200..299) {
            // Some IDE HTTP stacks auto-follow — re-fetch body.
            val (_, body, _) = doRequest(pathAndQuery, followRedirects = true, withAuth = true)
            return body
        }
        throw toException(status, headers, "")
    }

    private fun doRequest(
        pathAndQuery: String,
        followRedirects: Boolean,
        withAuth: Boolean,
    ): Triple<Int, String, Map<String, String>> {
        val url = if (pathAndQuery.startsWith("http")) pathAndQuery
        else baseUrl.trimEnd('/') + (if (pathAndQuery.startsWith("/")) "" else "/") + pathAndQuery
        return doAbsoluteRequest(url, followRedirects = followRedirects, withAuth = withAuth)
    }

    private fun doAbsoluteRequest(
        url: String,
        followRedirects: Boolean = true,
        withAuth: Boolean = true,
    ): Triple<Int, String, Map<String, String>> {
        return try {
            val connection = (URI(url).toURL().openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                instanceFollowRedirects = followRedirects
                connectTimeout = this@GitHubActionsClient.connectTimeout.toMillis().toInt()
                readTimeout = this@GitHubActionsClient.readTimeout.toMillis().toInt()
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("X-GitHub-Api-Version", apiVersion)
                setRequestProperty("User-Agent", userAgent)
                if (withAuth) {
                    tokenProvider()?.takeIf { it.isNotBlank() }?.let {
                        setRequestProperty("Authorization", "Bearer $it")
                    }
                }
            }
            val status = connection.responseCode
            val body = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() } ?: ""
            val headers = connection.headerFields
                .filterKeys { it != null }
                .mapKeys { it.key.lowercase() }
                .mapValues { it.value.firstOrNull() ?: "" }
            if (status >= 400) throw toException(status, headers, body)
            Triple(status, body, headers)
        } catch (e: GitHubApiException) {
            throw e
        } catch (e: Exception) {
            throw GitHubApiException(GitHubErrorKind.NETWORK, "Network error while contacting GitHub", cause = e)
        }
    }

    private fun toException(status: Int, headers: Map<String, String>, body: String): GitHubApiException {
        val retryAfter = headers["retry-after"]?.toIntOrNull()
        val kind = when {
            status == 401 -> GitHubErrorKind.UNAUTHENTICATED
            status == 403 && headers["x-ratelimit-remaining"] == "0" -> GitHubErrorKind.RATE_LIMITED
            status == 403 -> GitHubErrorKind.FORBIDDEN
            status == 404 -> GitHubErrorKind.NOT_FOUND
            status == 429 -> GitHubErrorKind.RATE_LIMITED
            status in 500..599 -> GitHubErrorKind.TRANSIENT
            else -> GitHubErrorKind.UNKNOWN
        }
        // We deliberately do not include `body` in the message — it may contain reflected token fragments.
        return GitHubApiException(kind, "GitHub API responded with $status", status, retryAfter)
    }

    private fun enc(s: String): String = URLEncoder.encode(s, StandardCharsets.UTF_8)

    private fun queryString(params: List<Pair<String, String>>): String =
        if (params.isEmpty()) ""
        else "?" + params.joinToString("&") { (k, v) -> "${enc(k)}=${enc(v)}" }

    // ----------------------------------------------------------------------
    // JSON → domain
    // ----------------------------------------------------------------------

    private fun mapRun(json: JsonElement): WorkflowRun {
        val o = json.asJsonObject
        val actor = o.getAsJsonObject("actor")?.get("login")?.asStringOrNull
            ?: o.getAsJsonObject("triggering_actor")?.get("login")?.asStringOrNull
        return WorkflowRun(
            id = o.get("id").asLong,
            name = o.get("name").asStringOrNull,
            workflowId = o.get("workflow_id").asLong,
            headBranch = o.get("head_branch").asStringOrNull,
            headSha = o.get("head_sha").asString,
            event = o.get("event").asString,
            status = parseStatus(o.get("status").asStringOrNull),
            conclusion = WorkflowConclusion.fromApi(o.get("conclusion").asStringOrNull),
            runNumber = o.get("run_number").asInt,
            runAttempt = o.get("run_attempt").asInt,
            actor = actor,
            createdAt = o.get("created_at").asString,
            updatedAt = o.get("updated_at").asString,
            htmlUrl = o.get("html_url").asString,
        )
    }

    private fun mapJob(json: JsonElement): WorkflowJob {
        val o = json.asJsonObject
        val steps = o.getAsJsonArray("steps")?.map {
            val s = it.asJsonObject
            JobStep(
                name = s.get("name").asString,
                number = s.get("number").asInt,
                status = parseStatus(s.get("status").asStringOrNull),
                conclusion = WorkflowConclusion.fromApi(s.get("conclusion").asStringOrNull),
                startedAt = s.get("started_at").asStringOrNull,
                completedAt = s.get("completed_at").asStringOrNull,
            )
        } ?: emptyList()
        return WorkflowJob(
            id = o.get("id").asLong,
            runId = o.get("run_id").asLong,
            name = o.get("name").asString,
            status = parseStatus(o.get("status").asStringOrNull),
            conclusion = WorkflowConclusion.fromApi(o.get("conclusion").asStringOrNull),
            startedAt = o.get("started_at").asStringOrNull,
            completedAt = o.get("completed_at").asStringOrNull,
            runnerName = o.get("runner_name").asStringOrNull ?: o.get("runner_group_name").asStringOrNull,
            runnerOs = o.get("runner_os").asStringOrNull,
            htmlUrl = o.get("html_url").asString,
            steps = steps,
        )
    }

    private val JsonElement?.asStringOrNull: String?
        get() = this?.takeUnless { it.isJsonNull }?.asString
}
