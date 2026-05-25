package com.actionlens.git

import com.intellij.openapi.project.Project
import git4idea.repo.GitRepositoryManager

data class GitHubRemote(val host: String, val owner: String, val repo: String)
data class RepoContext(val remote: GitHubRemote, val branch: String?, val commitSha: String?)

object GitRepositoryDetector {

    private val HTTPS = Regex("""^https?://(?<host>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+?)(?:\.git)?/?$""", RegexOption.IGNORE_CASE)
    private val SSH = Regex("""^git@(?<host>[^:]+):(?<owner>[^/]+)/(?<repo>[^/]+?)(?:\.git)?/?$""", RegexOption.IGNORE_CASE)
    private val SSH_URL = Regex("""^ssh://git@(?<host>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+?)(?:\.git)?/?$""", RegexOption.IGNORE_CASE)
    private val GIT_PROTO = Regex("""^git://(?<host>[^/]+)/(?<owner>[^/]+)/(?<repo>[^/]+?)(?:\.git)?/?$""", RegexOption.IGNORE_CASE)

    fun parseRemote(url: String?): GitHubRemote? {
        if (url.isNullOrBlank()) return null
        val trimmed = url.trim()
        listOf(HTTPS, SSH_URL, SSH, GIT_PROTO).forEach { pattern ->
            pattern.matchEntire(trimmed)?.let { match ->
                val host = match.groups["host"]!!.value.lowercase()
                val owner = match.groups["owner"]!!.value
                val repo = match.groups["repo"]!!.value
                if (owner.isNotEmpty() && repo.isNotEmpty()) return GitHubRemote(host, owner, repo)
            }
        }
        return null
    }

    /**
     * Use the bundled Git4Idea integration to find the first repository in the
     * project that has a GitHub-shaped origin remote.
     */
    fun detect(project: Project): RepoContext? {
        val repositories = GitRepositoryManager.getInstance(project).repositories
        for (gitRepo in repositories) {
            val origin = gitRepo.remotes.firstOrNull { it.name == "origin" } ?: gitRepo.remotes.firstOrNull()
            val url = origin?.firstUrl ?: continue
            val remote = parseRemote(url) ?: continue
            val branch = gitRepo.currentBranch?.name
            val sha = gitRepo.currentRevision
            return RepoContext(remote, branch, sha)
        }
        return null
    }
}
