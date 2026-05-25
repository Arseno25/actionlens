package com.actionlens.logs

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LogParserTest {

    private val parser = LogParser(contextLines = 1)

    @Test
    fun `clean log yields no errors`() {
        val parsed = parser.parse("Hello\nworld\nDone.")
        assertEquals(emptyList(), parsed.errorLineNumbers)
        assertNull(parsed.firstErrorLine)
    }

    @Test
    fun `npm error is detected`() {
        val parsed = parser.parse("npm ERR! code ELIFECYCLE\nDone.")
        assertEquals(listOf(1), parsed.errorLineNumbers)
        assertEquals(1, parsed.firstErrorLine)
    }

    @Test
    fun `typescript error is detected`() {
        val parsed = parser.parse("src/foo.ts(10,5): error TS2304: Cannot find name 'bar'.")
        assertTrue(parsed.errorLineNumbers.isNotEmpty())
    }

    @Test
    fun `sqlstate is detected as error`() {
        val parsed = parser.parse("SQLSTATE[HY000] [2002] Connection refused")
        assertNotNull(parsed.firstErrorLine)
    }

    @Test
    fun `timestamps are stripped before classification`() {
        val parsed = parser.parse("2026-01-02T03:04:05.678Z npm ERR! boom")
        assertEquals(listOf(1), parsed.errorLineNumbers)
    }
}

class LogSanitiserTest {
    @Test
    fun `masks GitHub token`() {
        val masked = LogSanitiser.sanitise("token=ghp_abcdefghijklmnopqrstuvwxyz0123456789")
        assertTrue(!masked.contains("ghp_abcdefghijklmnopqrstuvwxyz0123456789"))
    }

    @Test
    fun `masks bearer header`() {
        val masked = LogSanitiser.sanitise("Authorization: Bearer abc.def.ghi")
        assertTrue(!masked.contains("abc.def.ghi"))
    }

    @Test
    fun `masks AWS access key`() {
        val masked = LogSanitiser.sanitise("aws_access_key_id=AKIAIOSFODNN7EXAMPLE")
        assertTrue(!masked.contains("AKIAIOSFODNN7EXAMPLE"))
    }
}
