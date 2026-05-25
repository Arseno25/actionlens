# GitHub API usage

ActionLens uses a small subset of the GitHub REST API.

| Purpose                | Endpoint                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| List runs              | `GET /repos/{owner}/{repo}/actions/runs`                          |
| One run                | `GET /repos/{owner}/{repo}/actions/runs/{run_id}`                 |
| Jobs in a run          | `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`            |
| One job                | `GET /repos/{owner}/{repo}/actions/jobs/{job_id}`                 |
| Job logs (single job)  | `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`            |
| All run logs (zip)     | `GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs`            |
| Rerun failed jobs (v2) | `POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs` |

## Filters on `list runs`

| Param      | Notes                                            |
| ---------- | ------------------------------------------------ |
| `branch`   | Filter to a specific branch                      |
| `status`   | `queued` / `in_progress` / `completed`           |
| `event`    | `push`, `pull_request`, `schedule`, …            |
| `actor`    | GitHub login                                     |
| `per_page` | Page size (max 100)                              |
| `page`     | 1-indexed page                                   |

Filtering by commit SHA is performed client-side (the runs list response
includes `head_sha`) because the v3 API doesn't accept SHA as a query param
for this endpoint.

## Log endpoint behavior

`/actions/jobs/{job_id}/logs` returns **302** to a short-lived signed URL
(usually ~1 minute). Our client:

1. Calls GitHub with `redirect: "manual"`.
2. Reads `Location`.
3. Fetches the signed URL with **no Authorization header** (signed URL only).
4. Returns the plain-text body.

The signed URL is **never** stored or cached.

## Authentication

`Authorization: Bearer <token>` for all GitHub calls; omitted entirely on the
signed log URL fetch.

## Rate limits

- 60 unauth requests / hour, 5000 authed / hour (more on GHES).
- The client looks at `X-RateLimit-Remaining` and `X-RateLimit-Reset` and
  marks the next call as `RATE_LIMITED` if remaining is zero.

## Status / conclusion vocabulary

`status`: `queued`, `in_progress`, `completed`.

`conclusion` (only set when `status === "completed"`):
`success`, `failure`, `cancelled`, `skipped`, `timed_out`,
`action_required`, `neutral`.
