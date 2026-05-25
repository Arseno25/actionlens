package com.actionlens.security

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.project.Project
import kotlinx.coroutines.runBlocking
import org.jetbrains.plugins.github.authentication.GHAccountsUtil
import org.jetbrains.plugins.github.authentication.accounts.GHAccountManager
import org.jetbrains.plugins.github.authentication.accounts.GithubAccount

/**
 * Reuses the user's GitHub login from JetBrains' bundled GitHub plugin
 * (`org.jetbrains.plugins.github`).
 *
 * Wrapped in try/catch + class-loader guard because the GitHub plugin is
 * declared *optional* in plugin.xml — it might be disabled or the API may
 * have shifted between platform versions. On failure we fall back silently
 * so the manual-PAT path still works.
 */
object GitHubPluginAuth {

    private val LOG = logger<GitHubPluginAuth>()

    /** True if the bundled GitHub plugin is loaded and reachable. */
    val isAvailable: Boolean by lazy {
        try {
            Class.forName(
                "org.jetbrains.plugins.github.authentication.accounts.GHAccountManager",
                false,
                this::class.java.classLoader,
            )
            true
        } catch (_: Throwable) {
            false
        }
    }

    /**
     * Try to get a token, optionally preferring the project's default account.
     * Returns null if the GitHub plugin isn't available, no account is logged
     * in, or credentials can't be retrieved. **Must be called off the EDT** —
     * `runBlocking` is used to bridge the suspending findCredentials API.
     */
    fun getToken(project: Project? = null): String? {
        if (!isAvailable) return null
        return runSafely {
            val account = pickAccount(project) ?: return@runSafely null
            val manager = service<GHAccountManager>()
            runBlocking { manager.findCredentials(account) }?.takeIf { it.isNotBlank() }
        }
    }

    /** Human-readable description of the active account (for the settings UI). */
    fun describeActiveAccount(project: Project? = null): String? {
        if (!isAvailable) return null
        return runSafely {
            val account = pickAccount(project) ?: return@runSafely null
            val host = account.server.toString().removePrefix("https://").removeSuffix("/")
            "${account.name} ($host)"
        }
    }

    private fun pickAccount(project: Project?): GithubAccount? = runSafely {
        if (project != null) {
            GHAccountsUtil.getDefaultAccount(project)?.let { return@runSafely it }
        }
        GHAccountsUtil.accounts.firstOrNull()
    }

    private inline fun <T> runSafely(block: () -> T?): T? = try {
        if (ApplicationManager.getApplication().isUnitTestMode) null else block()
    } catch (t: Throwable) {
        // GitHub plugin's API has shifted between platform versions — silent fallback.
        LOG.debug("GitHub plugin auth unavailable: ${t.javaClass.simpleName}: ${t.message}")
        null
    }
}
