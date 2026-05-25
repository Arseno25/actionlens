package com.actionlens.actions

import com.actionlens.github.WorkflowConclusion
import com.actionlens.logs.AiDebugPrompt
import com.actionlens.logs.AiDebugPromptInput
import com.actionlens.toolwindow.ActionLensToolWindowFactory
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.ui.Messages
import java.awt.datatransfer.StringSelection

class CopyAiDebugPromptAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val panel = ActionLensToolWindowFactory.panel(project) ?: return
        val sel = panel.selectedJobNode()
        if (sel == null) {
            Messages.showInfoMessage(project, "Select a job in the ActionLens tool window first.", "ActionLens")
            return
        }
        val parsed = panel.viewer().parsedOrNull()
        val failedStep = sel.job.steps.firstOrNull { it.conclusion == WorkflowConclusion.FAILURE }?.name
        val prompt = AiDebugPrompt.create(
            AiDebugPromptInput(
                repository = "${sel.repo.remote.owner}/${sel.repo.remote.repo}",
                branch = sel.run.headBranch,
                commitSha = sel.run.headSha,
                workflowName = sel.run.name,
                jobName = sel.job.name,
                failedStepName = failedStep,
                parsedLog = parsed,
            )
        )
        CopyPasteManager.getInstance().setContents(StringSelection(prompt))
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val panel = project?.let { ActionLensToolWindowFactory.panel(it) }
        e.presentation.isEnabled = panel?.selectedJobNode() != null
    }
}
