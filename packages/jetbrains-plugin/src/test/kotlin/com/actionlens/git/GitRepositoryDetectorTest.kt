package com.actionlens.git

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class GitRepositoryDetectorParserTest {

    @Test fun `parses HTTPS with .git`() {
        assertEquals(
            GitHubRemote("github.com", "foo", "bar"),
            GitRepositoryDetector.parseRemote("https://github.com/foo/bar.git"),
        )
    }

    @Test fun `parses HTTPS without .git`() {
        assertEquals(
            GitHubRemote("github.com", "foo", "bar"),
            GitRepositoryDetector.parseRemote("https://github.com/foo/bar"),
        )
    }

    @Test fun `parses SSH form`() {
        assertEquals(
            GitHubRemote("github.com", "foo", "bar"),
            GitRepositoryDetector.parseRemote("git@github.com:foo/bar.git"),
        )
    }

    @Test fun `parses ssh url form`() {
        assertEquals(
            GitHubRemote("github.com", "foo", "bar"),
            GitRepositoryDetector.parseRemote("ssh://git@github.com/foo/bar"),
        )
    }

    @Test fun `recognises GHES host`() {
        assertEquals(
            GitHubRemote("ghe.example.com", "foo", "bar"),
            GitRepositoryDetector.parseRemote("https://ghe.example.com/foo/bar.git"),
        )
    }

    @Test fun `null for nonsense`() {
        assertNull(GitRepositoryDetector.parseRemote(""))
        assertNull(GitRepositoryDetector.parseRemote("not a url"))
        assertNull(GitRepositoryDetector.parseRemote("https://github.com/only-owner"))
    }
}
