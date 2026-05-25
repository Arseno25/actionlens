import type { GitHubRemote } from "./types";

const HTTPS = /^https?:\/\/(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?\/?$/i;
const SSH = /^git@(?<host>[^:]+):(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?\/?$/i;
const GIT_PROTO = /^git:\/\/(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?\/?$/i;
const SSH_URL = /^ssh:\/\/git@(?<host>[^/]+)\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?\/?$/i;

/**
 * Parse a GitHub remote URL into { host, owner, repo }.
 * Returns null for anything that is not recognisably a GitHub-style remote.
 */
export function parseGitHubRemote(url: string): GitHubRemote | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  for (const pattern of [HTTPS, SSH_URL, SSH, GIT_PROTO]) {
    const match = pattern.exec(trimmed);
    if (match?.groups) {
      const host = match.groups.host!.toLowerCase();
      const owner = match.groups.owner!;
      const repo = match.groups.repo!;
      if (!owner || !repo) continue;
      return { host, owner, repo };
    }
  }
  return null;
}

/** True if the parsed remote points at github.com (i.e. not a GHES host). */
export function isGitHubDotCom(remote: GitHubRemote): boolean {
  return remote.host === "github.com";
}
