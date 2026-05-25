package com.actionlens.settings

import com.actionlens.security.TokenStorage
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.ProjectManager
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.UIUtil
import javax.swing.JComponent
import javax.swing.JPanel

class ActionLensConfigurable : Configurable {

    private val authStatusLabel = JBLabel().apply { foreground = UIUtil.getContextHelpForeground() }
    private val tokenField = JBPasswordField().apply { columns = 32 }
    private val tokenHelp = JBLabel(
        "Leave blank to use the GitHub account you're signed into via " +
            "Settings → Version Control → GitHub."
    ).apply { foreground = UIUtil.getContextHelpForeground() }

    private val baseUrlField = JBTextField(32)
    private val autoRefreshCheck = JBCheckBox("Enable auto-refresh for in-progress runs")
    private val intervalField = JBTextField(6)
    private val defaultBranchOnlyCheck = JBCheckBox("Only show runs for the current branch")
    private val matchCommitCheck = JBCheckBox("Only show runs for the current commit SHA")
    private val maxRunsField = JBTextField(6)
    private val logMaxLinesField = JBTextField(8)
    private val errorHighlightCheck = JBCheckBox("Highlight detected error lines in logs")

    private var panel: JPanel? = null
    private var initialToken: String = ""

    override fun getDisplayName(): String = "ActionLens"

    override fun createComponent(): JComponent {
        initialToken = TokenStorage.manualToken().orEmpty()
        tokenField.text = initialToken
        refreshAuthStatus()

        val state = ActionLensSettings.getInstance().state
        baseUrlField.text = state.githubBaseUrl
        autoRefreshCheck.isSelected = state.autoRefreshEnabled
        intervalField.text = state.autoRefreshIntervalSeconds.toString()
        defaultBranchOnlyCheck.isSelected = state.defaultBranchOnly
        matchCommitCheck.isSelected = state.matchCurrentCommit
        maxRunsField.text = state.maxRuns.toString()
        logMaxLinesField.text = state.logMaxLines.toString()
        errorHighlightCheck.isSelected = state.errorHighlightEnabled

        panel = FormBuilder.createFormBuilder()
            .addComponent(authStatusLabel)
            .addLabeledComponent("Manual GitHub PAT:", tokenField, 1, false)
            .addComponent(tokenHelp)
            .addSeparator()
            .addLabeledComponent("API base URL:", baseUrlField, 1, false)
            .addComponent(autoRefreshCheck)
            .addLabeledComponent("Refresh interval (seconds):", intervalField, 1, false)
            .addComponent(defaultBranchOnlyCheck)
            .addComponent(matchCommitCheck)
            .addLabeledComponent("Max runs to show:", maxRunsField, 1, false)
            .addLabeledComponent("Max log lines:", logMaxLinesField, 1, false)
            .addComponent(errorHighlightCheck)
            .addComponentFillVertically(JPanel(), 0)
            .panel
        return panel!!
    }

    private fun refreshAuthStatus() {
        val project = ProjectManager.getInstance().openProjects.firstOrNull()
        authStatusLabel.text = "Active auth: ${TokenStorage.describe(project)}"
    }

    override fun isModified(): Boolean {
        val s = ActionLensSettings.getInstance().state
        val tokenNow = String(tokenField.password)
        return tokenNow != initialToken
            || baseUrlField.text != s.githubBaseUrl
            || autoRefreshCheck.isSelected != s.autoRefreshEnabled
            || intervalField.text.toIntOrNull() != s.autoRefreshIntervalSeconds
            || defaultBranchOnlyCheck.isSelected != s.defaultBranchOnly
            || matchCommitCheck.isSelected != s.matchCurrentCommit
            || maxRunsField.text.toIntOrNull() != s.maxRuns
            || logMaxLinesField.text.toIntOrNull() != s.logMaxLines
            || errorHighlightCheck.isSelected != s.errorHighlightEnabled
    }

    override fun apply() {
        val s = ActionLensSettings.getInstance().state
        s.githubBaseUrl = baseUrlField.text.trim().ifBlank { "https://api.github.com" }
        s.autoRefreshEnabled = autoRefreshCheck.isSelected
        s.autoRefreshIntervalSeconds = intervalField.text.toIntOrNull()?.coerceAtLeast(5) ?: 15
        s.defaultBranchOnly = defaultBranchOnlyCheck.isSelected
        s.matchCurrentCommit = matchCommitCheck.isSelected
        s.maxRuns = maxRunsField.text.toIntOrNull()?.coerceIn(1, 100) ?: 25
        s.logMaxLines = logMaxLinesField.text.toIntOrNull()?.coerceAtLeast(100) ?: 5000
        s.errorHighlightEnabled = errorHighlightCheck.isSelected

        val token = String(tokenField.password)
        if (token != initialToken) {
            TokenStorage.setManualToken(token.ifBlank { null })
            initialToken = token
        }
        refreshAuthStatus()
    }

    override fun reset() {
        createComponent()
    }
}
