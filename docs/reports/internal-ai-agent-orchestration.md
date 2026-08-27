# Internal AI Agent Orchestration

Date: 2026-07-08

## Scope

This document describes the current OpenCode / OhMyOpenAgent orchestration available in this environment, how agent personas from `C:\Users\Fate_Conqueror\.config\opencode\agents` are invoked, and how to improve persona use without overbuilding the system.

## Current Inventory

Global config:

```text
C:\Users\Fate_Conqueror\.config\opencode\opencode.json
```

Global persona directory:

```text
C:\Users\Fate_Conqueror\.config\opencode\agents
```

Observed persona count:

```text
184
```

Examples present:

```text
ai-engineer.md
backend-architect.md
frontend-developer.md
code-reviewer.md
minimal-change-engineer.md
ui-designer.md
agents-orchestrator.md
```

Each persona file uses OpenCode agent frontmatter:

```yaml
---
name: AI Engineer
description: Expert AI/ML engineer specializing in machine learning model development, deployment, and integration into production systems.
mode: subagent
---
```

That means the personas are loadable as subagents when invoked by name.

## Current Invocation Model

The active orchestration system has two main delegation paths.

### 1. Persona Subagent

Use this when an exact domain persona exists and expertise matters more than category-level model routing.

```ts
task({
  subagent_type: "AI Engineer",
  description: "Assess AI pipeline",
  prompt: "Assess this RAG/ML pipeline design and return concrete risks plus minimal implementation guidance."
})
```

The `subagent_type` value should match the persona frontmatter `name`, not necessarily the filename.

### 2. Category Delegate

Use this when the optimized task category matters more than a named persona.

```ts
task({
  category: "visual-engineering",
  load_skills: ["frontend", "taste-design"],
  prompt: "Implement the existing design-system update with minimal UI diffs."
})
```

Categories currently include domains such as:

```text
visual-engineering
deep
ultrabrain
quick
writing
unspecified-high
unspecified-low
artistry
```

## Current Hierarchy

Effective instruction hierarchy:

1. System/developer instructions.
2. Project `AGENTS.md` and nested `AGENTS.md` files.
3. Loaded skills.
4. Orchestrator judgment.
5. Delegation prompt.
6. Persona prompt or category agent behavior.

Personas do not automatically override the orchestrator. The orchestrator must explicitly choose them with `task(subagent_type=...)`.

## Current Gap

The persona files exist, but selection is mostly convention/prompt-driven.

Today, the orchestrator often chooses category delegation:

```ts
task({ category: "deep", ... })
task({ category: "visual-engineering", ... })
```

instead of exact persona delegation:

```ts
task({ subagent_type: "Backend Architect", ... })
task({ subagent_type: "AI Engineer", ... })
```

This is not a file-discovery problem. It is a routing-policy problem.

## Recommended Routing Policy

Add a persona-first routing rule to global or project instructions.

Suggested policy:

```md
## Persona-First Routing

When delegating, first check whether a named persona in `~/.config/opencode/agents` directly matches the task domain.

Prefer `task(subagent_type="<Persona Name>")` for exact domain work.
Use `task(category="...")` only when no exact persona fits, or when the category model specialization is explicitly superior.

Routing table:

- AI/ML, embeddings, RAG, model eval, intelligent automation -> `AI Engineer`
- Backend API, DB schema, system design, cloud architecture -> `Backend Architect`
- Frontend implementation, React, performance -> `Frontend Developer`
- Visual design systems, interface aesthetics -> `UI Designer`
- Surgical bug fixes/minimal diffs -> `Minimal Change Engineer`
- Code review -> `Code Reviewer`
- Database performance/schema/query tuning -> `Database Optimizer`
- Deployment, CI, infrastructure -> `DevOps Automator` or `Infrastructure Maintainer`
- Security review/threat modeling -> `Security Engineer`
- API validation -> `API Tester`
- Documentation -> `Technical Writer`

Fallbacks:

- hard unknown architecture/debugging -> `oracle`
- codebase search -> `explore`
- external docs/examples -> `librarian`
- UI taste/visual implementation requiring specialized model -> category `visual-engineering` with frontend/design skills
- broad autonomous multi-file implementation -> category `deep`
```

Best project-local location:

```text
C:\Users\Fate_Conqueror\GitHub\Just_Management\AGENTS.md
```

Best global location:

```text
C:\Users\Fate_Conqueror\.config\opencode\AGENTS.md
```

If using a global instruction file, ensure `opencode.json` includes it in `instructions`.

```json
{
  "instructions": [
    "AGENTS.md",
    "C:/Users/Fate_Conqueror/.config/opencode/AGENTS.md"
  ]
}
```

OpenCode config is not hot-reloaded. Restart OpenCode after config/instruction changes.

## Recommended Delegation Contract

Persona prompts should always include:

```text
TASK: one atomic goal
EXPECTED OUTCOME: concrete deliverable
REQUIRED TOOLS: allowed tools only
MUST DO: hard requirements
MUST NOT DO: forbidden scope
CONTEXT: files, repo rules, constraints
```

Example:

```ts
task({
  subagent_type: "Minimal Change Engineer",
  load_skills: ["opencode-karpathy-guidelines"],
  prompt: `
TASK: Fix only the reported auth persistence bug.
EXPECTED OUTCOME: Smallest diff that persists connection metadata across redeploy.
REQUIRED TOOLS: codegraph, read, apply_patch, lsp_diagnostics, bash tests.
MUST DO: Preserve existing REST/Prisma/Azure architecture.
MUST NOT DO: Add new auth framework, new dependency, or UI redesign.
CONTEXT: Just_Management uses frontend REST repositories and backend Prisma only.
`
})
```

## Should This Be Enforced Inside OhMyOpenAgent?

Recommendation: not first.

Use instruction-level enforcement first. It is lower risk, reversible, and enough for most routing mistakes.

Modify the OhMyOpenAgent plugin only if repeated sessions still ignore persona routing after the instruction policy is in place.

## Enforcement Options

### Option A: Instruction Policy

Add persona routing to `AGENTS.md` or global OpenCode instructions.

Pros:

- lowest risk
- no plugin maintenance
- transparent behavior
- easy to tune per project

Cons:

- soft enforcement
- model can still choose category routing incorrectly

Use first.

### Option B: Command Wrapper

Create a command such as:

```text
/delegate <task>
```

The command prompt forces persona selection before delegation.

Pros:

- stronger than plain instructions
- no plugin internals
- easy user control

Cons:

- only works when using that command

Use if you want explicit manual routing.

### Option C: Router Skill

Create a skill such as:

```text
persona-routing
```

Load it before delegation-heavy tasks.

Pros:

- reusable across projects
- can contain the full routing table
- lower risk than plugin mutation

Cons:

- still soft enforcement
- must be loaded or auto-triggered

Use if several repos need the same routing policy.

### Option D: Plugin-Level Enforcement

Modify OhMyOpenAgent or add a local OpenCode plugin hook to inspect/transform task calls.

Pros:

- hard enforcement
- consistent across sessions
- can log routing decisions

Cons:

- highest risk
- plugin API coupling
- can break valid category routing
- can create hidden behavior that is hard to debug
- requires regression tests against task invocation behavior

Use only after Option A/B/C fail.

## If Plugin Enforcement Is Needed

Prefer an external local plugin over editing vendored OhMyOpenAgent package files.

Add:

```text
C:\Users\Fate_Conqueror\.config\opencode\plugins\persona-router.ts
```

Then register it in `opencode.json` if auto-discovery is unavailable.

High-level plugin behavior:

```ts
export default async () => ({
  "tool.execute.before": async (input, output) => {
    if (input.tool !== "task") return;
    const args = output.args;
    if (!args || args.subagent_type || !args.category) return;

    const prompt = String(args.prompt ?? "").toLowerCase();

    if (prompt.includes("rag") || prompt.includes("embedding") || prompt.includes("model")) {
      args.subagent_type = "AI Engineer";
      delete args.category;
    }

    if (prompt.includes("prisma") || prompt.includes("api") || prompt.includes("backend")) {
      args.subagent_type = "Backend Architect";
      delete args.category;
    }
  }
});
```

This is intentionally pseudocode. Validate against the current OpenCode plugin schema before implementation.

Important guardrails if implemented:

- Never rewrite explicit `subagent_type`.
- Never rewrite `oracle`, `explore`, `librarian`, or `plan`.
- Never rewrite `visual-engineering` when visual design quality is the priority.
- Log every rewrite.
- Allow opt-out via prompt marker such as `[no-persona-router]`.
- Keep routing table small.

## Recommended Implementation Order

1. Add persona-first routing policy to global/project instructions.
2. Add a `persona-routing` skill if the policy should travel across projects.
3. Add `/delegate` command if manual explicit routing is desired.
4. Only then consider a local plugin hook.
5. Avoid editing OhMyOpenAgent internals unless contributing upstream.

## Answer To The Plugin Question

Do not modify OhMyOpenAgent internals yet.

The current problem is routing policy, not platform capability. The personas are already installed and invokable. Start with instruction-level enforcement and a small routing skill/command. Plugin-level enforcement is justified only if you need hard guarantees after repeated routing failures.

## Security Note

The global config contains sensitive values. Move secrets to environment references where supported, for example:

```json
"Authorization": "Bearer {env:DOCKER_MCP_TOKEN}"
```

Do not quote, commit, or duplicate raw tokens in reports or prompts.
