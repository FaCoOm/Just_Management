# OMO (Oh-My-Openagent) Guide & Integration Framework

> [!NOTE]
> **Root Cause Analysis:** Auto-commit or auto-documentation did not execute because current safety policy dictates that Git commits happen *only* when the user explicitly asks. OMO provides tools for atomic commits, PR workflows, notes, handoff, and review, but it does not mean every implementation auto-commits by default.

> [!WARNING]
> **Potential Secrets Detected:** Highly sensitive credentials were found in the local configuration file: [opencode.json](file:///C:/Users/Fate_Conqueror/.config/opencode/opencode.json). Do not repeat these values. If these are active, production-grade secrets, please move them to environment variables and rotate them immediately.

---

## Why No Automatic Commits?

The default agent contract strictly blocks implicit Git operations.
Our active rules state:
1. Only commit, amend, push, or create PRs when **explicitly requested**.
2. Before committing, inspect `git status`, `git diff`, and the recent log.
3. Stage only intended files and **never commit secrets**.

This is a deliberate safety policy, not model hesitation.

OMO features a `git-master` skill, but it is **opt-in by intent**:
- Triggered when the user says "commit".
- Triggered when the user invokes a PR workflow.
- Triggered when a command or skill explicitly includes a commit phase.
- Triggered when a release/publish workflow requires synced commits.

The `git-master` skill confirms commit mode triggers from explicit commit intent. It performs atomic commits, style detection, and split planning, requiring the `$env:GIT_MASTER='1';` prefix on every git command.

Therefore, the previous implementation did not auto-commit because:
1. The user requested to implement/fix, not commit.
2. Committing changes can be an irreversible workflow state.
3. The dirty worktree may contain user or other-agent edits.
4. Auto-staging can accidentally include unrelated files.
5. Active rules forbid implicit Git writes.

### How to Request Commits
If you want atomic commits, use explicit intent:
> "Implement this and commit atomically when verification passes."
> "Use `git-master`. Split commits by concern. Do not push."

Or request a full lifecycle:
> "Use `work-with-pr`: implement this end-to-end, create atomic commits, open a PR, run the CI/review-work loop, and merge when all gates pass."

---

## Why No Automatic Implementation Documentation?

For the same safety and clarity reasons, OMO has documentation commands, but standard implementation does not automatically generate files unless prompted or command-driven.

You have a dedicated command configuration at:
[implement-with-notes.md](file:///C:/Users/Fate_Conqueror/.config/opencode/commands/implement-with-notes.md)

It requires:
- Creating `implementation-notes.html` before code edits.
- Stamping entries with timestamps.
- Updating on meaningful decisions, deviations, tradeoffs, and questions.
- Providing final handoff points pointing to the notes.

However, this command only runs if explicitly invoked; it is not default behavior for every implementation.

### How to Request Documentation
> `/implement-with-notes Implement manual reservation creation end-to-end.`

Or:
> "Implement this feature. Maintain `docs/implementation/<feature>-YYYY-MM-DD.md` as a running handoff and update it after each meaningful decision."

For simple Markdown docs, you also have:
[md.md](file:///C:/Users/Fate_Conqueror/.config/opencode/commands/md.md)

Usage:
> `/md docs/implementation/manual-reservation-handoff.md --dated summarize current state, files changed, decisions, verification, next steps`

---

## What OMO Actually Provides

Based on OMO GitHub documentation and your local configuration, OMO acts as a powerful harness layer over OpenCode.

### OMO Architecture & Component Map

| Component | Purpose |
| :--- | :--- |
| **Sisyphus** | Main orchestrator. Plans, delegates, and drives work. |
| **Hephaestus** | Autonomous deep worker. Goal-oriented implementation. |
| **Prometheus** | Planner. Invoked via `/start-work`. |
| **Oracle** | Architecture and debugging consultant (Read-only). |
| **Librarian** | Manages documentation, remote repositories, and library usage. |
| **Explore** | Performs local codebase search. |
| **Categories** | Routes tasks by domain/model: `quick`, `deep`, `ultrabrain`, `visual-engineering`, `writing`, etc. |
| **Skills** | Specialized workflows: `git-master`, `review-work`, `work-with-pr`, `frontend-ui-ux`, etc. |
| **Commands** | Slash command workflows: `/handoff`, `/start-work`, `/ulw-loop`, `/refactor`, etc. |
| **Hooks** | Lifecycle automation: keyword detection, compaction, `AGENTS` injection, tool output truncation, and recovery. |
| **Task System** | Persistent task management in `.omo/tasks` or configured path. |
| **Team Mode** | Multi-agent team with a mailbox and task list (enabled in your config). |

### Configuration Loading
OMO upstream docs state configuration loads from:
1. Project-level `.opencode/oh-my-openagent.json[c]`
2. Legacy `.opencode/oh-my-opencode.json[c]`
3. User config under `~/.config/opencode/`

Your project does not have a local `.opencode` config. Your active user config is loaded from:
[oh-my-openagent.json](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/oh-my-openagent.json)

**Important Enabled Settings:**
- `experimental.task_system: true`
- `experimental.aggressive_truncation: true`
- `experimental.auto_resume: true`
- `team_mode.enabled: true`
- `team_mode.tmux_visualization: true`
- `git_master.commit_footer: true`
- `hashline_edit: true`
- `runtime_fallback.enabled: true`

So OMO is strongly installed and configured, but auto-commits and documentation still require explicit workflow invocation.

### OMO Commands & Hooks Reference

```text
OMO Commands:
  - init-deep
  - ralph-loop
  - ulw-loop
  - cancel-ralph
  - refactor
  - start-work
  - stop-continuation
  - handoff
```

```text
OMO Hooks:
  - keyword-detector
  - context-window-monitor
  - preemptive-compaction
  - compaction-context-injector
  - compaction-todo-preserver
  - session-recovery
  - directory-agents-injector
  - tool-output-truncator
  - auto-slash-command
```

> [!NOTE]
> **Hooks Capability Boundary:** Hooks automate keyword detection, context compaction, and error recovery, but they **do not** safely auto-commit feature chunks. Doing so would risk committing unrelated dirty states or exposing secrets.

---

## How You Should Use Modes

Adapt your operational mode depending on the task's complexity, cost limits, and scope.

### 1. Minimal Mode
Use for small questions, tiny fixes, and quick documentation edits.

**Example Prompt:**
```text
[cost-profile: minimal]
Do not launch background agents.
Read only files needed.
Fix X.
Run typecheck/build if changed.
Do not commit.
```

*Best for:* Typos, one-file bugs, quick conceptual explanations, or minor doc updates.

### 2. Standard Implementation Mode
Use for regular application development and standard feature additions.

**Example Prompt:**
```text
Implement X end-to-end.
Use 1 explore agent max if needed.
Run project verification.
Create handoff summary.
Do not commit unless I explicitly say.
```

*Best for:* Single features, localized backend/frontend changes, or working within a known area.

### 3. Analyze Mode
Triggers broad context gathering and architectural reasoning.

**Best for:**
- Debugging complex issues ("Why is this broken?")
- Exploring technical approaches ("How should we approach X?")
- Architecture uncertainty and multi-file unknowns

*Note:* Higher token cost, but extremely effective when uncertainty is high.

### 4. Deep Mode
Use when the task is broad and requires autonomous research and self-correction.

**Example Prompt:**
```text
Use deep mode.
Research codebase first.
Implement smallest correct solution.
Verify through app surface.
Create compact handoff.
Do not commit.
```

*Best for:* New subsystems, unfamiliar codebases, cross-cutting changes (DB + Backend + Frontend), or third-party integrations.

### 5. Ultrawork / ULW Mode
OMO's high-drive "do everything, do not stop" mode. Highly powerful and comprehensive.

**Example Prompt:**
```text
ultrawork this feature.
Keep scope bounded to <feature>.
Use specialists only when needed.
Update implementation notes.
Do not commit unless explicitly instructed.
```

*For autonomous looping:*
> `/ulw-loop <goal>` (Use carefully; loop modes can consume substantial tokens).

*Best for:* Aggressive completion requirements, multi-module features, or when you want the agent to push autonomously through blockers. Avoid for simple bugs or cost-sensitive tasks.

### 6. Hyperplan Mode
Runs adversarial team planning before executing high-risk plans.

**Example Prompt:**
> `/hyperplan Plan migration from current REST dashboard data flow to X.`
*(Requires Team Mode, which is enabled in your config).*

*Best for:* Large-scale architectural migrations, PRD to implementation plan translation, and avoiding naive or shallow plans.

### 7. Work-with-PR Mode
The complete, automated Git lifecycle workflow.

**Example Process:**
1. Creates clean worktree
2. Implements features
3. Generates atomic commits
4. Pushes branch
5. Creates Pull Request
6. Runs CI/CD checks
7. Executes `review-work`
8. Waits for Cubic/User approval
9. Iteratively applies fixes
10. Merges Pull Request
11. Performs branch cleanup

**Usage Prompt:**
> "Use `work-with-pr`: implement <feature> and land it as a PR."

### 8. Implement-with-notes Mode
Use when traceability and detailed design tracking matter, but a PR is not yet required.

**Usage Prompt:**
> `/implement-with-notes Implement <feature>.`
*(Creates and maintains `implementation-notes.html` across sessions).*

### 9. Review-work Mode
Runs rigorous verification and quality checks after a significant implementation, before staging/merging.

**Usage Prompt:**
> `/review-work Review current branch changes against goal: <goal>.`

Executes a 5-pillar review structure:
- Goal verification
- QA execution
- Code quality inspection
- Security auditing
- Context mining

### 10. Handoff / Compaction Mode
Use before ending a long session to compress and persist continuation context.

**Usage Prompt:**
> `/handoff Create compact continuation context for next session.`

*Or manual variant:*
> "Create `docs/implementation/<feature>-handoff-YYYY-MM-DD.md`. Include goals, files changed, architectural decisions, verification logs, blockers, next steps, and what *not* to re-read."

---

## Best Command Combinations

### Scenario A: Feature Development (No PR Yet)
```text
/implement-with-notes Implement <feature>.
[After verification] Create compact handoff. Do not commit.
```

### Scenario B: Feature with Commits but No PR
```text
Implement <feature>.
[After verification passes] Use git-master to commit atomically. Do not push.
Create docs/implementation/<feature>-handoff-YYYY-MM-DD.md.
```

### Scenario C: Feature Landed Directly as PR
```text
Use work-with-pr: implement <feature>, commit atomically, create PR, run CI + review-work + Cubic, merge when all gates pass.
```

### Scenario D: Addressing Unclear Architecture
```text
/hyperplan <problem-statement>
[After plan approval] /start-work
```

### Scenario E: Existing Plan Execution
```text
/start-work docs/plans/<plan>.md
```

### Scenario F: Post-Implementation Quality Gate
```text
/review-work Review current changes against original goal. Run app-level QA.
```

### Scenario G: Ending Session Safely
```text
/handoff
```

### Scenario H: Releasing a Package
```text
/pre-publish-review
/publish patch
```
*(Specifically for npm-style packages; requires explicit patch/minor/major versioning and user confirmation).*

---

## Recommended Workflow for This Project

For the `Just_Management` workspace, use this default operating contract for every non-trivial feature:

1. **Document first:** Create or refresh `docs/implementation/<feature>-YYYY-MM-DD.md` or `implementation-notes.html`.
2. **Slice implementation:** Implement in the smallest verifiable logical slices.
3. **Targeted verification:** After each slice, run focused checks.
4. **Final quality gate:** Once fully complete, run:
   - Frontend: `npm run typecheck` and `npm run build`
   - Backend: `cd backend && npm run build`
   - Prisma: `npm run db:generate`, `npm run db:validate`, and `npm run db:verify:migration`
   - Ingestion: `cd backend && npm run verify-ingestion` or `npm run verify:all`
5. **Handoff:** Create a compact continuation handoff before ending.
6. **Git Operations:** Only commit or create PRs when instructed (using `git-master` or `work-with-pr`).

---

## Best Prompts for You to Use

### "I want optimized development with commits and docs"
```text
Implement <feature> end-to-end.
Workflow requirements:
- Maintain implementation notes in docs/implementation/<feature>-YYYY-MM-DD.md.
- Update notes after every meaningful decision/tradeoff.
- Verify through app/API surface.
- When verification passes, use git-master and create atomic commits.
- Do not push.
- Final response: changed behavior, commits created, verification run, remaining risks.
```

### "I want full PR lifecycle"
```text
Use work-with-pr for <feature>.
Requirements:
- Isolated worktree
- Implementation notes
- Atomic commits
- PR creation
- CI checks
- review-work
- Cubic approval
- Merge only when all gates pass
```

### "I want planning first"
```text
/hyperplan <feature/problem>
[After plan approval] Use /start-work to execute.
```

### "I want lower token cost"
```text
[cost-profile: standard]
No team mode unless blocker.
At most 1 explore agent.
Use direct reads only for target files.
Create compact handoff.
```

### "I want no surprises"
```text
Do not commit, push, create PR, install packages, or edit config unless I explicitly approve.
```

---

## Was OMO Used Incorrectly?

Partially, yes. If you expected automatic commits, documentation, or PR generation, you needed to explicitly invoke the workflow designed for those outcomes.

A plain **"implement X"** instruction means:
- Edit the target code.
- Verify the local changes.
- Provide a final report.

It **does not** imply:
- Committing after each sub-task.
- Creating documents automatically.
- Opening/merging Pull Requests.
- Creating release notes.

To achieve these, use OMO's intent-rich commands:
- `/implement-with-notes` for continuous tracing.
- `git-master` or "commit atomically" for safe commits.
- `work-with-pr` for the full branch/PR/merge lifecycle.
- `/handoff` for seamless session transitions.
- `/review-work` for multi-dimensional validation.
- `/hyperplan` for adversarial, collaborative planning.
- `/start-work` for structured, step-by-step execution.

---

## Suggested Default Rule to Add

If you want this operational contract always active, add the following to your root [AGENTS.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/AGENTS.md):

```markdown
## Implementation Workflow
For any non-trivial feature:
- Maintain `docs/implementation/<feature>-YYYY-MM-DD.md` as running notes.
- Update notes after meaningful decisions, deviations, tradeoffs, verification, and blockers.
- Do not commit unless the user says “commit”, “PR”, or “land”.
- If the user says “commit”, load `git-master` and create atomic commits.
- If the user says “PR” or “land”, use `work-with-pr`.
- Before ending long sessions, create `/handoff` or a compact continuation handoff doc.
```

For safer, checkpoint-based auto-commits, request:
> "When I say 'implement and checkpoint', run targeted verification after each logical slice, use `git-master`, commit only files changed for that slice, and never push without explicit approval."

*(Note: It is highly recommended not to enable unconditional auto-commits to prevent staging errors or secret leaks).*