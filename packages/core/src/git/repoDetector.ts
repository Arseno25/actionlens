import { promises as fs } from "node:fs";
import * as path from "node:path";
import { parseGitHubRemote } from "./remoteParser";
import type { RepoContext } from "./types";

/**
 * Walk up from `startDir` looking for a `.git` folder. Returns the directory
 * containing `.git`, or null if none found before reaching the filesystem root.
 */
export async function findGitRoot(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);
  // Up to 64 levels — plenty for any realistic project tree.
  for (let i = 0; i < 64; i++) {
    try {
      const stat = await fs.stat(path.join(current, ".git"));
      if (stat.isDirectory() || stat.isFile()) return current;
    } catch {
      // not here, keep walking
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/**
 * Parse `.git/config` for the URL of the named remote (default: origin).
 * Returns null if the remote isn't declared.
 */
export async function readOriginUrl(gitRoot: string, remoteName = "origin"): Promise<string | null> {
  const configPath = path.join(gitRoot, ".git", "config");
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch {
    return null;
  }
  const sectionHeader = `[remote "${remoteName}"]`;
  const lines = raw.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inSection = trimmed === sectionHeader;
      continue;
    }
    if (inSection && trimmed.toLowerCase().startsWith("url")) {
      const eq = trimmed.indexOf("=");
      if (eq > -1) return trimmed.slice(eq + 1).trim();
    }
  }
  return null;
}

/** Resolve HEAD → either a branch name, a commit SHA, or both when possible. */
export async function readHead(gitRoot: string): Promise<{ branch: string | null; commitSha: string | null }> {
  const headPath = path.join(gitRoot, ".git", "HEAD");
  let head: string;
  try {
    head = (await fs.readFile(headPath, "utf8")).trim();
  } catch {
    return { branch: null, commitSha: null };
  }

  if (head.startsWith("ref: ")) {
    const ref = head.slice("ref: ".length).trim();
    const branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
    let commitSha: string | null = null;
    try {
      commitSha = (await fs.readFile(path.join(gitRoot, ".git", ref), "utf8")).trim();
    } catch {
      // packed-refs fallback
      try {
        const packed = await fs.readFile(path.join(gitRoot, ".git", "packed-refs"), "utf8");
        for (const line of packed.split(/\r?\n/)) {
          if (line.startsWith("#")) continue;
          const [sha, packedRef] = line.split(" ");
          if (packedRef === ref && sha) {
            commitSha = sha;
            break;
          }
        }
      } catch {
        // ignore
      }
    }
    return { branch, commitSha };
  }

  // Detached HEAD — `head` is the SHA itself.
  return { branch: null, commitSha: head };
}

export async function detectRepoContext(workspaceDir: string): Promise<RepoContext | null> {
  const gitRoot = await findGitRoot(workspaceDir);
  if (!gitRoot) return null;

  const originUrl = await readOriginUrl(gitRoot, "origin");
  if (!originUrl) return null;

  const remote = parseGitHubRemote(originUrl);
  if (!remote) return null;

  const head = await readHead(gitRoot);
  return { remote, branch: head.branch, commitSha: head.commitSha };
}
