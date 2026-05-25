package com.actionlens.actions

import com.actionlens.toolwindow.ActionLensToolWindowFactory
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ActionUpdateThread

class OpenJobLogAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val panel = ActionLensToolWindowFactory.panel(project) ?: return
        val sel = panel.selectedJobNode() ?: return
        panel.loadLogAsync(sel)
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val panel = project?.let { ActionLensToolWindowFactory.panel(it) }
        e.presentation.isEnabled = panel?.selectedJobNode() != null
    }
}
