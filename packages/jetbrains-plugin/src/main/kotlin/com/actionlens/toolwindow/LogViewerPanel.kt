package com.actionlens.toolwindow

import com.actionlens.logs.LineSeverity
import com.actionlens.logs.LogParser
import com.actionlens.logs.ParsedLog
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.colors.EditorFontType
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileTypes.PlainTextFileType
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Font
import javax.swing.JComponent
import javax.swing.JPanel

class LogViewerPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val parser = LogParser()
    private val document: Document = EditorFactory.getInstance().createDocument("")
    private val editor: EditorEx = (EditorFactory.getInstance().createViewer(document, project) as EditorEx).apply {
        settings.isLineNumbersShown = true
        settings.isLineMarkerAreaShown = true
        settings.isFoldingOutlineShown = false
        component.font = colorsScheme.getFont(EditorFontType.PLAIN)
    }
    private val summaryLabel = JBLabel("Open a job in the ActionLens tool window.")
    private val filterField = JBTextField().apply { toolTipText = "Filter: jump to next line containing…" }

    private var currentParsed: ParsedLog? = null
    private var currentJobId: Long? = null
    private var currentRaw: String = ""

    init {
        val top = JPanel(BorderLayout()).apply {
            add(summaryLabel, BorderLayout.WEST)
            add(filterField, BorderLayout.EAST)
        }
        add(top, BorderLayout.NORTH)
        add(editor.component, BorderLayout.CENTER)

        filterField.addActionListener {
            val q = filterField.text?.takeIf { it.isNotBlank() } ?: return@addActionListener
            jumpToNextOccurrence(q)
        }

        Disposer.register(project) {
            EditorFactory.getInstance().releaseEditor(editor)
        }
    }

    fun loadingFor(displayName: String) {
        summaryLabel.text = "Downloading $displayName…"
        replaceText("Downloading $displayName…")
    }

    fun showError(message: String) {
        summaryLabel.text = "Error"
        replaceText("// ActionLens: $message")
    }

    fun show(rawLog: String, jobId: Long, displayName: String, errorHighlight: Boolean) {
        currentJobId = jobId
        currentRaw = rawLog
        val parsed = parser.parse(rawLog)
        currentParsed = parsed
        summaryLabel.text = "$displayName — ${parsed.summary}"
        replaceText(rawLog)
        if (errorHighlight) paintHighlights(parsed)
        parsed.firstErrorLine?.let { jumpToLine(it - 1) }
    }

    fun parsedOrNull(): ParsedLog? = currentParsed

    val component: JComponent get() = this

    private fun replaceText(text: String) {
        editor.markupModel.removeAllHighlighters()
        com.intellij.openapi.application.ApplicationManager.getApplication().runWriteAction {
            document.setText(text)
        }
    }

    private fun paintHighlights(parsed: ParsedLog) {
        val errorAttrs = TextAttributes().apply {
            backgroundColor = Color(0x55, 0x1C, 0x1C)
            fontType = Font.PLAIN
        }
        val warnAttrs = TextAttributes().apply {
            backgroundColor = Color(0x52, 0x44, 0x10)
            fontType = Font.PLAIN
        }
        for (line in parsed.lines) {
            val attrs = when (line.severity) {
                LineSeverity.ERROR -> errorAttrs
                LineSeverity.WARNING -> warnAttrs
                else -> continue
            }
            val lineIndex = line.number - 1
            if (lineIndex !in 0 until document.lineCount) continue
            val start = document.getLineStartOffset(lineIndex)
            val end = document.getLineEndOffset(lineIndex)
            editor.markupModel.addRangeHighlighter(
                start, end,
                HighlighterLayer.SELECTION - 1,
                attrs,
                HighlighterTargetArea.EXACT_RANGE,
            )
        }
    }

    private fun jumpToLine(lineIndex: Int) {
        if (lineIndex !in 0 until document.lineCount) return
        editor.caretModel.moveToOffset(document.getLineStartOffset(lineIndex))
        editor.scrollingModel.scrollToCaret(com.intellij.openapi.editor.ScrollType.CENTER)
    }

    private fun jumpToNextOccurrence(query: String) {
        val text = document.text
        val from = editor.caretModel.offset + 1
        val idx = text.indexOf(query, startIndex = from.coerceAtMost(text.length), ignoreCase = true)
            .takeIf { it >= 0 }
            ?: text.indexOf(query, ignoreCase = true).takeIf { it >= 0 } ?: return
        editor.caretModel.moveToOffset(idx)
        editor.scrollingModel.scrollToCaret(com.intellij.openapi.editor.ScrollType.CENTER)
    }

    // Marker constant kept for future Problems-view wiring.
    @Suppress("unused")
    private val attrKey = TextAttributesKey.createTextAttributesKey("ACTIONLENS_LOG_ERROR")
}
