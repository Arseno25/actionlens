package com.actionlens.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * Non-sensitive ActionLens settings. The GitHub token is **never** kept here;
 * it lives in [com.actionlens.security.TokenStorage].
 */
@Service(Service.Level.APP)
@State(name = "ActionLensSettings", storages = [Storage("actionlens.xml")])
class ActionLensSettings : PersistentStateComponent<ActionLensSettings.State> {

    data class State(
        var autoRefreshEnabled: Boolean = false,
        var autoRefreshIntervalSeconds: Int = 15,
        var defaultBranchOnly: Boolean = false,
        var matchCurrentCommit: Boolean = false,
        var maxRuns: Int = 25,
        var logMaxLines: Int = 5000,
        var errorHighlightEnabled: Boolean = true,
        var githubBaseUrl: String = "https://api.github.com",
    )

    private var state = State()

    override fun getState(): State = state
    override fun loadState(state: State) = XmlSerializerUtil.copyBean(state, this.state)

    companion object {
        fun getInstance(): ActionLensSettings = ApplicationManager.getApplication().getService(ActionLensSettings::class.java)
    }
}
