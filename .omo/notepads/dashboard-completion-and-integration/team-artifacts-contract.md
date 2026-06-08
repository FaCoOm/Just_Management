# Persistent Team Artifacts Contract

Use this file as the standing contract for team-mode work under `dashboard-completion-and-integration`.

## Required Folder Shape

```text
.omo/notepads/dashboard-completion-and-integration/team-runs/<YYYYMMDD-HHMM>-<team-name>/
  manifest.md
  task-ledger.md
  artifact-manifest.md
  model-preflight.md
  verification.md
  closure.md
```

## Required Flow

1. Create artifact folder.
2. Write `manifest.md` with purpose, teamRunId, members, and decision gate.
3. Write `model-preflight.md` before member dispatch.
4. Create all initial `team_task_create` items.
5. Send members only task-scoped instructions.
6. Append outputs to `artifact-manifest.md`.
7. Append checks to `verification.md`.
8. After every terminal team task update, list pending/claimed/in-progress tasks.
9. If none remain, run shutdown requests, approvals, and `team_delete` in same turn.
10. Write `closure.md` with closure proof.

## Non-Negotiable Invariants

- No member work without a task ID.
- No recovery team with zero tasks.
- No preview model as sole path for critical work.
- No final answer while a team remains open.
- No output accepted without artifact-manifest entry.
- No closure claim without `team_delete` success.

## Token Accounting Fallback

If exact token fields are unavailable, record:

- teamRunId
- member count
- member model IDs
- task count by status
- message count if available
- transcript count if available
- exact note: `Exact token totals unavailable from current tools.`
