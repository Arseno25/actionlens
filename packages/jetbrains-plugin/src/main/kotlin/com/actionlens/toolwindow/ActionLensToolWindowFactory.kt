package com.actionlens.toolwindow

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class ActionLensToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = ActionLensPanel(project)
        // Stash on the tool window for the actions to find.
        project.putUserData(PANEL_KEY, panel)
        val content = ContentFactory.getInstance().createContent(panel.component, "", false)
        toolWindow.contentManager.addContent(content)
    }

    companion object {
        val PANEL_KEY = com.intellij.openapi.util.Key.create<ActionLensPanel>("ActionLens.Panel")

        fun panel(project: Project): ActionLensPanel? = project.getUserData(PANEL_KEY)
    }
}
