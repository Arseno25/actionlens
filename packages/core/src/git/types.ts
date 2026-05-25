export interface GitHubRemote {
  host: string;
  owner: string;
  repo: string;
}

export interface RepoContext {
  remote: GitHubRemote;
  branch: string | null;
  commitSha: string | null;
}
