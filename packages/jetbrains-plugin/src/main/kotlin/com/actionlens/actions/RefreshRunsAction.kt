package com.actionlens.actions

import com.actionlens.toolwindow.ActionLensToolWindowFactory
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class RefreshRunsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        ActionLensToolWindowFactory.panel(project)?.refresh()
    }
}
