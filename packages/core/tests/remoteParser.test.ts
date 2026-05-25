import { describe, expect, it } from "vitest";
import { isGitHubDotCom, parseGitHubRemote } from "../src/git/remoteParser";

describe("parseGitHubRemote", () => {
  it("parses HTTPS with .git suffix", () => {
    expect(parseGitHubRemote("https://github.com/foo/bar.git")).toEqual({
      host: "github.com",
      owner: "foo",
      repo: "bar",
    });
  });

  it("parses HTTPS without .git suffix", () => {
    expect(parseGitHubRemote("https://github.com/foo/bar")).toEqual({
      host: "github.com",
      owner: "foo",
      repo: "bar",
    });
  });

  it("parses HTTPS with trailing slash", () => {
    expect(parseGitHubRemote("https://github.com/foo/bar/")).toEqual({
      host: "github.com",
      owner: "foo",
      repo: "bar",
    });
  });

  it("parses SSH (git@host:owner/repo)", () => {
    expect(parseGitHubRemote("git@github.com:foo/bar.git")).toEqual({
      host: "github.com",
      owner: "foo",
      repo: "bar",
    });
  });

  it("parses ssh:// URL", () => {
    expect(parseGitHubRemote("ssh://git@github.com/foo/bar.git")).toEqual({
      host: "github.com",
      owner: "foo",
      repo: "bar",
    });
  });

  it("parses git:// protocol", () => {
    expect(parseGitHubRemote("git://github.com/foo/bar.git")).toEqual({
      host: "github.com",
      owner: "foo",
      repo: "bar",
    });
  });

  it("recognises GHES hosts", () => {
    const r = parseGitHubRemote("https://ghe.example.com/foo/bar.git");
    expect(r).toEqual({ host: "ghe.example.com", owner: "foo", repo: "bar" });
    expect(isGitHubDotCom(r!)).toBe(false);
  });

  it("returns null for non-GitHub URLs that don't fit the shape", () => {
    expect(parseGitHubRemote("not a url")).toBeNull();
    expect(parseGitHubRemote("")).toBeNull();
    expect(parseGitHubRemote("https://github.com/")).toBeNull();
    expect(parseGitHubRemote("https://github.com/only-owner")).toBeNull();
  });

  it("normalises host casing", () => {
    expect(parseGitHubRemote("https://GitHub.com/foo/bar.git")?.host).toBe("github.com");
  });
});
