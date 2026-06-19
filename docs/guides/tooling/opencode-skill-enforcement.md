# OpenCode Skill Enforcement Guide

This guide explains how to make a project-local OpenCode skill load reliably at conversation start or at the right points in the development lifecycle.

## First Principle: what is actually enforceable

There are two different enforcement levels:

1. **Instruction-level enforcement** — the repo tells the agent to invoke a skill, usually through `AGENTS.md`.
2. **Harness-level enforcement** — the OpenCode runtime, wrapper, or launcher injects the skill invocation before the conversation really begins.

If you only control the repository, you can strongly instruct the behavior but you cannot guarantee hard startup enforcement. True automatic invocation on every conversation start requires control of the harness, wrapper, or system/developer prompt layer.

## Recommended default stack

For most teams, the best balance is:

- Keep the skill in `.agents/skills/<skill-name>/SKILL.md`.
- Reference it explicitly from the root `AGENTS.md`.
- Add lifecycle trigger points so the skill is re-invoked before planning, implementation, and completion.

That gives good portability across projects without depending on hidden runtime changes.

## Approach 1: Root `AGENTS.md` policy

**Strength:** Medium  
**Portability:** High  
**Best when:** You want a repo-native default that works anywhere the repo is opened.

Add an explicit requirement near the top of the root guide:

```md
Before any substantial response or code change, invoke the OpenCode skill
`opencode-karpathy-guidelines`.
If the task is trivial and purely conversational, use judgment.
```

Why this works:
- The instruction is visible in the repository.
- It travels with the codebase.
- It is easy to audit and update.

Limit:
- It is still policy, not hard runtime enforcement.

## Approach 2: Project-local skill plus startup rule

**Strength:** Medium-high  
**Portability:** High  
**Best when:** You want the repo to carry both the rule and the skill implementation.

Structure:

```text
.agents/
  skills/
    opencode-karpathy-guidelines/
      SKILL.md
AGENTS.md
```

Then in `AGENTS.md`, require a startup call such as:

```md
At the start of any coding-focused conversation, load the skill
`opencode-karpathy-guidelines` before moving into planning or implementation.
```

This is the best project-level pattern if you want a reusable repo that other teams can clone.

## Approach 3: Wrapper command or bootstrap command

**Strength:** High  
**Portability:** Medium  
**Best when:** Your team uses a shared launcher or a standard “start work” command.

Examples:
- A shell alias that starts OpenCode and prepends a startup instruction.
- A team script named `start-opencode` that injects a mandatory “load skill first” instruction.
- A slash command or session macro that becomes the required way to begin development work.

Why this works:
- The wrapper can force the opening message or prompt payload.
- Team members get consistent behavior without remembering the rule manually.

Limit:
- It depends on team workflow discipline or local tooling.

## Approach 4: Harness-level prompt injection

**Strength:** Very high  
**Portability:** Low  
**Best when:** You control the OpenCode platform configuration or app-level orchestration.

If you own the environment that launches OpenCode, add a developer/system-level rule like:

```text
On every new coding conversation, invoke the skill
`opencode-karpathy-guidelines` before any substantial response.
```

This is the only approach that is close to true automatic startup enforcement.

Limit:
- It requires platform control, not just repository control.

## Approach 5: Lifecycle enforcement instead of startup-only enforcement

**Strength:** High for real work  
**Portability:** High  
**Best when:** You care more about correct behavior during development than at the literal first message.

Use explicit trigger points:

- **Conversation start** — load the skill for coding-focused sessions.
- **Before planning** — reload it before multi-step work.
- **Before implementation** — require it before touching files.
- **Before review/refactor** — require it before broad changes.
- **Before completion** — require it again before claiming success.

This pattern is often more practical than trying to enforce a universal first-turn rule for every kind of conversation.

## Practical recommendation matrix

| Goal | Best approach |
|---|---|
| Portable across many repos | Root `AGENTS.md` + local skill |
| Strong team-wide consistency | Wrapper command + root `AGENTS.md` |
| True startup automation | Harness-level prompt injection |
| Best behavior during actual development | Lifecycle enforcement triggers |

## Suggested implementation order

1. Start with a reusable local skill.
2. Add a root `AGENTS.md` rule that explicitly invokes it.
3. Add lifecycle trigger points for planning, implementation, and completion.
4. If you control the launcher, add wrapper or harness-level startup injection.

## Example repo policy block

```md
## Skill Enforcement

Before any substantial coding response, planning step, or file modification,
invoke the OpenCode skill `opencode-karpathy-guidelines`.

Re-invoke it before:
- multi-step planning,
- implementation,
- refactoring,
- review,
- and final completion claims.
```

## Bottom line

If you want something universal, use **project-local skill + root `AGENTS.md` rule + lifecycle triggers**. If you want true startup automation, move the enforcement into the OpenCode launcher or harness configuration.
