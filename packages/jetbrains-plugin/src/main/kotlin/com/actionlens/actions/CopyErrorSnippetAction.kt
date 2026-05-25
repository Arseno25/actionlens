package com.actionlens.actions

import com.actionlens.logs.LogSanitiser
import com.actionlens.toolwindow.ActionLensToolWindowFactory
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.ui.Messages
import java.awt.datatransfer.StringSelection

class CopyErrorSnippetAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val panel = ActionLensToolWindowFactory.panel(project) ?: return
        val parsed = panel.viewer().parsedOrNull()
        if (parsed == null) {
            Messages.showInfoMessage(project, "Open a job log first.", "ActionLens")
            return
        }
        val snippet = parsed.errorBlocks.firstOrNull()?.preview ?: parsed.summary
        CopyPasteManager.getInstance().setContents(StringSelection(LogSanitiser.sanitise(snippet)))
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val panel = project?.let { ActionLensToolWindowFactory.panel(it) }
        e.presentation.isEnabled = panel?.viewer()?.parsedOrNull() != null
    }
}
