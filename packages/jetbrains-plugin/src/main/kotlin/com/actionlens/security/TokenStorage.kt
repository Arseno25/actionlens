package com.actionlens.security

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.project.Project

/**
 * Token resolution order:
 *   1. Manual PAT in PasswordSafe (explicit user override)
 *   2. GitHub IDE account from the bundled GitHub plugin
 *   3. null  → unauthenticated (works for public repos, rate-limited)
 *
 * The token is never stored in plain XML or project settings.
 */
object TokenStorage {
    private const val USER = "github-token"

    private val attributes: CredentialAttributes =
        CredentialAttributes(generateServiceName("ActionLens", USER))

    enum class Source { MANUAL_PAT, IDE_GITHUB_ACCOUNT, NONE }

    data class Resolved(val token: String?, val source: Source)

    /** Backwards-compatible accessor used by the HTTP client. */
    fun get(project: Project? = null): String? = resolve(project).token

    fun resolve(project: Project? = null): Resolved {
        manualToken()?.let { return Resolved(it, Source.MANUAL_PAT) }
        GitHubPluginAuth.getToken(project)?.let { return Resolved(it, Source.IDE_GITHUB_ACCOUNT) }
        return Resolved(null, Source.NONE)
    }

    /** Read just the manually-stored PAT (for the settings dialog). */
    fun manualToken(): String? =
        PasswordSafe.instance.get(attributes)?.getPasswordAsString()?.takeIf { it.isNotBlank() }

    fun setManualToken(token: String?) {
        if (token.isNullOrBlank()) {
            PasswordSafe.instance.set(attributes, null)
            return
        }
        PasswordSafe.instance.set(attributes, Credentials(USER, token.trim()))
    }

    fun clearManualToken() = setManualToken(null)

    /** Convenience for the settings UI — describes where the active token came from. */
    fun describe(project: Project? = null): String = when (val r = resolve(project)) {
        Resolved(null, Source.NONE) -> "Not authenticated — public repos only (60 req/hour)."
        else -> when (r.source) {
            Source.MANUAL_PAT -> "Using a manual Personal Access Token from PasswordSafe."
            Source.IDE_GITHUB_ACCOUNT -> {
                val who = GitHubPluginAuth.describeActiveAccount(project) ?: "GitHub account"
                "Using IDE GitHub login: $who."
            }
            Source.NONE -> "Not authenticated."
        }
    }

    // ----------------------------------------------------------------
    // Deprecated shims kept temporarily so callers don't break.
    // ----------------------------------------------------------------
    @Deprecated("Use setManualToken", ReplaceWith("setManualToken(token)"))
    fun set(token: String?) = setManualToken(token)

    @Deprecated("Use clearManualToken", ReplaceWith("clearManualToken()"))
    fun clear() = clearManualToken()
}
