# Team-Mode Inefficiency Breakdown

**Date:** 2026-06-01  
**Plan:** `.omo/plans/dashboard-completion-and-integration.md`  
**Context:** continuation after WithOne-first Gmail/Sheets fallback request  
**Scope:** team-mode execution only, not full dashboard implementation history

---

## Executive Summary

Team-mode use during WithOne continuation had poor cost-to-output ratio.

It did not behave as a literal infinite loop, but it did create a costly degraded-recovery pattern:

1. Create team for parallel backend/UI/QA work.
2. Visual/UI lane hit model quota failure.
3. Team entered degraded/error state.
4. Recovery team was created instead of stopping team-mode and continuing manually.
5. Recovery team ended with zero durable team tasks and idle/errored members.
6. More tokens were spent on team lifecycle management than on verified implementation completion.

Net result: some useful code and findings existed, but team-mode itself did not produce a clean task-completion ledger, did not complete remaining plan tasks, and did not justify its coordination overhead.

---

## What Team-Mode Was Intended To Do

User requested WithOne substitution for direct Google API usage and asked to continue previous dashboard plan work.

Intended team split:

| Lane | Intended Role |
|---|---|
| Backend | Build WithOne-first Gmail + Sheets connector/fallback seam. |
| UI | Finish Tax-Export sheet settings UI proof and polish. |
| Verification/docs | Validate builds, browser/API behavior, and notepad evidence. |

This split was reasonable in principle because work touched backend integration, tax-export frontend, and QA evidence.

Problem was not initial decomposition. Problem was execution after first team degraded.

---

## Team Runs Observed

### 1. Initial Team

| Field | Value |
|---|---|
| Team name | `withone-continuation-squad` |
| Team run ID | `e557260a-a972-4933-85b4-bfce24fccefe` |
| Intended lanes | backend WithOne, tax UI, QA/docs |
| Outcome | Degraded, tasks deleted, team shutdown/deleted |

Known background/member records from checkpoint summary:

| Background ID | Purpose | Result |
|---|---|---|
| `bg_f9881efe` | create/use backend lane | completed |
| `bg_e1c1fe7a` | create/use QA/docs lane | completed |
| `bg_de92358e` | create/use tax UI lane | failed/cancelled after team deletion |

### 2. Recovery Team

| Field | Value |
|---|---|
| Team name | `withone-recovery-squad` |
| Team run ID | `17cdc33a-3e22-49a4-bff5-759abc6f42ac` |
| Members | `backend-recovery`, `ui-recovery`, `verification-recovery` |
| Observed task count | `0` total tasks |
| Observed member status | backend idle, verification idle, UI errored, lead errored |
| Outcome | Shutdown requested/approved and team deleted |

Current tool-observed state before closure:

```text
teamName: withone-recovery-squad
teamRunId: 17cdc33a-3e22-49a4-bff5-759abc6f42ac
status: active
tasks: pending 0, claimed 0, in_progress 0, completed 0, deleted 0, total 0
members:
  lead: errored
  backend-recovery: idle
  ui-recovery: errored
  verification-recovery: idle
```

Closure performed after this status:

1. `team_shutdown_request` for `backend-recovery`, `ui-recovery`, `verification-recovery`.
2. `team_approve_shutdown` for same members.
3. `team_delete` for `17cdc33a-3e22-49a4-bff5-759abc6f42ac`.

---

## Main Inefficiency Drivers

### 1. Visual model quota failure caused degraded team state

Known error:

```text
[github/gemini-3.1-pro-preview] [402]: {"error":{"message":"You have no quota","code":"quota_exceeded"}}
```

Impact:

- UI/visual lane could not reliably run.
- Team remained partially active/degraded.
- More tokens were spent interpreting retry/error state.
- UI work still needed manual verification later.

This was biggest direct waste source.

### 2. Recovery team was created before proving team-mode was still worth using

After first team degraded, cheaper path was:

1. Close failed team.
2. Continue manually on known files.
3. Use one narrow agent only if missing context remained.

Instead, recovery team was created.

Recovery team later had zero tasks. That means setup/coordination cost landed without a task ledger or deliverable trail.

### 3. Team-task ledger was not preserved as source of truth

Recovery team status showed:

```text
tasks: total 0
```

Without team tasks, team-mode lost main benefit:

- no clear task ownership
- no terminal completion list
- no blocked/completed split
- no reliable reason to keep members alive
- no audit trail matching plan tasks

Result: team-mode became expensive session orchestration rather than parallel execution.

### 4. Missing external credentials limited live verification anyway

Known blockers from handoff/notepad:

| Missing item | Impact |
|---|---|
| `ONE_CONNECTION_KEY` / WithOne live connection | Cannot prove Gmail/Sheets WithOne path end-to-end. |
| WithOne Gmail OAuth credentials | Cannot authenticate actual Gmail search. |
| WithOne Google Sheets credentials | Cannot authenticate real Sheet upsert. |
| `credentials.json` for direct service-account fallback | Cannot prove direct Google fallback locally. |

Because live verification was blocked, parallel team effort could only produce code-shape and build verification, not final proof. That reduced value of keeping several agents active.

### 5. Browser/UI proof remained unresolved despite UI lane

Task 38 status mismatch:

- Direct API persistence was proven for `sheet_id`, `sheet_tab`, `template_columns`.
- Browser/UI save proof was reported as missing in checkpoint summary.
- Plan still showed Task 38 as `[ ]` in `.omo/plans/dashboard-completion-and-integration.md` at lines 91-95.

This means UI lane did not complete expected acceptance condition before team degradation.

### 6. Partial implementation happened outside clean team completion

Useful code changes existed, but they were not tied to completed team tasks.

Known modified/partial areas:

| File | Partial Value |
|---|---|
| `backend/src/integrations/provider-connector.ts` | WithOne provider connector, Gmail listing, Sheets row upsert, OTA parser registry partial. |
| `backend/src/index.ts` | Integration status and optional pagination helper partial. |
| `src/components/reservations/reservations-page.tsx` | Pagination/performance partial. |
| `src/components/revenue/billing-invoices-page.tsx` | Pagination/performance partial. |
| `.omo/notepads/dashboard-completion-and-integration/learnings.md` | Notes for WithOne parser/Sheets work and Task 38 verification. |

This creates review burden: later executor must inspect diffs manually instead of trusting team task results.

---

## What Was Achieved Despite Inefficiency

### Durable useful outcomes

| Outcome | Evidence |
|---|---|
| WithOne-first direction clarified | Provider connector boundary chosen as backend seam; frontend should not call Gmail/Sheets directly. |
| OTA parser shape created | Learnings mention Airbnb, Booking.com, Agoda, generic parser registry. |
| Sheets upsert approach shaped | Learnings mention idempotency-key-aware append/update split. |
| Build checkpoint passed | Checkpoint summary reported `cd backend && npm run build` and `npm run typecheck` passed. |
| Team-mode failure mode diagnosed | Quota failure + recovery-team zero-task state identified. |
| Recovery team closed | Prevented more idle team token/session cost. |

### Non-durable or incomplete outcomes

| Outcome | Why incomplete |
|---|---|
| Task 29 Gmail search service | No live WithOne credential verification; plan still unchecked. |
| Task 30 OTA parser registry | Code/notes exist, but plan still unchecked and full integration unverified. |
| Task 31 Sheets writer/upsert | Code/notes exist, but live Sheet write unavailable. |
| Task 38 UI sheet settings | API proof exists; browser save proof was still disputed/missing in checkpoint. |
| Task 43 pagination/performance | Partial diff exists; plan not marked complete. |

---

## Cost Pattern

Observed cost pattern:

1. Team creation overhead.
2. Member session context injection.
3. Model quota error handling.
4. Team degradation inspection.
5. Task deletion/shutdown overhead.
6. Recovery team creation overhead.
7. Recovery member state inspection.
8. Recovery shutdown/deletion overhead.

Useful work happened, but substantial token spend went to coordination and recovery, not implementation.

Best estimate from evidence: high overhead, low team-mode yield.

---

## Root Cause Analysis

### Immediate cause

Visual/UI team member hit quota/model error and could not complete assigned lane.

### Process cause

Recovery was attempted through another team before validating whether team-mode still had enough independent, unblocked work to justify it.

### Control failure

Team-task list was not maintained as active execution ledger. Recovery team existed with zero tasks, meaning closure should have happened immediately rather than further team work.

### Scope mismatch

Remaining work had many credential blockers and verification blockers. That made multi-agent parallelism less useful because several tasks could not reach final acceptance without external inputs.

---

## Better Strategy That Should Have Been Used

After first team degradation:

1. Stop team-mode immediately.
2. Close failed team.
3. Review current diffs manually:
   - `backend/src/integrations/provider-connector.ts`
   - `backend/src/index.ts`
   - `src/components/reservations/reservations-page.tsx`
   - `src/components/revenue/billing-invoices-page.tsx`
   - `.omo/notepads/dashboard-completion-and-integration/learnings.md`
4. Mark externally blocked tasks `[~]` in plan if credentials unavailable.
5. Finish local-only tasks manually:
   - Task 38 UI proof
   - Task 43 pagination review
   - Task 40 UI polish
6. Use one narrow non-visual worker only if codebase search was needed.
7. Avoid Gemini visual route until quota resolved.

---

## Guardrails For Future Team-Mode Use

### Use team-mode only when all conditions hold

- Work splits into 2+ independent lanes.
- Each lane has concrete terminal output.
- Required credentials/data are available, or task can still complete without them.
- Team tasks are created immediately after team creation.
- Model routing is known healthy.

### Stop team-mode immediately if any condition occurs

- Team has zero tasks.
- Key member errors on model quota.
- Work becomes credential-blocked.
- Same task requires manual/browser proof by lead.
- Coordination cost exceeds implementation progress.

### Required closure rule

If `team_task_list` shows no pending/claimed/in-progress tasks, close team same turn:

1. `team_shutdown_request` for each active member.
2. `team_approve_shutdown` for each active member.
3. `team_delete`.

---

## Recommended Next Execution Mode

Do not recreate team for this continuation by default.

Recommended path:

1. Manual lead execution.
2. Direct diff review.
3. Build/typecheck verification.
4. Browser/API proof for UI-sensitive tasks.
5. Mark credential-blocked tasks `[~]` with real plan edit.

If delegation is needed, use one targeted agent at a time, not a visual team lane, until model quota is known healthy.

---

## Bottom Line

Team-mode here was overpowered for remaining blocked/verification-heavy work.

It gave some useful decomposition and partial implementation, but model quota failure plus recovery-team recreation caused expensive coordination churn. The right correction is to keep teams closed, continue manually, and only delegate narrow code-search or review tasks with healthy model routes.
