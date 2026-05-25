package com.actionlens.actions

import com.actionlens.toolwindow.ActionLensToolWindowFactory
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages

class OpenInGithubAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val panel = ActionLensToolWindowFactory.panel(project) ?: return
        val job = panel.selectedJobNode()
        if (job != null) {
            BrowserUtil.browse(job.job.htmlUrl)
            return
        }
        val run = panel.selectedRunNode()
        if (run != null) {
            BrowserUtil.browse(run.run.htmlUrl)
            return
        }
        Messages.showInfoMessage(project, "Select a run or job first.", "ActionLens")
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val panel = project?.let { ActionLensToolWindowFactory.panel(it) }
        val enabled = panel?.selectedJobNode() != null || panel?.selectedRunNode() != null
        e.presentation.isEnabled = enabled
    }
}
