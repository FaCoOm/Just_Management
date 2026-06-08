# Team Mode Remediation Report

**Date:** 2026-06-01  
**Scope:** OMO/OpenCode team-mode orchestration, persistent team artifacts, and development-process contracts.  
**Current remediation team:** `team-mode-remediation-squad` (`67d8f6ce-e958-44b7-b45d-c746c461a312`)  
**Status:** Team used for analysis only, task ledger made terminal, team closed.

---

## Executive Summary

Team mode failed previously because team execution was not bound to durable control artifacts. Teams were created, members ran or failed, but the task ledger and artifact trail were not preserved as the source of truth.

The fix is not “more agents.” The fix is a stricter team operating contract:

1. Create persistent artifacts before member dispatch.
2. Preflight model/provider routes before assigning role-critical work.
3. Create team tasks before any member work starts.
4. Treat the task ledger as the only execution control plane.
5. Write every deliverable and verification result into an artifact manifest.
6. Close the team in the same turn when all tasks are terminal.

---

## Evidence Reviewed

| Evidence | Finding |
|---|---|
| `.omo/notepads/dashboard-completion-and-integration/team-mode-inefficiency-report.md` | Prior recovery team had `tasks: total 0`; model quota failure caused degraded team state; closure eventually performed after waste. |
| `.omo/boulder.json` | `task_sessions: {}` was empty for active work/session chain, so session task linkage did not persist. |
| `docs/dashboard_implementation_report.md` | Visual-engineering delegation failed on `github/gemini-3.1-pro-preview` with `model_not_supported`; delegated outputs were not all manually verified. |
| `docs/implementation/low-token-continuation-handoff-2026-05-26.md` | Earlier team mode showed provider/license failures, orchestration overhead, and lead reimplementation after member failure. |
| `docs/resources/opencode_architecture_and_flaws_analysis.md` | Team mode multiplies context cost through per-member prompt/state injection and proxy/fallback cache misses. |

---

## Root Causes

### 1. Ledger Was Not Mandatory Before Work

The prior recovery team had zero tasks. Without tasks, team mode lost:

- ownership
- blocker tracking
- completion state
- closure trigger
- audit trail

**Remediation:** team creation is invalid unless at least one `team_task_create` succeeds before member dispatch.

### 2. Team Lifecycle Was Decoupled From Task State

The team remained active while no pending, claimed, or in-progress work existed.

**Remediation:** after every terminal update, run `team_task_list`. If no pending/claimed/in-progress tasks remain, close immediately.

### 3. Preview/Provider Models Were Treated As Stable

`github/gemini-3.1-pro-preview` failed with unsupported-model or quota errors. That broke visual lanes and caused retries/recovery overhead.

**Remediation:** all role-critical models require preflight. Preview models can be optional accelerators, never required dependencies.

### 4. Outputs Were Not Bound To Artifact Manifest

Useful implementation happened, but not all output was mapped to durable team tasks and verification evidence.

**Remediation:** every team task must produce an artifact entry: files touched, commands run, evidence, limitations, owner.

### 5. Token Accounting Was Forensic, Not Built In

Exact team token use could not be recovered from session tools. Session metadata exposed message/transcript counts, not per-member token totals.

**Remediation:** team run manifest must record available token metadata or explicitly mark it unavailable and record message counts, member counts, and model IDs.

---

## Persistent Team Artifact Contract

Create one artifact folder per substantial team run:

```text
.omo/notepads/<work-id>/team-runs/<YYYYMMDD-HHMM>-<team-name>/
  manifest.md
  task-ledger.md
  artifact-manifest.md
  model-preflight.md
  verification.md
  closure.md
```

If a work-specific notepad does not exist, create:

```text
.omo/notepads/team-mode/<work-id>/team-runs/<run-id>/
```

### `manifest.md`

Required fields:

| Field | Required | Description |
|---|---:|---|
| `teamRunId` | Yes | Runtime team ID from `team_create`. |
| `teamName` | Yes | Human-readable team name. |
| `leadSessionId` | Yes | Lead session ID. |
| `createdAt` / `closedAt` | Yes | Start and closure timestamps. |
| `purpose` | Yes | Why team mode was justified. |
| `decisionGate` | Yes | Why this was not direct execution or simple delegation. |
| `members` | Yes | Member names, categories/subagent types, model IDs if available. |
| `sourcePlan` | Optional | Plan/report path used as source of truth. |
| `externalBlockers` | Yes | Missing credentials, unavailable APIs, model quota risk. |

### `task-ledger.md`

Required fields per task:

| Field | Required | Description |
|---|---:|---|
| `teamTaskId` | Yes | ID from `team_task_create`. |
| `owner` | Yes | Member or lead. |
| `status` | Yes | `pending`, `claimed`, `in_progress`, `completed`, `failed`, or `deleted`. |
| `blockedBy` | Yes | Empty list if unblocked. |
| `expectedOutput` | Yes | Concrete deliverable. |
| `actualOutput` | Yes when terminal | What was produced. |
| `evidenceRefs` | Yes when terminal | File paths, commands, screenshots, logs. |
| `closureImpact` | Yes | Whether task completion makes team closable. |

### `artifact-manifest.md`

Required fields:

| Field | Required | Description |
|---|---:|---|
| `artifact` | Yes | File/report/output path. |
| `createdBy` | Yes | Team member or lead. |
| `sourceTaskId` | Yes | Team task ID. |
| `purpose` | Yes | Why artifact exists. |
| `verification` | Yes | How artifact was checked. |
| `owner` | Yes | Who should maintain it. |

### `model-preflight.md`

Required checks before member dispatch:

| Check | Pass Condition |
|---|---|
| Model available | Role model does not return `model_not_supported`. |
| Quota healthy | No known quota/license failure for role model. |
| Fallback defined | Role has stable fallback before team starts. |
| Preview isolated | Preview model not only path for critical task. |
| Tool surface available | Browser/API/CLI tools available if task needs them. |

### `verification.md`

Required fields:

| Field | Required | Description |
|---|---:|---|
| `changedFiles` | Yes | All files changed by team/lead. |
| `diagnostics` | Yes | LSP or documented unavailability. |
| `commands` | Yes | Build/typecheck/test commands and exit status. |
| `manualQA` | If user-visible | Browser/API/CLI proof. |
| `knownBlockers` | Yes | External blockers and what remained unverified. |

### `closure.md`

Required closure proof:

```text
team_task_list pending: []
team_task_list claimed: []
team_task_list in_progress: []
team_status active members: <members>
shutdown requested: <members>
shutdown approved: <members>
team_delete: success
```

---

## Team Use Decision Gate

Use team mode only when all are true:

1. Work splits into at least two independent, unblocked lanes.
2. Each lane has a concrete terminal artifact.
3. Model/provider route is healthy or has stable fallback.
4. Required credentials/data are present, or task can still terminate without them.
5. Lead can verify outputs file-by-file.
6. Team lifecycle cost is lower than direct execution plus one targeted delegate.

Do not use team mode when:

- one file or one subsystem is involved
- remaining work is serial verification
- browser/manual QA must be done by lead anyway
- a key role depends on an unpreflighted preview model
- credentials block acceptance
- no persistent artifact folder will be created

---

## OMO Team Contract

### Lead Responsibilities

1. Create persistent artifact folder.
2. Run model/tool preflight or document why unavailable.
3. Create every team task before member dispatch.
4. Send members task IDs, expected outputs, and forbidden actions.
5. Reconcile member reports into artifact manifest.
6. Verify outputs directly before accepting completion.
7. Close team as soon as closure contract holds.

### Member Responsibilities

1. Claim one team task before work.
2. Stay inside assigned scope.
3. Report files read/changed, commands run, and blockers.
4. Mark task terminal only after evidence exists.
5. Do not create nested delegates.
6. Do not perform destructive actions.

### Closure Invariant

After every terminal task update:

```text
if pending == 0 and claimed == 0 and in_progress == 0:
  team_status
  team_shutdown_request for each active non-lead member
  team_approve_shutdown for each requested member
  team_delete
```

No lingering teams.

---

## Recommended Team Shapes

### Standard Development Team

| Member | Category | When Used | Output |
|---|---|---|---|
| lead | `sisyphus` | Always | Plan, ledger, merge, verification, closure. |
| backend-worker | `quick` or `unspecified-high` | Backend/API lane | Patch + backend verification evidence. |
| frontend-worker | `visual-engineering` | UI lane | Patch + browser-ready notes. |
| verifier | `quick` or `writing` | Independent QA/docs | Build/test/QA report. |

### Analysis/Remediation Team

| Member | Category | Output |
|---|---|---|
| evidence-analyst | `quick` | Evidence table and failure modes. |
| contract-architect | `ultrabrain` | Contracts and invariants. |
| report-reviewer | `writing` | Markdown quality and acceptance checklist. |

### Recovery Team

Use only if all are true:

- original team closed
- at least two independent unblocked tasks remain
- failure cause is known
- replacement model/tool path is healthy

Otherwise continue with lead execution.

---

## Current Remediation Run Record

This report used a bounded analysis team:

| Field | Value |
|---|---|
| Team | `team-mode-remediation-squad` |
| Team run ID | `67d8f6ce-e958-44b7-b45d-c746c461a312` |
| Members | `evidence-analyst`, `contract-architect`, `report-reviewer` |
| Runtime tasks | 5 total: 3 completed, 2 deleted as duplicate stale tasks |
| Closure | `team_shutdown_request`, `team_approve_shutdown`, then `team_delete` completed |
| Purpose | Analyze existing team-mode issues and design persistent remediation artifacts |

Duplicate pending tasks were deleted because members created and completed equivalent owner-bound tasks. This is itself useful evidence: the lead must avoid creating duplicate unowned tasks and must reconcile member-created tasks before closure.

---

## Implementation Plan

### Phase 1 — Immediate Operating Change

- Use this report as team-mode gate.
- Never dispatch a member before team tasks exist.
- Never open recovery teams with zero concrete tasks.
- Treat preview model failure as role fallback, not team restart trigger.

### Phase 2 — Artifact Discipline

- For next substantial team run, create the artifact folder shape described above.
- Keep artifact files short and append-only during run.
- Link every team task to one artifact entry.
- Include closure proof before final response.

### Phase 3 — Tooling Hardening

- Add a lightweight script or checklist to validate artifact completeness.
- Add model preflight notes to team run manifest.
- Prefer stable model aliases over preview model IDs in team specs.
- Record token fields if tool output exposes them; otherwise record message/member/model counts and mark token totals unavailable.

---

## Acceptance Criteria

Future team-mode run is acceptable only when:

- [ ] artifact folder exists before member dispatch
- [ ] `manifest.md` documents why team mode was justified
- [ ] `model-preflight.md` lists model/provider readiness
- [ ] every team member receives a task ID
- [ ] every task has terminal status before closure
- [ ] `artifact-manifest.md` maps outputs to tasks
- [ ] `verification.md` records build/test/manual QA or blockers
- [ ] `closure.md` proves shutdown and deletion
- [ ] final user summary links report/artifacts and states any unavailable token data

---

## Bottom Line

Team mode should be a controlled execution system, not a chat room of subagents. The durable unit is not the team; it is the task-and-artifact record.

Correct future pattern:

```text
decision gate -> artifact folder -> model preflight -> team_create -> team_task_create -> member work -> artifact manifest -> verification -> closure proof -> final summary
```

If any step is skipped, use direct execution instead.
