# Current Orchestration Efficiency Guide

## Purpose

This guide explains current OpenCode/Oh My OpenAgent orchestration state in this workspace, why token/context consumption remains high even though `.omo`, boulder state, tasks, handoffs, and compaction exist, and what to do next to reduce cost while improving reliability.

It also teaches core concepts: context window, worktree, dirty/untracked files, task systems, handoff, compaction, memory, MCP tools, and subagents.

## Evidence Snapshot

### Current Workspace

Workspace:

```text
C:\Users\Fate_Conqueror\GitHub\Just_Management
```

Current branch:

```text
main
```

Current git status at measurement time:

```text
 M .omo/run-continuation/ses_19b6760c2ffeOG2x5xPsGCHlkk.json
?? .omo/archieved/
?? .omo/run-continuation/ses_19b4ebde5ffemMvnca1MEBJZr1.json
?? .omo/tasks/T-8288884a-7e6c-4b74-86dc-ef00b79ef0a1.json
?? docs/analysis/omo-context-architecture-guide.md
?? docs/analysis/token-cost-optimization-report.md
?? resources/agent_input_context_mechanics.md
?? resources/elaborated_token_cost_optimization_report.md
?? resources/kaggle_mcp_setup.md
?? resources/kaggle_notebooks_report.md
```

Measured local state sizes:

```text
.omo files=141 sizeKB=284.6
.sisyphus files=130 sizeKB=204.2
docs\analysis files=17 sizeKB=258.2
resources files=16 sizeKB=137.8
```

Current session:

```text
ses_19b6760c2ffeOG2x5xPsGCHlkk
messages=49
transcript entries=181
duration=16 hours
agents=Sisyphus - Ultraworker, Sisyphus - ultraworker
```

Nearby high-cost sessions:

```text
ses_19d04f30cffe8K0ELlPh6yOdgk messages=111
ses_19e0357e6ffeCwZ5uhcpH4Og9q messages=144
ses_1a0f64c41ffetc6DBi5HSRn0Ql messages=154, compaction
ses_1b1efbbd9fferw6absp2qMVNmC messages=261, compaction
```

Task store status:

```text
completed=74
in_progress=10
pending=19
```

This is the most important local finding: many active/pending tasks are stale or unrelated to current work.

## Boulder State

Both boulder files are identical:

- `.omo/boulder.json`
- `.sisyphus/boulder.json`

They point to an external plan:

```text
C:\Users\Fate_Conqueror\Documents\GitHub\M_Management-track-b\.sisyphus\plans\track-b-auto-sync-ingestion.md
```

Relevant boulder values:

```json
{
  "active_plan": "C:\\Users\\Fate_Conqueror\\Documents\\GitHub\\M_Management-track-b\\.sisyphus\\plans\\track-b-auto-sync-ingestion.md",
  "started_at": "2026-05-03T13:54:49.5858389+10:00",
  "session_ids": ["ses_216fad902ffeLlbnzdVU1S79D5"],
  "plan_name": "track-b-auto-sync-ingestion",
  "agent": "atlas"
}
```

Interpretation:

- Boulder state is stale for this current workspace.
- It references `M_Management-track-b`, not `Just_Management`.
- It started on 2026-05-03, long before current work.
- It can mislead continuation systems if treated as live truth.
- It should be archived or replaced with one current active plan.

Do not delete blindly. Archive first.

## Task/Todo System

OMO task system persists tasks as JSON files under:

```text
.omo/tasks/*.json
```

It tracks fields like:

```text
id
subject
description
status
activeForm
blocks
blockedBy
metadata
repoURL
threadID
```

Current active/pending tasks include old work:

```text
Verify sheets adapter work
Design runtime ingestion architecture
Explore current ingestion context
Wire withone routes and environment examples
Implement POST /api/reservations
Review backend plan docs
Verify backend build
Update New Reservation Dialog
Analyze Azure data sync
Document reservation sync process
Verify reservation modal changes
Create performance report
Analyze target session
Smoke integrations UI
```

Interpretation:

- Task system is not self-cleaning.
- Completed tasks remain stored.
- Stale pending/in-progress tasks remain visible to `task_list`.
- Active task clutter creates continuation confusion.
- It can also inflate context if task list gets injected or repeatedly consulted.

Core rule:

```text
Task system preserves state. It does not decide what is still relevant.
```

## Context Window Basics

Context window is the text budget sent to the model for one turn.

It may contain:

- system prompt
- developer instructions
- user prompt
- project rules
- tool schemas
- available skills/agents
- conversation history
- tool outputs
- file contents that were read
- session summaries
- compaction summaries
- subagent outputs

Two kinds of cost:

### Fixed Cost

Paid every turn.

Examples:

- Sisyphus instructions
- tool schemas
- available tool descriptions
- available skill/agent descriptions
- root `AGENTS.md`
- current environment metadata

### Variable Cost

Paid only after retrieval/tool use.

Examples:

- reading files
- `git status` output
- session transcripts
- web search results
- LSP diagnostics output
- AST-grep results
- subagent result payloads

Critical mental model:

```text
Access != context.
Connected tool != executed tool.
Persisted state != recalled memory.
Compaction != perfect memory.
Handoff != garbage collection.
Task persistence != task relevance.
```

## Why High Consumption Exists Despite Handoff/Compaction/Tasks

### 1. Retention Is Not Curation

`.omo`, `.sisyphus`, boulder, tasks, evidence, plans, and handoffs retain data.

They do not automatically decide:

- which task is stale
- which plan is obsolete
- which session is irrelevant
- which evidence is superseded
- which memory is unsafe or wrong

Without curation, retention increases search space.

### 2. Compaction Is Lossy Summarization

OpenCode compaction summarizes old conversation into structured sections:

```text
Goal
Constraints & Preferences
Progress
Key Decisions
Next Steps
Critical Context
Relevant Files
```

Fetched OpenCode source showed:

```text
DEFAULT_TAIL_TURNS = 2
PRUNE_MINIMUM = 20_000
PRUNE_PROTECT = 40_000
TOOL_OUTPUT_MAX_CHARS = 2_000
```

Compaction helps fit long sessions into context, but it can preserve stale assumptions if those assumptions were considered important.

### 3. Handoff Can Become Another Blob

A good handoff is compact and task-specific.

A bad handoff becomes another long document that future sessions must read.

A handoff should answer:

```text
What is current goal?
What is done?
What remains?
Which files matter?
Which files are forbidden?
What exact verification was run?
What is the next action?
```

It should not replay whole history.

### 4. Search-Mode Multiplies Work

Search-mode instructions ask for:

- background agents
- explore/librarian
- direct search
- web search
- AST-grep
- LSP
- exhaustive synthesis

This is valuable for forensic research. It is expensive for normal tasks.

### 5. Dirty Worktree Forces Safety Checks

Dirty state means agent must protect unknown work.

That causes:

- `git status`
- file reads
- diff inspection
- careful path allowlists
- extra verification

Dirty worktree cost is safety cost.

## OMO Architecture: What It Provides

OMO / Oh My OpenAgent provides:

- Sisyphus orchestrator
- Hephaestus deep worker
- Prometheus planner
- Oracle architecture/debug consultant
- Librarian external research agent
- Explore local codebase search agent
- Metis/Momus plan analysis/review
- Sisyphus-Junior category executor
- categories for model routing
- skills with optional embedded MCPs
- hooks
- session tools
- task tools
- built-in MCPs
- LSP tools
- AST-grep tools
- hashline edit tooling
- Team Mode when enabled
- Ralph/ulw continuation workflows
- compaction/recovery/truncation hooks

Important default/tool facts from current OMO docs:

- built-in MCPs include `websearch`, `context7`, `grep_app`, `lsp`, `ast_grep`
- Team Mode is off by default
- task system persists to `.omo/tasks`
- skill embedded MCPs are on demand
- many advanced pruning/auto-resume settings are config-gated
- dynamic context pruning is documented as default false in current config docs

## What OMO Does Not Guarantee

OMO does not guarantee:

- perfect memory
- perfect compaction
- automatic stale task cleanup
- semantic ranking of every past artifact
- zero-cost connected tools
- free parallel agents
- production-grade memory governance
- safe always-on external memory
- correct boulder state after workspace moves

OMO gives primitives. Usage discipline still matters.

## ECC Lessons Worth Adopting

ECC patterns useful here:

### Hook Profiles

ECC has profile-style controls:

```text
minimal
standard
strict
```

Adopt same idea locally:

```text
minimal: direct tools only
standard: one explore max
deep: 2-3 agents + plan
forensic: exhaustive search + Oracle
```

### Low-Context Mode

ECC supports low-context/no-hooks install paths and session-start context caps.

Adopt concept:

- no background agents by default
- cap session-start injected context
- disable broad memory injection
- load only current task card

### SessionStart Cap

ECC docs mention capping session-start context and turning it off.

Adopt concept:

```text
Session start should include only:
- root AGENTS.md
- local subtree AGENTS.md for target path
- one active task card
- one current handoff
```

### Strategic Compact

ECC has strategic compact patterns.

Adopt concept:

- compact before context emergency
- preserve decisions/current files/commands
- remove stale historical prose
- create fresh session after major milestone

## Github_Analyzer Lessons

`C:\Users\Fate_Conqueror\GitHub\Github_Analyzer` is docs-first, not app-first.

Its `AGENTS.md` says:

- do not invent build/test commands
- read highest-value sources first
- preserve evidence-over-assumption
- prefer targeted edits
- use docs for research tasks

Useful patterns from `Github_Analyzer`:

### 1. Highest-Value Sources Section

Its `AGENTS.md` lists which docs to read first.

Adopt in `Just_Management/AGENTS.md`:

```text
For token/cost/session work, read first:
- docs/analysis/current-orchestration-efficiency-guide.md
- docs/analysis/omo-context-architecture-guide.md
- docs/analysis/token-cost-optimization-report.md
```

### 2. Evaluation-First Memory Plan

`Github_Analyzer/.omo/plans/notebooklm-mcp-memory-evaluation.md` uses:

- fixed scoring rubric
- wave-based execution
- dependency matrix
- must/must-not guardrails
- explicit definition of done
- evidence files
- promotion gate

Adopt for any memory system before installing it.

### 3. NotebookLM RAG Pattern

`NOTEBOOKLM_OPENCODE_RAG_INTEGRATION.md` says MCP-native integration is preferred over per-call CLI subprocesses for OpenCode.

Lesson:

```text
Long-lived MCP server > repeated subprocess calls.
```

### 4. Local Credential Boundary

`NotebookLMSkill.md` uses local auth and MCP/tunnel boundary.

Lesson:

```text
Keep credentials local. Expose only controlled tools.
```

### 5. Lightweight Continuation Files

`.omo/run-continuation/*.json` stores tiny named state.

Lesson:

```text
Continuation state should be small pointers, not giant transcripts.
```

## External Repos Worth Evaluating

Do not install these immediately. Evaluate first.

### 1. context-capsule

URL:

```text
https://github.com/Johnny-Z13/context-capsule
```

Useful idea:

- structured handoff packets
- summary max 500 chars
- decisions
- next steps
- payload max 32 KB
- refs
- TTL/expiry

Adoptable pattern:

```text
Use short-lived context packets instead of long handoffs.
```

### 2. AgentHandoff

URL:

```text
https://github.com/aceandro2812/AgentHandoff
```

Useful idea:

- agent writes structured handoff from current context
- receiving agent queries only what it needs
- inline block can be tiny
- MCP on-demand queries can be 50-200 tokens

Adoptable pattern:

```text
Separate task_state, decisions, warnings, related_files, summary.
```

### 3. open-mem

URL:

```text
https://github.com/clopca/open-mem
```

Useful idea:

- OpenCode plugin
- automatic session capture
- AI compression
- SQLite local store
- progressive disclosure
- memory tools

Adoptable pattern:

```text
Inject compact index; fetch details on demand.
```

### 4. codemem / opencode-mem

URL:

```text
https://github.com/kunickiaj/opencode-mem
```

Useful idea:

- OpenCode + Claude Code memory
- local SQLite
- hybrid retrieval
- automatic injection
- context packs

Adoptable pattern:

```text
Build query-aware memory packs, not full memory dumps.
```

### 5. opencode-claude-code-memory

URL:

```text
https://github.com/ngvoicu/opencode-claude-code-memory
```

Useful idea:

- reuse Claude Code memory inside OpenCode
- inject once per session or always
- compaction support
- memory tool for read/search/update

Adoptable pattern:

```text
Prefer injectMode=once and compactionMode=index for low cost.
```

### 6. agent-mem

URL:

```text
https://github.com/atharvavdeo/agent-mem
```

Useful idea:

- structured memory notes
- one-paste handoff prompts
- OpenCode migration
- Obsidian/project graph
- checkpoint/prepare-next

Adoptable pattern:

```text
Use checkpoint + prepare-next before fresh sessions.
```

### 7. agentmemory

URL:

```text
https://github.com/DITIntl/agentmemory
```

Useful idea:

- searchable/versioned cross-agent database
- BM25 + vector + graph
- provenance citations
- staleness propagation
- token-budgeted context injection

Adoptable pattern:

```text
If using memory, require provenance and staleness handling.
```

### 8. Contextful

URL:

```text
https://github.com/Inferensys/contextful
```

Useful idea:

- context packs
- SQLite FTS5/BM25
- graph relationships
- evidence-backed memory ledger
- stale memory detection

Adoptable pattern:

```text
Ask for one context_pack(query, budget, scope) instead of many reads.
```

### 9. RavByte Agent Memory System

URL:

```text
https://github.com/ravbyte-ai/agent-memory-system
```

Useful idea:

- generated memory directory
- repository map
- architecture docs
- agent worklog
- handoff file
- context index
- CI freshness checks

Adoptable pattern:

```text
Generate small, maintained memory files with freshness checks.
```

### 10. claude-memory / claude-mem variants

Useful idea:

- lifecycle hooks
- observation capture
- progressive disclosure
- search first, fetch details later

Adoptable pattern:

```text
3-layer workflow: search index -> timeline -> full observations only for selected IDs.
```

## Recommended Path

Oracle review confirmed: do not install a memory stack first.

Safe path:

1. Clean stale state.
2. Create one current active context card.
3. Reduce task backlog.
4. Use cost profiles.
5. Add instrumentation/metrics.
6. Evaluate memory tools with a fixed rubric.
7. Adopt only if it beats current handoff/index workflow.

## Immediate Cleanup Plan

### Step 1: Snapshot Current State

Run:

```powershell
git status --short > resources/current-git-status.txt
Get-ChildItem .omo -Recurse -File | Select-Object FullName,Length,LastWriteTime | ConvertTo-Json -Depth 3 > resources/current-omo-files.json
Get-ChildItem .sisyphus -Recurse -File | Select-Object FullName,Length,LastWriteTime | ConvertTo-Json -Depth 3 > resources/current-sisyphus-files.json
```

Reason:

- preserve evidence before cleanup
- avoid accidental loss

### Step 2: Archive Stale Boulder

Do not delete.

Suggested manual process:

```powershell
New-Item -ItemType Directory -Force -Path ".omo\archive\2026-05-27"
Copy-Item ".omo\boulder.json" ".omo\archive\2026-05-27\boulder.json"
Copy-Item ".sisyphus\boulder.json" ".omo\archive\2026-05-27\sisyphus-boulder.json"
```

Then decide whether to replace boulder with current plan or leave no active boulder.

### Step 3: Triage Tasks

Do not mass-delete. Mark stale ones deleted only after review.

Suggested categories:

```text
keep-current: current analysis/session guide tasks
archive-stale: old ingestion/sheets/withone/reservation modal tasks
review: anything tied to unmerged work
```

Current stale-looking tasks include:

```text
Verify sheets adapter work
Design runtime ingestion architecture
Explore current ingestion context
Wire withone routes and environment examples
Verify Prisma connector migration
Implement withone backend foundation files
Analyze Azure data sync
Document reservation sync process
Create performance report
Smoke integrations UI
```

### Step 4: Create Active Context Card

Create:

```text
.omo/ACTIVE_CONTEXT.md
```

Suggested content:

```markdown
# Active Context

## Current Goal
Reduce OMO/OpenCode token consumption and clean stale orchestration state.

## Current Session
ses_19b6760c2ffeOG2x5xPsGCHlkk

## Read First
- docs/analysis/current-orchestration-efficiency-guide.md
- docs/analysis/omo-context-architecture-guide.md
- docs/analysis/token-cost-optimization-report.md

## Do Not Auto-Resume
- Old Track B ingestion boulder plan from M_Management-track-b
- Old sheets adapter tasks
- Old withone foundation tasks
- Old reservation modal tasks unless user asks

## Next Actions
1. Review task backlog.
2. Mark stale tasks deleted or archived.
3. Use cost-profile prompts.
4. Evaluate external memory only after cleanup.
```

### Step 5: Start Fresh Session

Use compact prompt:

```text
[cost-profile: standard]
Read only .omo/ACTIVE_CONTEXT.md and docs/analysis/current-orchestration-efficiency-guide.md.
Goal: continue cleanup of stale OMO task/boulder state.
Do not launch background agents unless explicitly asked.
Do not edit app code.
```

## Process Changes Going Forward

### Use Cost Profiles

#### Minimal

Use for:

- markdown save
- small explanation
- single file check
- rerun status

Prompt:

```text
[cost-profile: minimal]
No background agents. No web. Read only named files. Answer concise.
```

#### Standard

Use for normal repo work:

```text
[cost-profile: standard]
Use direct tools first. At most 1 explore agent if needed. No team-mode. No Oracle unless blocked.
```

#### Deep

Use for multi-file changes:

```text
[cost-profile: deep]
Plan first. Max 2 explore/librarian agents. Bound output. Verify targeted commands.
```

#### Forensic

Use only when high risk:

```text
[cost-profile: forensic]
Exhaustive search. Oracle allowed. Cite evidence. Do not edit unless approved.
```

### Bound Subagent Output

Every subagent prompt should say:

```text
Return max 700 words.
Cite exact files.
Do not edit.
Do not inspect unrelated modules.
```

### Use File Allowlists

For implementation:

```text
Allowed files:
- path/A
- path/B

Forbidden:
- all other files
- migrations unless asked
- .omo unless task is orchestration cleanup
```

### Use Handoff Contract

At end of meaningful session, create short handoff:

```markdown
# Handoff

## Goal

## Done

## Changed Files

## Evidence

## Next Action

## Do Not Reopen
```

Keep under 250 words unless architecture-heavy.

### Use Evidence Contract

For verification evidence:

```text
Save full logs to resources/evidence/YYYY-MM-DD-task-name.log
Summarize only key pass/fail lines in chat.
```

### Use Compaction Contract

Before compaction or fresh session:

```text
Preserve:
- current goal
- current files
- decisions
- commands run
- unresolved blockers
- explicit user constraints

Drop:
- old searches
- failed background model noise
- unrelated tasks
- stale boulder plans
```

## What To Adopt From External Tools

### Adopt Now Without Installing

- context-capsule style short packet
- AgentHandoff split fields
- ECC profiles
- Github_Analyzer highest-value-source section
- evidence-first task records
- OpenCode compaction template awareness

### Evaluate Later

- open-mem
- codemem/opencode-mem
- opencode-claude-code-memory
- Contextful
- agent-memory-system
- AgentHandoff

### Avoid For Now

- heavy graph/vector systems before cleanup
- always-injected memory
- auto-ingesting every tool output
- remote memory with credentials/secrets
- memory systems without staleness/provenance

## Proposed Evaluation Rubric For Memory Tools

Score 0-5:

| Dimension | Question |
|---|---|
| Local-first | Does it store data locally? |
| OpenCode support | Native plugin or MCP? |
| Progressive disclosure | Can it show index first, details later? |
| Token budget | Can injection be capped? |
| Staleness | Can old facts expire/supersede? |
| Provenance | Does memory cite source files/sessions? |
| Privacy | Can secrets be redacted/excluded? |
| Operational cost | Does it need daemon/db/cloud? |
| Failure mode | If it fails, does OpenCode still work? |
| Cleanup | Can it prune/export/delete safely? |

Promotion gate:

```text
Do not adopt unless score >= 35/50 and it reduces repeated context reads in a real task.
```

## Teaching: Worktree, Environment, Context, Memory

### Worktree

A git worktree is a checked-out working copy of a repo.

It has:

- tracked files
- modified files
- staged files
- untracked files
- ignored files

Dirty worktree means git status is not clean.

Why agent cares:

- must not overwrite user changes
- must distinguish old changes from new changes
- must avoid destructive commands

### Untracked Files

Untracked files are present on disk but not in git.

Examples:

```text
?? docs/analysis/new-report.md
?? resources/tmp-output.md
```

They may be:

- new work
- generated logs
- accidental files
- secrets
- temporary artifacts

Do not delete automatically.

### Environment

Environment includes:

- OS
- shell
- cwd
- env vars
- PATH
- installed tools
- config files
- database URLs/API keys

Agents should not assume tools exist.

### Context Window

Context window is current model input budget.

Filling it with old logs reduces reasoning quality and increases cost.

### Memory

Memory is durable state outside current context.

Good memory:

- concise
- evidence-backed
- searchable
- stale-aware
- scoped
- safe

Bad memory:

- giant markdown dumps
- stale task lists
- no provenance
- always injected
- secrets included

### Handoff

Handoff is a compact transition note.

It is not archive.

### Compaction

Compaction summarizes context when window grows too large.

It saves space but loses detail.

### Boulder

Boulder is OMO continuation/active-plan state.

It should point to one live plan.

Current boulder points to stale external plan, so treat as stale until reviewed.

## Recommended User Workflow

### Before Asking Agent To Work

1. Decide cost profile.
2. Name allowed files.
3. State whether web search is allowed.
4. State whether background agents are allowed.
5. If repo dirty, say which files are agent-owned.

Example:

```text
[cost-profile: standard]
Task: update docs only.
Allowed files: docs/analysis/current-orchestration-efficiency-guide.md
No background agents.
No web.
Do not inspect app code.
```

### During Work

Ask for:

```text
show current task list
show changed files only
summarize evidence only
```

Avoid:

```text
maximize search effort
read everything
continue all tasks
fix whole thing
```

unless truly needed.

### After Work

Ask agent to produce:

```text
1. changed files
2. verification run
3. current blockers
4. next fresh-session handoff under 150 words
```

## Concrete Next Actions

### Immediate

1. Review current task backlog.
2. Mark unrelated stale tasks as deleted or archive task directory.
3. Archive stale boulder references.
4. Create `.omo/ACTIVE_CONTEXT.md`.
5. Start a fresh low-context session.

### Short Term

1. Add source-priority section to root `AGENTS.md`.
2. Add cost-profile prompt templates to `docs/analysis/`.
3. Add handoff template.
4. Add task triage process.
5. Keep resources/evidence logs out of active context.

### Medium Term

1. Evaluate one memory/handoff tool with rubric.
2. Prefer local-first, index-first, token-budgeted systems.
3. Instrument repeated reads/tool calls.
4. Track per-session context drivers.

### Do Not Do Yet

- Do not install all memory systems.
- Do not enable always-inject memory.
- Do not delete `.omo` or `.sisyphus` blindly.
- Do not clean git worktree with destructive commands.
- Do not use Team Mode for simple docs/tasks.

## Final Recommendation

Main problem is not missing memory. Main problem is stale persistent state plus long sessions plus exhaustive search instructions.

Best path:

```text
Clean stale boulder/tasks -> create active context card -> use cost profiles -> fresh sessions -> evaluate memory tools later.
```

This gives biggest efficiency win with lowest risk.
