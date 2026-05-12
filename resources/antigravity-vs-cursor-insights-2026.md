# Antigravity vs Cursor — Insights & Comparison (2026)

> Research compiled: 2026-05-05 | Your Antigravity version: **v1.23.2 (TypeScript/Electron)**

---

## 🚀 Google Antigravity

### What It Is
Announced by Google in **November 2025**, Antigravity is an **agent-first agentic development platform** — not merely an AI-augmented editor. It represents the third evolutionary era of AI coding tools:

| Era | Period | Tools |
|-----|--------|-------|
| Autocomplete Era | 2022–2024 | GitHub Copilot |
| Agent-Assisted Era | 2024–2025 | Cursor, Claude Code |
| **Agent-First Era** | **2026** | **Antigravity** |

### Core Architecture

- **Dual-View Interface**
  - *Editor View*: Modified VS Code experience for synchronous, hands-on coding.
  - *Mission Control (Manager View)*: Dashboard to spawn and observe multiple agents working **asynchronously and in parallel**.
- **Artifact-Based Communication**: Agents produce verifiable deliverables — task lists, implementation plans, code diffs, screenshots, browser recordings.
- **End-to-End Automation**: Agents independently navigate web pages, run terminal commands, launch local servers, and perform UI testing to self-verify code changes.
- **Multi-Model Support**: Gemini 3 Pro/Flash, Claude 3.5/4.6, open-source models.
- **Availability**: Public preview since April 2026. Free on Windows, macOS, Linux.

---

## 🎯 Skills System — How Auto-Detection Actually Works

> [!IMPORTANT]
> Skills are **NOT** triggered by hard-coded keyword matching or ML classifiers. The detection is purely **LLM-semantic**.

### The Routing Mechanism (Step by Step)

1. **Session Start**: Antigravity parses the `name` and `description` fields from the YAML frontmatter of every `SKILL.md` in scope.
2. **System Prompt Injection**: These are injected as a structured "meta-tool definition" block into the AI agent's system prompt.
3. **LLM Semantic Matching**: The model (Gemini/Claude) uses native semantic reasoning to match your request against skill descriptions — **no deterministic code involved**.
4. **Skill Loading**: If relevant, a `load_skill` call reads the **full `SKILL.md`** into the active context window to guide execution.

### Skill File Structure

```
.agent/skills/<skill-name>/
├── SKILL.md          ← Required. YAML frontmatter + markdown instructions
├── scripts/          ← Optional executable scripts
├── examples/         ← Optional reference implementations
└── resources/        ← Optional assets, templates
```

### The `description` Field Drives Everything

```yaml
---
name: frontend-design
description: >
  Design thinking for web UI. Use when designing components, layouts,
  color schemes, typography, or creating aesthetic interfaces.
---
```

> [!TIP]
> The `description` field is the **primary driver** for auto-detection. High-signal, specific descriptions improve routing accuracy.

### npm Integration (via `@tanstack/intent`)

```bash
npx @tanstack/intent@latest list                          # List available skills
npx @tanstack/intent@latest load <package>#<skill>        # Load a specific skill
```

Skills from npm packages are placed in `.agent/skills/<skill-name>/SKILL.md` to be auto-discovered.

---

## 🖱️ Cursor (2026 State)

### Latest Features (2026)

| Feature | Description |
|---------|-------------|
| **Composer 2.0+** | Multi-file editing with AI planning and cross-file consistency |
| **`/multitask`** | Spawns multiple async subagents for parallel task execution |
| **Agent Modes** | Agent, Plan, Debug, Ask — tailor AI behavior per task type |
| **Visual Editor** | AI sees screenshots and generates React/Tailwind code |
| **Cursor SDK** | (Beta) Build custom coding agents using Cursor's runtime |
| **Security Agents** | Always-on PR monitoring for vulnerabilities |
| **Cross-IDE via ACP** | JetBrains support via Agent Client Protocol |

### Rules System (`.cursor/rules/*.mdc`)

```yaml
---
description: "React component guidelines"
globs: ["src/components/**/*.tsx"]
alwaysApply: false
---
```

Before a prompt reaches the model, Cursor evaluates active files against rule files and injects relevant instructions — "persistent memory" of your project's standards.

### Skill/Agent Auto-Detection in Cursor

- **`.cursor/skills/` directory**: Agents pick up skills dynamically — tool-sets for git conflicts, docs generation, API integrations.
- **Dynamic Context Discovery**: Agents search for relevant files and patterns before proposing changes automatically.
- **Event-Driven Automation**: Agents triggered by Slack, Linear, or GitHub PRs for background maintenance.

---

## ⚖️ Side-by-Side Comparison

| Dimension | Cursor | Google Antigravity |
|-----------|--------|-------------------|
| **Philosophy** | AI-augmented coding (you drive) | Agent-first automation (you orchestrate) |
| **Primary Role** | Pair programmer / copilot | Mission control / team of agents |
| **Ideal Tasks** | Refactoring, debugging, surgical edits | Scaffolding, complex multi-step orchestration |
| **Skill Detection** | `.cursor/skills/` + dynamic context discovery | LLM-semantic matching of `SKILL.md` frontmatter |
| **Rules Format** | `.cursor/rules/*.mdc` (glob + alwaysApply) | `GEMINI.md`, `AGENTS.md`, per-directory `.md` files |
| **Self-Verification** | Developer reviews diffs before applying | Agent runs tests, screenshots, self-iterates |
| **Parallelism** | `/multitask` for subagents | Mission Control: multiple agents across surfaces |
| **Artifact Output** | Code diffs | Plans, diffs, screenshots, browser recordings |

---

## 🗺️ When to Use Which

> Many 2026 workflows use **both**: Antigravity for initial system scaffolding → Cursor for daily fine-grained refinement.

- **Choose Cursor**: Fine-grained control, speed, stable daily driver for production code.
- **Choose Antigravity**: Delegate large multi-step tasks (plan + build + test + verify) to autonomous agents.

---

## 🔍 Your Workspace Setup

- **Antigravity version**: v1.23.2 (TypeScript/Electron)
- **Skills location**: `.agent/skills/<skill-name>/SKILL.md`
- **Active skills**: 28 skills available (see AGENTS.md)
- **Auto-detection**: ✅ **Yes** — LLM-semantic via `GEMINI.md` routing protocol (`intelligent-routing` skill is MANDATORY)
- **npm skill integration**: `@tanstack/intent` for skill discovery and loading
- **Routing announcement**: `GEMINI.md` requires `🤖 Applying knowledge of @[agent]...` before every code/design response
