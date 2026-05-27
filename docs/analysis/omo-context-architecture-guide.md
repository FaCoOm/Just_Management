# OMO Context Architecture Guide

## Short Answer

Yes, the token-cost analysis applies to this Sisyphus session too.

But the split matters:

- **Always-paid tax**: system/developer prompt, tool schemas, skill/agent descriptions, `AGENTS.md`, current user message.
- **On-demand tax**: files, `.omo`, `.sisyphus`, git diffs, session logs, docs, code, web results. Cost appears only when these are read, searched, fetched, or returned from tools.
- **Tool availability tax**: tools like `ast_grep`, LSP, grep_app, and websearch are exposed to the model. Their schemas/instructions cost context. Their outputs do not enter context until called.
- **Worktree tax**: applies when dirty state must be inspected to avoid overwriting unknown changes.

## How Selective Context Works

The agent does not load the whole repository by default.

Typical flow:

1. Harness injects base context:
   - Sisyphus rules
   - tool schemas
   - available skills and agents
   - root `AGENTS.md`
   - project knowledge
   - current user request

2. Agent calls targeted tools:
   - `read` for selected files
   - `session_info` or `session_search` for selected sessions/terms
   - shell checks for selected directory sizes/status
   - web search/fetch for selected external docs

3. Only returned tool output enters active context:
   - Search indexes stay outside.
   - File contents stay outside until `read`.
   - Web pages stay outside until web fetch/search.
   - AST/LSP/Grep tools stay idle unless invoked.

Core mental model:

```text
Access != context.
Connected tool != executed tool.
Persisted memory != recalled memory.
Compaction != perfect memory.
Hooks != free.
Subagents != free.
Search-mode != normal mode.
```

## Ground-Up Context Tax

Context window means text sent to the model for one turn.

It includes:

- instructions
- conversation history
- tool schemas
- tool outputs already returned
- selected file contents
- summaries or compactions
- current user prompt

Cost grows when more text gets included.

| Thing | Always in context? | Why cost happens |
|---|---:|---|
| System/developer prompt | Yes | Harness rules replay every turn |
| Tool schemas | Yes, for exposed tools | Model must know how to call tools |
| Root/project rules | Yes | `AGENTS.md` and project context injected |
| File contents | No | Only after `read` or search output |
| `.omo` files | No | Only after task/session tools or direct reads |
| Git status | No | Only after command output |
| Web results | No | Only after websearch/fetch |
| Subagent outputs | No until collected | `background_output` adds results |

So context tax has two parts:

- **fixed tax**: paid every turn
- **variable tax**: paid when tools/subagents return data

## Worktree Tax

Dirty worktree means many files changed or untracked.

Why it costs:

- agent must avoid overwriting user work
- must inspect `git status`
- may inspect diffs
- may read files before editing
- may re-check after changes

Recent measured state:

```text
status entries: 7
.omo files=141 sizeKB=284.6
.sisyphus files=128 sizeKB=203.2
.agent files=213 sizeKB=1618
.agents files=5 sizeKB=17.6
```

Example dirty entries at measurement time:

```text
 M .omo/run-continuation/ses_19b6760c2ffeOG2x5xPsGCHlkk.json
?? .omo/archieved/
?? .omo/run-continuation/ses_19b4ebde5ffemMvnca1MEBJZr1.json
?? .omo/tasks/T-8288884a-7e6c-4b74-86dc-ef00b79ef0a1.json
?? docs/analysis/token-cost-optimization-report.md
?? resources/elaborated_token_cost_optimization_report.md
?? resources/kaggle_mcp_setup.md
```

Worktree tax applies, but it varies with how much dirty state exists and whether task requires editing.

## Does `.omo` Auto-Replay?

Mostly no.

`.omo` is available state, not automatically pasted every turn.

Observed roles:

- `.omo/tasks`: task persistence
- `.omo/run-continuation`: small session metadata
- `.omo/plans`: plan cold storage
- `.omo/evidence`: evidence cold storage
- `.omo/notepads`: durable notes

These become expensive only if:

- agent lists them
- agent reads them
- work resumes from them
- task system surfaces them
- continuation hook checks active runs
- user asks to analyze them

So `.omo` is not main cost by bytes. Triggered reads are cost.

## OMO Architecture

Latest docs refer to OMO as **Oh My OpenAgent**, while package/binary names still commonly use `oh-my-opencode`.

OMO is an OpenCode plugin/harness layer that adds:

- **Sisyphus**: main orchestrator
- **Hephaestus**: autonomous deep worker
- **Prometheus**: planner
- **Oracle**: architecture/debugging consultant
- **Librarian**: docs/remote repo researcher
- **Explore**: local codebase search agent
- **Momus/Metis**: plan review and plan critique
- **Sisyphus-Junior**: category executor
- **Categories**: task-domain to model/config routing
- **Skills**: domain workflow and optional MCP injection
- **Hooks**: lifecycle enforcement
- **MCPs**: built-in and skill-embedded tools
- **Task system**: persisted tasks and dependencies
- **Session tools**: list/read/search prior sessions
- **Hashline edit**: safer edit method
- **LSP/AST-grep**: IDE/structural search support
- **Team Mode**: optional multi-agent shared task/mailbox system

Documented current capability surface includes:

- 11 specialized agents
- 54 base hooks, 61 with Team Mode
- built-in MCPs: `websearch`, `context7`, `grep_app`, `lsp`, `ast_grep`
- config-gated tools/features
- Team Mode off by default
- skill-embedded MCPs on demand

## What OMO Enables By Default

Common defaults include:

- Sisyphus orchestration
- category delegation via `task`
- background agents
- built-in MCPs:
  - Exa/websearch
  - Context7 docs
  - Grep.app GitHub search
  - LSP
  - AST-grep
- session tools
- task tools if task system enabled
- hooks unless disabled
- root/scoped `AGENTS.md` context injection
- tool output truncation hooks
- session recovery hooks
- preemptive compaction hook listed as built-in
- compaction context/todo preservation hooks
- skill loading
- skill-embedded MCPs when skill loaded

Important: enabled does not mean running every turn.

Examples:

- `ast_grep` tool exists, but no search happens until called.
- `websearch` exists, but no web query happens until called.
- `grep_app` exists, but no GitHub search happens until called.
- LSP exists, but no diagnostics run until called.
- Skill MCP exists, but spins up only when skill loaded/invoked.

## Why OMO Does Not Activate Everything Always

Everything-always-active hurts reliability and cost.

Reasons:

1. **Context cost**
   - Every MCP/tool surface adds schema/instruction load.
   - Too many tools reduce usable context.

2. **Tool-output explosions**
   - Grep/LSP/AST results can be huge.
   - Unbounded output can fill context faster than code work.

3. **Safety**
   - Hooks can block or modify behavior.
   - Auto-resume/auto-loop can continue when user expected stop.
   - Memory writes can persist wrong facts.

4. **Correctness**
   - Aggressive pruning can delete needed evidence.
   - Bad compaction can lose rules/current task.
   - OpenCode compaction has known historical issues around rule/context preservation.

5. **Latency and rate limits**
   - Parallel agents plus MCPs burn API calls.
   - Always-on background behavior can overload providers.

6. **Security and auth**
   - MCPs may need env vars, tokens, or external access.
   - User-only allowlists should not be extended by project config freely.

7. **User intent**
   - A doc edit should not trigger 5 agents, web search, browser, LSP, and build.

OMO exposes many capabilities, but gates them by:

- explicit tool call
- explicit skill load
- config flags
- hook lifecycle
- task/category delegation
- Team Mode opt-in

## Compaction

There are two layers.

### 1. OpenCode Base Compaction

OpenCode can:

- detect context overflow
- summarize old conversation
- preserve recent turns
- prune old tool outputs when configured
- replay/continue after compaction

Fetched OpenCode source showed:

```text
DEFAULT_TAIL_TURNS = 2
PRUNE_MINIMUM = 20_000
PRUNE_PROTECT = 40_000
TOOL_OUTPUT_MAX_CHARS = 2_000
```

Compaction summary structure includes:

- Goal
- Constraints & Preferences
- Progress
- Key Decisions
- Next Steps
- Critical Context
- Relevant Files

### 2. OMO Enhancements

OMO adds hooks/features around compaction and recovery:

- `context-window-monitor`
- `tool-output-truncator`
- `preemptive-compaction`
- `compaction-context-injector`
- `compaction-todo-preserver`
- `session-recovery`
- `anthropic-context-window-limit-recovery`
- `dynamic_context_pruning` config

Important nuance:

- OMO ships these hooks.
- Some are built in and active unless disabled.
- Advanced knobs like `aggressive_truncation`, `auto_resume`, and `dynamic_context_pruning.enabled` are config-gated/default false in current config docs.
- Compaction is lossy summarization, not perfect memory.

## Memory: What OMO Has vs Does Not Have

OMO has persistence primitives:

- `.omo/tasks`
- `.omo/notepads`
- `.omo/evidence`
- `.omo/plans`
- `.omo/run-continuation`
- session history tools
- `/handoff`
- `/init-deep`
- compaction summaries
- task system with dependencies
- subagent notepads/evidence patterns

OMO does not automatically equal a production-grade memory system.

It does not guarantee:

- semantic vector recall of all past work
- perfect cross-session memory
- perfect preservation after compaction
- deduplicated truth store
- automatic relevance ranking for all artifacts
- automatic correction of stale memory
- cost-aware memory retrieval every turn
- safe global memory writes without user controls

Persistence exists. Recall is still tool/hook/config driven.

## Search Effort Clarification

Tools can be connected by default without running by default.

Current OMO docs say built-in MCPs are enabled by default:

- `websearch`
- `context7`
- `grep_app`
- `lsp`
- `ast_grep`

That means the agent can call them. It does not mean they all run automatically.

A prompt with explicit search-mode instructions changes behavior:

```text
Launch multiple background agents.
Use explore/librarian.
Use direct grep/rg/ast-grep/LSP.
Never stop at first result.
```

That instruction causes variable cost because the agent acts on it.

If omitted, fewer tools may be used.

## Why Search-Mode Multiplies Cost

Search-mode can trigger:

- main-agent analysis
- explore subagent prompt
- librarian subagent prompt
- web search results
- local file reads
- direct tool outputs
- final synthesis

Each branch adds context. Useful for research. Expensive for small tasks.

## Does This Apply To This Assistant?

Yes.

In the prior explanation turn:

- base Sisyphus/developer instructions were large
- available skill list was large
- tool schema list was large
- project `AGENTS.md` was injected
- user prompt repeated search/analyze-mode text
- background agents were launched because user required it
- one librarian failed due unavailable model, but failure output still cost
- local reports and external docs were read/fetched
- `.omo`, `.sisyphus`, and git status were measured

So same cost pattern applies here.

But retrieval remained selective:

- no whole repo load
- no whole `.omo` load
- no all sessions read
- no all docs read
- only targeted tool outputs entered context

## Best Operating Modes

Suggested profiles:

```text
[cost-profile: minimal]
Direct tools only. No subagents. Use for small fixes/docs.

[cost-profile: standard]
1 explore max. No team-mode. Use for normal implementation.

[cost-profile: deep]
2-3 agents. Plan first. Use for multi-module work.

[cost-profile: forensic]
Exhaustive search, Oracle, citations. Use for high-risk architecture/debug/security only.
```

Low-cost explanation prompt:

```text
[cost-profile: standard]
Task: Explain X.
Do not use subagents unless needed.
Use direct reads/search only.
Return concise answer with evidence.
```

Tiny task prompt:

```text
[cost-profile: minimal]
Do not launch background agents.
Read only these files: A, B.
Answer only from those files.
```

## Bottom Line

OMO is a powerful harness, not a magic autonomous operating system.

It provides:

- orchestration
- specialized agents
- background work
- categories
- skills
- MCPs
- hooks
- truncation/compaction aids
- task persistence
- session search
- safer edit/search tooling

It does not automatically provide:

- perfect context management
- perfect memory
- free always-on tools
- zero-cost multi-agent execution
- guaranteed compaction correctness
- production-grade truth/memory governance

Main cost control remains operational discipline:

- choose smaller mode
- bound tools
- use compact handoffs
- keep dirty worktree low
- invoke exhaustive search only when uncertainty/risk justifies it
