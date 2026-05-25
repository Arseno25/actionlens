package com.actionlens.toolwindow

import com.actionlens.git.RepoContext
import com.actionlens.github.WorkflowJob
import com.actionlens.github.WorkflowRun
import com.intellij.icons.AllIcons
import com.intellij.ui.tree.BaseTreeModel
import javax.swing.Icon
import javax.swing.tree.TreePath

sealed class TreeNode {
    object Loading : TreeNode()
    data class Message(val text: String, val icon: Icon = AllIcons.General.Information) : TreeNode()
    data class Repo(val ctx: RepoContext, val runs: List<RunNode>) : TreeNode()
    data class RunNode(val ctx: RepoContext, val run: WorkflowRun, val children: List<TreeNode>) : TreeNode()
    data class JobNode(val ctx: RepoContext, val run: WorkflowRun, val job: WorkflowJob, val children: List<StepNode>) : TreeNode()
    data class StepNode(val ctx: RepoContext, val run: WorkflowRun, val job: WorkflowJob, val step: com.actionlens.github.JobStep) : TreeNode()
}

class WorkflowTreeModel : BaseTreeModel<TreeNode>() {

    private var root: TreeNode = TreeNode.Message("Detecting GitHub repository…")

    override fun getRoot(): TreeNode = root

    override fun getChildren(parent: Any?): List<TreeNode> = when (parent) {
        is TreeNode.Repo -> parent.runs
        is TreeNode.RunNode -> parent.children
        is TreeNode.JobNode -> parent.children
        else -> emptyList()
    }

    fun replaceRoot(newRoot: TreeNode) {
        root = newRoot
        treeStructureChanged(TreePath(root), null, null)
    }
}
