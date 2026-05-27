# Token Cost Optimization Report

## Executive Summary

The prior workstream cost was not caused by the manual reservation feature alone. Cost came from compounding context multipliers: a heavy Sisyphus/oh-my-opencode harness, exhaustive search directives, long-lived session continuation, dirty worktree safety checks, multi-agent/team orchestration, and repeated verification loops over a broad Track B backend/frontend surface.

The existing short report in `docs/analysis/usage.md` correctly identifies the main categories: huge input context replay, dirty worktree diffing, continuation/recovery, parallel orchestration overhead, and deep search directives. This report expands that into a more complete diagnosis, ties it to observed local evidence, compares it with oh-my-opencode (OMO) and Everything Claude Code (ECC), and gives concrete mitigation paths.

Highest-impact fix: treat heavy orchestration as a scarce resource. Use fresh sessions with compact handoffs, narrow task envelopes, single-agent execution for normal changes, and explicit cost budgets. Keep OMO/ECC strengths, but gate them by task risk.

## Evidence Base

This analysis used these local and external signals:

- `docs/analysis/usage.md` lines 1-79: existing token report.
- Session metadata:
  - `ses_19e0357e6ffeCwZ5uhcpH4Og9q`: 144 messages over about 4 hours.
  - `ses_19d04f30cffe8K0ELlPh6yOdgk`: 111 messages over about 5 hours.
  - `ses_1a0f64c41ffetc6DBi5HSRn0Ql`: 154 messages over about 12 hours, with compaction.
  - `ses_1b1efbbd9fferw6absp2qMVNmC`: 261 messages over about 2 days 21 hours, with compaction.
- Current workspace state:
  - 34 modified tracked files and 16 untracked files observed at analysis time.
  - `.omo`: about 204.6 KB across 136 files.
  - `.sisyphus`: about 202.7 KB across 127 files.
  - `.agent`: about 1.6 MB across 213 files.
  - `.agents`: about 17.6 KB across 5 files.
  - 102 `.omo/tasks/*.json` files totaling about 46 KB.
- AGENTS.md injection surface:
  - Root `AGENTS.md`: 7,683 bytes.
  - 9 additional scoped `AGENTS.md` files in backend, Prisma, ingest, dashboard, UI, hooks, repositories, and Supabase migrations.
- External architecture references from web search:
  - OMO/oh-my-openagent README: Sisyphus orchestration, discipline agents, background agents, Claude Code compatibility, skill-embedded MCPs, context injection, LSP/AST-grep, aggressive truncation.
  - OMO configuration docs: built-in agents, skills, hooks, MCPs, background task concurrency, categories, config-level agent overrides.
  - ECC README: cross-harness agent performance system, skills as primary surface, hook runtime profiles, cross-tool support, model routing, session/compact/metrics references.
  - OpenCode context-management references: automatic compaction, tool-output pruning, message replay after compaction, overflow buffer, doom-loop protection.

Two librarian background agents were launched for external research but failed due unavailable `github/gpt-5.4-mini` model in the Copilot integration. Their output is not used as evidence.

## Cost Shape

### 1. Fixed Harness Tax

Every agent turn carries a large fixed context cost before task-specific code or conversation history appears.

In this environment, fixed context includes:

- System identity and orchestration rules for Sisyphus.
- Full tool schema list.
- Developer rules covering intent classification, delegation, planning, verification, file-editing policy, frontend routing, task tracking, and final-answer style.
- Project `AGENTS.md` and scoped rules.
- Available skills list with descriptions.
- Available subagent/category descriptions.
- Current environment metadata.
- User style constraints, including caveman terse mode.

This means even short prompts start with a large input payload. Small questions become expensive because fixed context dominates. In a normal lightweight coding harness, task-specific text is a large share of cost. Here, fixed scaffolding can be majority cost.

### 2. Session Replay Tax

OpenCode-style agents operate on conversation history. Long sessions accumulate:

- User requests.
- Assistant reasoning summaries and commentary.
- Tool calls.
- Tool results.
- Background task metadata.
- Verification logs.
- Recovery attempts.

Compaction helps only after threshold. Until then, long sessions repeatedly re-send growing context. When compaction happens, it adds its own summarization call and may replay the last user message to continue.

Observed sessions fit this pattern: 111-261 message sessions, including compaction in two cases. Such sessions are structurally expensive even when individual edits are small.

### 3. Search-Mode Multiplication

The user explicitly requested maximum search effort:

- Multiple background explore agents.
- Multiple librarian agents.
- Direct Grep/ripgrep.
- AST-grep.
- LSP diagnostics.
- Exhaustive synthesis.

This is correct for high-risk investigation, but it multiplies tokens. Each subagent receives its own prompt, tool list, persona, and retrieved context. Each result then returns to the main agent and becomes another context object to synthesize.

Search-mode creates value when uncertainty is high. It wastes cost when the task is local, already scoped, or primarily mechanical.

### 4. Dirty Worktree Tax

At analysis time, the worktree had 34 modified tracked files and 16 untracked files. The existing `usage.md` reported 32 modified tracked files plus untracked assets during the prior session.

Dirty worktree causes repeated safety checks:

- `git status` inspection.
- Diffs to avoid overwriting user changes.
- File reads to verify ownership and current content.
- Re-checks after subagents modify overlapping areas.
- Extra caution before running broad refactors.

This is desirable safety behavior, but expensive. More changed files mean more context required to distinguish existing user work from agent work.

### 5. Team/Subagent Fan-Out Tax

OMO is designed around Sisyphus orchestrating specialized agents: Oracle, Librarian, Explore, planning agents, and category workers. The OMO README advertises discipline agents, background agents, category delegation, and team-style parallel work.

That design improves quality but has superlinear cost when overused:

- Main agent prompt cost.
- Each subagent prompt cost.
- Each subagent tool context and result cost.
- Coordination messages.
- Result reconciliation.
- Verification of delegated edits.
- Late-running or failed background task recovery.

The local `.omo/tasks` directory shows many persistent task files with team metadata. Sample task files include `teamRunId` and member fields. This confirms team-style execution occurred and left coordination state.

### 6. Persistent State Is Not Main Cost, But Can Trigger Cost

`.omo` and `.sisyphus` are not enormous: about 200 KB each. Individual run-continuation files are tiny, around 214 bytes in observed samples. They are not themselves the main token sink.

However, persistent state can trigger expensive behavior:

- Continuation detection.
- Background task recovery.
- Task list replay.
- Notepad/evidence lookup.
- Plan resumption.
- Stale active-task handling.

The problem is not bytes on disk. Problem is when the harness decides those bytes imply more context must be read, summarized, reconciled, or verified.

### 7. Planning Artifacts Can Become Context Anchors

`.omo/plans/track-b-backend-development-roadmap.md` is 846 lines. `.omo/plans/airbnb-postgres-schema.md` is about 54 KB. These plans are useful, but if loaded repeatedly into active context they become major token anchors.

A plan should be a pointer plus a compact current step, not a full replay every turn.

### 8. Tool Output Cost

Direct shell output can be large:

- Directory listings.
- Full task inventories.
- Git diffs.
- Build output.
- Session transcripts.
- Long README/docs reads.

OpenCode has pruning/compaction mechanisms, but the first ingestion of tool output still costs. Unbounded commands create avoidable token spikes.

## OMO Design Analysis

OMO's design philosophy optimizes for agent capability and safety:

- Sisyphus orchestrates specialized discipline agents.
- Categories route work to model/domain optimized agents.
- Skills provide domain-specific instructions and MCPs.
- LSP and AST-grep provide IDE-like precision.
- Background agents enable parallel research.
- `AGENTS.md` and conditional rules provide project-local intelligence.
- Hash-anchored edit tools and verification gates reduce stale edit risk.
- Aggressive truncation/auto-resume features are available.

Cost-positive design features:

- Skill-embedded MCPs are explicitly intended to avoid always-on MCP context bloat.
- `AGENTS.md` hierarchy can be token-efficient when it replaces repeated ad hoc explanation.
- Explore/librarian agents can reduce main-agent flailing if used selectively.
- Categories can route to cheaper/faster models for trivial work.
- LSP/AST-grep can reduce broad file reads.

Cost-negative design features when overused:

- Sisyphus base instructions are large.
- Many skills and agents appear in discoverability context.
- Delegation prompts are verbose by design.
- Subagents duplicate fixed harness overhead.
- Verification discipline adds repeated diagnostics/tests/builds.
- Team-mode multiplies coordination overhead.
- Always-on exhaustive search converts simple work into research programs.

OMO is strongest for high-risk, multi-file, ambiguous, or architecture-heavy work. It is costly for simple local edits unless explicitly run in a lean mode.

## ECC Design Analysis

ECC positions itself as a cross-harness performance optimization system for Claude Code, Codex, Cursor, OpenCode, Gemini, Zed, and others. Its README emphasizes:

- Skills as primary workflow surface.
- Commands and legacy command shims as compatibility layer.
- Hook runtime controls such as `ECC_HOOK_PROFILE=minimal|standard|strict` and disabled-hooks environment controls.
- Session summaries and hook reliability.
- Model routing and compact/metrics surfaces in newer releases.
- Copy-only core/general skills for new users rather than installing everything by default.

ECC's relevant design lesson: capability should be selectable by profile. It offers a broad ecosystem, but its documented install guidance says new users should copy core/general skills first. That is a cost-control idea: do not expose every possible workflow to every session.

ECC also leans toward hook profiles and runtime toggles. That gives a cleaner answer to cost control than pure prompt discipline: define `minimal`, `standard`, and `strict` modes, then have tooling enforce them.

## OMO vs ECC Cost Comparison

| Dimension | OMO / oh-my-opencode | ECC / Everything Claude Code | Cost Implication |
|---|---|---|---|
| Primary model | Orchestrator plus subagents/categories | Skills/hooks/agents across harnesses | OMO more likely to fan out; ECC more profile driven. |
| Skill model | Skill tool discovers project/user/built-ins, skill-embedded MCPs | Skills are canonical workflow surface, recommended core install first | Both can be efficient if skills load on demand; both expensive if all surfaced every turn. |
| Context guidance | Auto-inject AGENTS.md, README, conditional rules | AGENTS.md as cross-tool universal file | Great for correctness, but oversized AGENTS files tax every turn. |
| Parallelism | Background agents/team-mode central feature | Multi-agent/multi-model workflows available | Parallelism improves coverage but multiplies base prompt cost. |
| Runtime gating | Configurable hooks, categories, background task limits | `ECC_HOOK_PROFILE`, disabled hooks, model route commands | ECC-style explicit profiles are a useful missing discipline for OMO sessions. |
| Persistence | `.omo`, `.sisyphus`, plans, tasks, notepads, evidence | Memory/instinct/session summary concepts | Persistence should be summarized, not replayed. |
| Best use | Complex coding work with high correctness needs | Cross-harness workflow system and performance/quality guardrails | Use OMO for hard work, ECC-style profiles to control when it engages. |

## Specific Inefficiencies Observed

### Over-broad instruction stacking

The current prompt stack contains duplicate themes: search-mode, analyze-mode repeated twice, mandatory delegate params repeated, OMO orchestration policy, project AGENTS rules, and caveman style. Repeated directives add cost and can conflict.

Fix: use one canonical mode header per session. Avoid pasting global operating policy into every request.

### Exhaustive research for implementation work

Maximum search mode is appropriate for architecture review or unknown bugs. It is wasteful for known file changes, final QA, copy edits, or one endpoint fix.

Fix: define explicit tiers:

- `lean`: direct tools only, no subagents.
- `standard`: one explore agent max.
- `deep`: 2-4 agents plus direct search.
- `forensic`: exhaustive search, Oracle, full citations.

### Long-lived session continuation

Continuing sessions with 100+ messages avoids re-orientation but forces heavy replay/compaction. The prior sessions had 111, 144, 154, and 261 messages.

Fix: start a fresh session at each phase boundary with a compact handoff:

```text
Context: Track B manual reservations. Current goal: final QA only. Relevant files: backend/src/index.ts, src/components/reservations/reservations-page.tsx, src/lib/repositories/rest-repositories.ts. Do not revisit schema unless tests fail. Run typecheck/build/API smoke and report failures only.
```

### Dirty worktree safety tax

Large dirty state forces the agent to preserve unknown changes. This is good but expensive.

Fix: before heavy sessions, snapshot or commit work if appropriate. If not committing, provide a file ownership map:

```text
Agent may edit only: A, B, C. Treat all other modified files as user-owned. Do not inspect unrelated diffs unless command fails.
```

### Plan files too large for active context

Long `.omo/plans/*.md` files are useful but expensive if repeatedly read.

Fix: keep full plans as cold storage. Create a 20-line active execution card:

```text
Goal
Current step
Allowed files
Forbidden scope
Verification commands
Known blockers
```

### Team-mode overuse

Team-mode is powerful for independent domains. It is costly for normal sequential fixes.

Fix: require a team-mode threshold:

Use team-mode only when at least two of these are true:

- More than 3 independent domains.
- Security/architecture impact.
- Need independent adversarial review.
- External docs or remote repo research required.
- High cost of wrong answer.

Otherwise use one agent plus direct tools.

## Recommended Cost-Control Architecture

### 1. Add Session Cost Profiles

Adopt ECC-style runtime profiles for OMO usage:

| Profile | Use Case | Allowed Behavior |
|---|---|---|
| `minimal` | small known edits, doc edits, QA reruns | direct tools only; no background agents; no Oracle; no team-mode |
| `standard` | normal feature/fix | 1 explore max; plan only if multi-step; bounded verification |
| `deep` | cross-module implementation | 2-3 agents; plan agent; selected skills only |
| `forensic` | incident/debug/security/architecture | exhaustive search; Oracle; multi-agent allowed |

Add this to request format:

```text
[cost-profile: minimal]
Task: Fix type error in backend/src/index.ts only.
Allowed files: backend/src/index.ts
Verification: cd backend && npm run build
```

### 2. Replace Repeated Mode Blocks With Short Tags

Instead of pasting full search-mode/analyze-mode text, use:

```text
[mode: forensic-analysis]
[budget: 2 explore, 1 librarian, direct rg, no team-mode unless Oracle recommends]
```

This preserves intent while saving input tokens.

### 3. Create Handoff Cards

Every phase boundary should end with a compact file or message:

```markdown
# Handoff

## Goal
Manual reservation create: final QA only.

## Done
- Backend route implemented.
- Frontend form wired.
- Repository contract updated.

## Relevant Files
- backend/src/index.ts
- src/components/reservations/reservations-page.tsx
- src/lib/repositories/types.ts
- src/lib/repositories/rest-repositories.ts

## Do Not Reopen
- Prisma schema unless backend build fails.
- Dashboard layout.
- Supabase migrations.

## Verify
- npm run typecheck
- npm run build
- cd backend && npm run build
- POST /api/reservations smoke
```

Then start fresh session from this, not full transcript.

### 4. Maintain Active Context Index

Keep a short `docs/analysis/current-context.md` or `.omo/active-card.md` that points to cold artifacts but does not inline them.

Contents should be under 100 lines. It should replace repeated reads of large plans.

### 5. Budget Subagents Explicitly

Use hard caps:

- Default: 0 background agents.
- Standard investigation: 1 explore.
- Architecture: 1 explore + 1 Oracle.
- External library: 1 librarian.
- Full forensic: max 4 total agents.

Each subagent prompt should include output limits:

```text
Return max 400 words. Cite only top 5 files. Do not inspect unrelated modules.
```

### 6. Restrict Tool Output

Prefer bounded commands:

- `rg -n "pattern" path` over broad `rg pattern`.
- Read file slices, not whole files, unless short.
- Avoid printing full diffs unless needed.
- Use `git diff --name-only` before `git diff`.
- Save long logs to files and summarize key lines.

### 7. Make Dirty Worktree Explicit

At session start:

```text
Dirty worktree expected. Agent-owned changes from this session only may be edited. Do not clean/revert other files. Start by reading only target files.
```

For best cost, reduce dirty worktree before complex runs.

### 8. Gate Verification By Change Type

Verification should remain real, but scoped:

- Markdown-only report: read file, maybe markdown lint if configured. No app build.
- Frontend component: LSP file diagnostics, `npm run typecheck`, maybe browser smoke.
- Backend route: backend build and API smoke.
- Prisma: generate, validate, migration verify.

Avoid running full frontend + backend + browser + API smoke for unrelated docs changes.

## Suggested Working Protocol

### Before Session

1. Choose cost profile: `minimal`, `standard`, `deep`, or `forensic`.
2. List allowed files.
3. State forbidden scope.
4. Provide compact handoff, not old transcript.
5. State verification command budget.

### During Session

1. Use direct `rg` first.
2. Delegate only if uncertainty remains.
3. Stop after enough evidence, not after every possible evidence path.
4. Keep one active task at a time unless true parallelism exists.
5. Summarize findings into active card as decisions are made.

### After Session

1. Write a compact handoff.
2. Mark which files were changed.
3. Record exact verification run and result.
4. Clear stale `.omo` tasks if appropriate.
5. Start next phase fresh.

## High-Impact Quick Wins

1. Stop pasting full search/analyze instructions. Use a short mode tag.
2. Default to `cost-profile: standard` or `minimal`, not exhaustive.
3. Start fresh sessions after every major phase.
4. Keep handoff under 250 words unless work is architecture-heavy.
5. Avoid team-mode unless there are independent domains.
6. Cap subagents and their output size.
7. Keep root `AGENTS.md` concise; move details into scoped AGENTS files.
8. Use file allowlists.
9. Reduce dirty worktree before deep implementation.
10. Treat large plans as cold storage; keep active cards short.

## When High Cost Is Justified

High token use is acceptable when:

- Schema or migration work can damage data.
- Security/auth changes affect user trust.
- Multi-system architecture decisions are being made.
- Unknown production bug requires forensic debugging.
- UI/UX work needs browser QA plus accessibility checks.
- External API contracts are unclear.

High cost is not justified for:

- Single-file copy/doc edits.
- Rerunning verification.
- Known endpoint wiring.
- Formatting.
- Small type fixes.
- Asking for a summary of already-read work.

## Proposed Request Templates

### Lean Implementation

```text
[cost-profile: minimal]
Task: Fix X in Y only.
Allowed files: Y
Do not use subagents. Use direct rg/read only.
Verify: command Z.
```

### Standard Feature

```text
[cost-profile: standard]
Task: Add X.
Allowed files: A, B, C.
May use one explore agent if needed.
No team-mode. No Oracle unless two failed attempts.
Verify: typecheck + focused smoke.
```

### Deep Architecture

```text
[cost-profile: deep]
Task: Design and implement X across A/B/C.
Use up to 2 explore agents and 1 librarian if external docs matter.
Consult Oracle before implementation if architecture choice is unclear.
Return compact plan before editing.
```

### Forensic Investigation

```text
[cost-profile: forensic]
Task: Determine root cause of X.
Use exhaustive rg, ast-grep, LSP, 2 explore agents, 1 librarian, Oracle if root cause remains unclear.
Report evidence with file refs. Do not edit unless explicitly approved.
```

## Bottom Line

The current setup is powerful but biased toward maximum correctness through maximum context. OMO provides strong orchestration, verification, and agent specialization, but those strengths become cost multipliers if every request runs like a forensic investigation. ECC's strongest transferable idea is runtime profiling: make capability levels explicit, configurable, and cheap by default.

Recommended operating stance:

- Minimal by default for known small work.
- Standard for normal implementation.
- Deep for multi-module changes.
- Forensic only when risk or uncertainty warrants it.

This preserves OMO's strengths while preventing routine coding sessions from becoming million-token orchestration runs.
