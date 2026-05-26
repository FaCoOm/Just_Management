---
name: backend-analysis
description: Analyze backend, automation, and Chrome-extension-backed systems and produce evidence-based API or architecture documentation with verified source references
allowed-tools:
  - "glob"
  - "grep"
  - "read"
  - "write"
  - "bash"
  - "ast_grep_search"
---

# Backend Analysis Skill

Use this skill when you need a rigorous, source-backed analysis of a backend, automation layer, or Chrome-extension-backed system. The primary output is a markdown document that explains capabilities, APIs, entrypoints, data flow, and important implementation boundaries with verified file and line references.

This skill is especially strong for:

- Chrome extensions and extension runtimes
- Backend automation layers or orchestration flows
- API inventory and capability mapping
- Message routing, storage, debugger/CDP, and browser automation analysis
- Handoff documentation for maintenance, auditing, or reverse engineering

## When to Use This Skill

Use this skill when the request sounds like any of the following:

- "Analyze this backend"
- "Document the APIs implemented here"
- "Map the extension's capabilities"
- "Trace how data moves through this automation flow"
- "Produce a backend architecture or feature analysis"
- "Understand permissions, entrypoints, and message handling"

Do not use this skill for speculative architecture brainstorming without code access. This skill is evidence-first and should only make claims that can be tied back to source files.

## Inputs and Prerequisites

Before you begin, gather the minimum context:

- Target codebase or runtime directory
- Known entrypoints if the user already supplied them
- Expected output name if the user has a preferred filename
- Any boundaries the user cares about, such as "ignore legacy runtimes" or "focus on CDP only"

If no output filename is provided, choose one that matches the task:

- `BACKEND_ANALYSIS.md` for general backend/system analysis
- `API_FEATURE_ANALYSIS.md` for API inventory work
- `AUTOFLOW_API_FEATURE_ANALYSIS.md` when preserving an AutoFlow-specific naming convention

## Core Workflow

Follow these phases in order. Do not skip verification.

### Phase 1: Discover the System Shape

1. Locate the main runtime or application roots.
2. Identify entrypoints such as:
   - `manifest.json`
   - background/service worker files
   - content scripts
   - panel or UI entry files
   - backend routers, controllers, workers, schedulers, or job runners
3. Build a quick inventory of the files most likely to contain capability boundaries.

Illustrative discovery patterns:

```bash
glob(path, pattern="**/manifest.json")
glob(path, pattern="**/*.{js,ts,tsx,mjs,cjs}")
```

For Chrome extensions, start with the manifest, permissions, background worker, content scripts, injected scripts, and sidepanel or popup entrypoints.

### Phase 2: Map Capability Surfaces

Document the major capability categories implemented by the system. The exact categories depend on the target, but common ones include:

- Extension APIs
- Internal message channels
- Storage and persistence
- Network and fetch layers
- Download/export features
- Script injection or execution
- Debugger or DevTools protocol usage
- Backend HTTP endpoints or RPC handlers
- Queue, worker, or scheduler flows

For Chrome extension analysis, search systematically for `chrome.*` usage and group findings by namespace.

Illustrative search patterns:

```bash
grep(include="*.{js,ts,tsx,mjs,cjs}", output_mode="content", path="TARGET", pattern="chrome\\.(runtime|tabs|storage|cookies|scripting|downloads|sidePanel|action|debugger|windows)")
ast_grep_search(pattern="chrome.$API.$METHOD($$$ARGS)", lang="javascript", paths=["TARGET"], globs=["**/*.js","**/*.ts"], context=2)
```

### Phase 3: Trace Control Flow and Data Flow

After you know the available capabilities, trace how they are wired together.

Look for:

- Message handlers and dispatch tables
- Routing from UI actions to background logic
- Request/response transformations
- Data normalisation before storage or export
- Fallback paths, retries, and debug-only branches
- Boundaries between extension code, content scripts, and page context

When analysing backend systems, identify:

- inbound interface
- execution path
- side effects
- output or stored state

When analysing extensions, identify:

- manifest permission -> runtime usage
- content script -> background messaging
- debugger attach/sendCommand/detach lifecycles
- injected page hooks such as `window.fetch`, `postMessage`, or DOM event bridges

### Phase 4: Perform Deep-Dive Analysis for Important Subsystems

If the codebase includes one or more high-impact subsystems, give each one its own subsection.

Common deep-dive targets:

- Chrome Extension APIs
- Chrome Debugger Protocol commands
- Web API intercepts or hooks
- Data extraction pipelines
- Export/download flows
- Authentication or session handling
- Persistence layers and schemas

For Chrome extensions, explicitly check:

#### 4.1 Manifest Permissions

- Record declared permissions and host permissions.
- Map each important permission to actual code usage where possible.
- Call out unused permissions or permissions with unclear implementation evidence.

#### 4.2 Chrome Extension APIs

For each namespace, capture:

- Exact method name
- File path
- Line number or line range
- Purpose in context

Example namespaces:

- `chrome.runtime`
- `chrome.tabs`
- `chrome.storage`
- `chrome.cookies`
- `chrome.scripting`
- `chrome.downloads`
- `chrome.sidePanel`
- `chrome.action`
- `chrome.debugger`
- `chrome.windows`

#### 4.3 Chrome Debugger Protocol (CDP)

Search for attach/sendCommand/detach flows and note specific commands such as:

- `Runtime.evaluate`
- `Input.dispatchMouseEvent`
- `Input.dispatchKeyEvent`
- `Page.bringToFront`
- any domain-specific commands discovered in source

For each command, record the triggering function, key parameters, and why the command exists.

#### 4.4 Web APIs Intercepted or Hooked

Search for browser or page-context hooks such as:

- `window.fetch`
- `XMLHttpRequest`
- `window.postMessage`
- `console.*`
- DOM event interception
- Mutation observers used for automation or extraction

State clearly whether the hook is global, conditional, or scoped to a particular page/runtime.

## Evidence Rules

Every substantive claim must be grounded.

For each finding, include:

- exact symbol, API, or behaviour being described
- source file path
- line number or line range
- short purpose statement tied to the surrounding code

Distinguish between these evidence levels:

- **Direct evidence**: explicitly visible in source
- **Strong inference**: derived from nearby code with a clear basis
- **Unknown / unverified**: plausible but not confirmed

Never present inference as fact.

## Output Contract

Produce a markdown document with a structure like this:

```markdown
# [System Name] - Backend Analysis

## 1. Scope and Boundaries
- What was analysed
- What was excluded

## 2. Entrypoints and Runtime Shape
- Key files and execution roles

## 3. Capability Inventory
### 3.1 [Capability Category]
| Method / Surface | File | Line(s) | Purpose |
|---|---|---|---|

## 4. Deep-Dive Findings
### 4.1 [Subsystem]
...analysis...

## 5. Data Flow and Control Flow
...summary...

## 6. Risks, Gaps, or Unknowns
...clearly labelled...

## 7. Summary Table
| Area | Primary Files | Key Finding |
|---|---|---|
```

For an extension-specific API inventory, use this variant:

```markdown
# [Extension Name] - Comprehensive API Feature Analysis

## 1. Manifest Permissions
## 2. Chrome Extension APIs
## 3. Chrome Debugger Protocol (CDP) Commands
## 4. Web APIs - Intercepted/Hooked
## 5. Message Routing and Control Flow
## 6. Summary Table
```

If you need a reusable checklist or output scaffold, consult:

- `@references/analysis-checklist.md`
- `@references/output-template.md`

Output behaviour:

- Return the analysis as markdown in chat by default.
- Only write a file when a write-capable tool is available and the user asked for the analysis to be saved as a file.
- If the user named a target file, use that filename when writing is both possible and requested.

## Quality Bar

The analysis is only complete when all of the following are true:

1. Entrypoints were identified and read.
2. Major capabilities were grouped into categories instead of left as raw search output.
3. Every important section includes verified file references.
4. Boundaries and exclusions are explicit.
5. Ambiguities are called out rather than guessed through.
6. The final output is useful as a handoff document, not just a scratchpad.

## Known Watchouts

Be careful around these patterns:

1. **Bundled or minified files** — line numbers may be coarse; note that clearly.
2. **Generated code** — distinguish generated artefacts from authored source.
3. **Debug-gated features** — some APIs exist only behind flags or environment checks.
4. **Dispatch indirection** — message handlers may hide the real execution path.
5. **Permission drift** — manifest permissions may not map cleanly to live code usage.
6. **Runtime split boundaries** — extension page, content script, and page-context code often look similar but run in different worlds.

## Example Prompts

### General backend analysis

```text
Analyze the backend or automation layer in the current workspace and create BACKEND_ANALYSIS.md. Identify entrypoints, capability surfaces, major data flows, and any important risks with verified file references.
```

### Chrome extension API inventory

```text
Analyze the Chrome extension in the current directory and create a comprehensive API feature analysis document. Include manifest permissions, Chrome APIs, CDP commands, web API intercepts, and message-routing paths with file and line references.
```

### AutoFlow-style targeted analysis

```text
Analyze this extension runtime and create AUTOFLOW_API_FEATURE_ANALYSIS.md. Focus on implemented Chrome APIs, debugger protocol usage, fetch/postMessage hooks, and the control flow that connects UI actions to automation behaviour.
```

## Final Instruction

Prefer completeness over speed, but keep the output readable. The goal is not to dump search results. The goal is to produce a defensible, structured analysis document that another engineer can trust.
