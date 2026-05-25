package com.actionlens.toolwindow

import com.actionlens.git.GitRepositoryDetector
import com.actionlens.git.RepoContext
import com.actionlens.github.GitHubActionsClient
import com.actionlens.github.GitHubApiException
import com.actionlens.github.WorkflowConclusion
import com.actionlens.github.WorkflowJob
import com.actionlens.github.WorkflowRun
import com.actionlens.github.WorkflowRunListFilters
import com.actionlens.github.WorkflowRunStatus
import com.actionlens.security.TokenStorage
import com.actionlens.settings.ActionLensSettings
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.DefaultActionGroup
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.ui.OnePixelSplitter
import com.intellij.ui.components.JBLabel
import com.intellij.ui.treeStructure.Tree
import com.intellij.util.ui.tree.TreeUtil
import java.awt.BorderLayout
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeCellRenderer
import javax.swing.tree.DefaultTreeModel

class ActionLensPanel(private val project: Project) : SimpleToolWindowPanel(true, true) {

    private val treeModel = DefaultTreeModel(DefaultMutableTreeNode("ActionLens"))
    private val tree = Tree(treeModel).apply {
        isRootVisible = true
        cellRenderer = ActionLensTreeRenderer()
    }
    private val logViewer = LogViewerPanel(project)
    private val statusLabel = JBLabel(" ").apply { border = javax.swing.BorderFactory.createEmptyBorder(2, 8, 2, 8) }

    @Volatile private var repo: RepoContext? = null

    init {
        val splitter = OnePixelSplitter(false, 0.4f).apply {
            firstComponent = JPanel(BorderLayout()).apply { add(tree.let { com.intellij.ui.ScrollPaneFactory.createScrollPane(it) }, BorderLayout.CENTER) }
            secondComponent = logViewer.component
        }
        setContent(JPanel(BorderLayout()).apply {
            add(splitter, BorderLayout.CENTER)
            add(statusLabel, BorderLayout.SOUTH)
        })

        val group = DefaultActionGroup().apply {
            add(ActionManager.getInstance().getAction("ActionLens.Refresh"))
            addSeparator()
            add(ActionManager.getInstance().getAction("ActionLens.OpenJobLog"))
            add(ActionManager.getInstance().getAction("ActionLens.OpenInGithub"))
            addSeparator()
            add(ActionManager.getInstance().getAction("ActionLens.CopyErrorSnippet"))
            add(ActionManager.getInstance().getAction("ActionLens.CopyAiDebugPrompt"))
        }
        val toolbar = ActionManager.getInstance().createActionToolbar(ActionPlaces.TOOLWINDOW_CONTENT, group, true)
        toolbar.targetComponent = this
        setToolbar(toolbar.component)

        tree.addTreeSelectionListener { /* selection feeds the action update */ }
        tree.addMouseListener(object : java.awt.event.MouseAdapter() {
            override fun mouseClicked(e: java.awt.event.MouseEvent) {
                if (e.clickCount == 2) openSelectedJobLog()
            }
        })

        // Register once — adding inside populateRuns would leak listeners across refreshes.
        tree.addTreeWillExpandListener(object : javax.swing.event.TreeWillExpandListener {
            override fun treeWillExpand(event: javax.swing.event.TreeExpansionEvent) {
                val node = event.path.lastPathComponent as? DefaultMutableTreeNode ?: return
                val userObject = node.userObject as? RunSelection ?: return
                if (node.childCount == 1 && (node.firstChild as? DefaultMutableTreeNode)?.userObject == "Loading jobs…") {
                    loadJobsAsync(userObject, node)
                }
            }
            override fun treeWillCollapse(event: javax.swing.event.TreeExpansionEvent) = Unit
        })

        refresh()
    }

    fun refresh() {
        repo = GitRepositoryDetector.detect(project)
        val ctx = repo
        if (ctx == null) {
            treeModel.setRoot(null)
            treeModel.reload()
            tree.emptyText.clear()
            tree.emptyText.text = "No GitHub repository detected. Make sure this project has an origin remote pointing to GitHub."
            statusLabel.text = " "
            return
        }
        
        val resolved = TokenStorage.resolve(project)
        val isSignedIn = !resolved.token.isNullOrBlank()
        
        if (!isSignedIn) {
            treeModel.setRoot(null)
            treeModel.reload()
            tree.emptyText.clear()
            tree.emptyText.text = "You need to authenticate to access GitHub Actions."
            tree.emptyText.appendSecondaryText("Sign in with GitHub", com.intellij.ui.SimpleTextAttributes.LINK_ATTRIBUTES) {
                com.intellij.openapi.options.ShowSettingsUtil.getInstance().showSettingsDialog(project, "settings.github")
                refresh()
            }
            tree.emptyText.appendSecondaryText("   Enter Token Manually", com.intellij.ui.SimpleTextAttributes.LINK_ATTRIBUTES) {
                val token = com.intellij.openapi.ui.Messages.showPasswordDialog(
                    project, 
                    "Paste a GitHub Personal Access Token:", 
                    "ActionLens — GitHub Token", 
                    null
                )
                if (!token.isNullOrBlank()) {
                    TokenStorage.setManualToken(token)
                    refresh()
                }
            }
            statusLabel.text = "Not signed in."
            return
        }

        statusLabel.text = "${ctx.remote.host} • ${ctx.remote.owner}/${ctx.remote.repo} • branch ${ctx.branch ?: "—"} • ${TokenStorage.describe(project)}"
        
        tree.emptyText.clear()
        tree.emptyText.text = "Loading workflow runs…"
        treeModel.setRoot(null)
        treeModel.reload()
        
        loadRunsAsync(ctx)
    }

    fun selectedJobNode(): JobSelection? {
        val node = (tree.lastSelectedPathComponent as? DefaultMutableTreeNode)?.userObject ?: return null
        return when (node) {
            is JobSelection -> node
            else -> null
        }
    }

    fun selectedRunNode(): RunSelection? {
        val node = (tree.lastSelectedPathComponent as? DefaultMutableTreeNode)?.userObject ?: return null
        return node as? RunSelection
    }

    private fun openSelectedJobLog() {
        val sel = selectedJobNode() ?: return
        loadLogAsync(sel)
    }

    fun loadLogAsync(sel: JobSelection) {
        logViewer.loadingFor(sel.job.name)
        val ctx = sel.repo
        val client = buildClient()
        val settings = ActionLensSettings.getInstance().state
        runBackground("Downloading log: ${sel.job.name}") {
            try {
                val text = client.downloadJobLog(ctx.remote.owner, ctx.remote.repo, sel.job.id)
                ApplicationManager.getApplication().invokeLater {
                    logViewer.show(text, sel.job.id, sel.job.name, settings.errorHighlightEnabled)
                }
            } catch (e: GitHubApiException) {
                ApplicationManager.getApplication().invokeLater {
                    logViewer.showError(e.kind.userMessage(e.retryAfterSeconds))
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    logViewer.showError(e.message ?: "Unknown error")
                }
            }
        }
    }

    fun viewer(): LogViewerPanel = logViewer

    fun buildClient(): GitHubActionsClient = GitHubActionsClient(
        baseUrl = ActionLensSettings.getInstance().state.githubBaseUrl,
        tokenProvider = { TokenStorage.get(project) },
    )

    private fun loadRunsAsync(ctx: RepoContext) {
        val client = buildClient()
        val settings = ActionLensSettings.getInstance().state
        val filters = WorkflowRunListFilters(
            branch = if (settings.defaultBranchOnly) ctx.branch else null,
            headSha = if (settings.matchCurrentCommit) ctx.commitSha else null,
            perPage = settings.maxRuns,
        )
        runBackground("Loading workflow runs") {
            try {
                val runs = client.getWorkflowRuns(ctx.remote.owner, ctx.remote.repo, filters)
                ApplicationManager.getApplication().invokeLater {
                    populateRuns(ctx, runs.sortedWith(failedFirst()))
                }
            } catch (e: GitHubApiException) {
                ApplicationManager.getApplication().invokeLater {
                    setRootMessage(e.kind.userMessage(e.retryAfterSeconds))
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    setRootMessage(e.message ?: "Unknown error")
                }
            }
        }
    }

    private fun populateRuns(ctx: RepoContext, runs: List<WorkflowRun>) {
        val root = DefaultMutableTreeNode("${ctx.remote.owner}/${ctx.remote.repo}")
        if (runs.isEmpty()) {
            root.add(DefaultMutableTreeNode("No workflow runs found for the current filters."))
        } else {
            for (run in runs) {
                val runNode = DefaultMutableTreeNode(RunSelection(ctx, run))
                runNode.add(DefaultMutableTreeNode("Loading jobs…"))
                root.add(runNode)
            }
        }
        treeModel.setRoot(root)
        treeModel.reload()
        TreeUtil.expand(tree, 1)
    }

    private fun loadJobsAsync(sel: RunSelection, node: DefaultMutableTreeNode) {
        val client = buildClient()
        runBackground("Loading jobs for run #${sel.run.runNumber}") {
            try {
                val jobs = client.getJobsForRun(sel.repo.remote.owner, sel.repo.remote.repo, sel.run.id)
                ApplicationManager.getApplication().invokeLater {
                    node.removeAllChildren()
                    if (jobs.isEmpty()) {
                        node.add(DefaultMutableTreeNode("Workflow run has no jobs yet."))
                    } else {
                        jobs.sortedBy { if (it.conclusion == WorkflowConclusion.FAILURE) 0 else 1 }.forEach { job ->
                            val jobNode = DefaultMutableTreeNode(JobSelection(sel.repo, sel.run, job))
                            for (step in job.steps) {
                                jobNode.add(DefaultMutableTreeNode(StepSelection(step)))
                            }
                            node.add(jobNode)
                        }
                    }
                    treeModel.reload(node)
                }
            } catch (e: GitHubApiException) {
                ApplicationManager.getApplication().invokeLater {
                    node.removeAllChildren()
                    node.add(DefaultMutableTreeNode(e.kind.userMessage(e.retryAfterSeconds)))
                    treeModel.reload(node)
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    node.removeAllChildren()
                    node.add(DefaultMutableTreeNode(e.message ?: "Unknown error"))
                    treeModel.reload(node)
                }
            }
        }
    }

    private fun setRootMessage(message: String) {
        val root = DefaultMutableTreeNode("ActionLens")
        root.add(DefaultMutableTreeNode(message))
        treeModel.setRoot(root)
        treeModel.reload()
        TreeUtil.expandAll(tree)
    }

    private fun failedFirst(): Comparator<WorkflowRun> = Comparator { a, b ->
        val af = if (a.conclusion == WorkflowConclusion.FAILURE) 0 else 1
        val bf = if (b.conclusion == WorkflowConclusion.FAILURE) 0 else 1
        if (af != bf) af - bf
        else b.updatedAt.compareTo(a.updatedAt)
    }

    private fun runBackground(title: String, work: () -> Unit) {
        com.intellij.openapi.progress.ProgressManager.getInstance().run(object : Task.Backgroundable(project, title, true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.isIndeterminate = true
                work()
            }
        })
    }

    data class RunSelection(val repo: RepoContext, val run: WorkflowRun)
    data class JobSelection(val repo: RepoContext, val run: WorkflowRun, val job: WorkflowJob)
    data class StepSelection(val step: com.actionlens.github.JobStep)
}

private class ActionLensTreeRenderer : DefaultTreeCellRenderer() {
    override fun getTreeCellRendererComponent(
        tree: javax.swing.JTree?,
        value: Any?,
        sel: Boolean,
        expanded: Boolean,
        leaf: Boolean,
        row: Int,
        hasFocus: Boolean,
    ): java.awt.Component {
        super.getTreeCellRendererComponent(tree, value, sel, expanded, leaf, row, hasFocus)
        val node = (value as? DefaultMutableTreeNode)?.userObject
        when (node) {
            is ActionLensPanel.RunSelection -> {
                text = "${node.run.name ?: "Run"} #${node.run.runNumber} • ${node.run.event}"
                icon = iconFor(node.run.status, node.run.conclusion)
            }
            is ActionLensPanel.JobSelection -> {
                text = node.job.name
                icon = iconFor(node.job.status, node.job.conclusion)
            }
            is ActionLensPanel.StepSelection -> {
                text = "${node.step.number}. ${node.step.name}"
                icon = iconFor(node.step.status, node.step.conclusion)
            }
            is String -> {
                text = node
                icon = AllIcons.General.Information
            }
        }
        return this
    }

    private fun iconFor(status: WorkflowRunStatus, conclusion: WorkflowConclusion?): javax.swing.Icon = when (status) {
        WorkflowRunStatus.QUEUED -> AllIcons.Actions.Pause
        WorkflowRunStatus.IN_PROGRESS -> AllIcons.Process.Step_passive
        WorkflowRunStatus.COMPLETED -> when (conclusion) {
            WorkflowConclusion.SUCCESS -> AllIcons.RunConfigurations.TestPassed
            WorkflowConclusion.FAILURE -> AllIcons.RunConfigurations.TestFailed
            WorkflowConclusion.CANCELLED -> AllIcons.Actions.Cancel
            WorkflowConclusion.SKIPPED -> AllIcons.RunConfigurations.TestIgnored
            WorkflowConclusion.TIMED_OUT -> AllIcons.RunConfigurations.TestError
            WorkflowConclusion.ACTION_REQUIRED -> AllIcons.General.Warning
            WorkflowConclusion.NEUTRAL -> AllIcons.RunConfigurations.TestUnknown
            null -> AllIcons.RunConfigurations.TestUnknown
        }
    }
}
