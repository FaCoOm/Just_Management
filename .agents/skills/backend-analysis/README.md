# Backend Analysis Skill

## Overview

`backend-analysis` is a Codex/OpenCode-compatible skill for producing evidence-based backend, automation, and Chrome-extension analysis documents. It is the renamed and expanded successor to the earlier AutoFlow API analysis prompt, keeping the original extension-analysis workflow while broadening it into a reusable backend analysis skill.

## What It Does

This skill helps with:

- backend and automation architecture analysis
- API inventory and capability mapping
- Chrome extension permission and runtime analysis
- Chrome Debugger Protocol and browser automation tracing
- source-backed handoff documentation with file and line references

## Best-Fit Use Cases

Use it when you need to:

- document a system's implemented APIs
- map entrypoints and message-routing behaviour
- trace control flow across backend or extension layers
- analyse automation mechanisms such as CDP, injection, and fetch hooks
- create a handoff-quality markdown report for maintenance or auditing

## Included Files

```text
backend-analysis/
├── SKILL.md
├── README.md
└── references/
    ├── analysis-checklist.md
    └── output-template.md
```

## Example Prompts

### General

```text
Use backend-analysis to inspect the current codebase and create BACKEND_ANALYSIS.md with entrypoints, core capabilities, data flow, and verified source references.
```

### Chrome extension focused

```text
Use backend-analysis to analyze the extension runtime in this workspace and create an API feature analysis covering manifest permissions, Chrome APIs, CDP commands, and page-context hooks.
```

### AutoFlow-specific naming

```text
Use backend-analysis to create AUTOFLOW_API_FEATURE_ANALYSIS.md for this extension. Keep the report focused on runtime capabilities, message routing, debugger usage, and fetch/postMessage hooks.
```

## Output Style

The skill is designed to produce structured markdown that:

- identifies scope and boundaries
- inventories capabilities by category
- records file and line references for each important claim
- separates confirmed evidence from inference
- calls out gaps, risks, and unknowns explicitly

By default, the skill should return that markdown inline. It should only save a file when the environment supports writing and the user explicitly asked for a saved analysis document.

## Compatibility Notes

- Folder name and skill name are aligned as `backend-analysis`
- The skill follows the common `SKILL.md` convention used by Codex-style and OpenCode skill systems
- Supporting references are split out so the main skill stays focused and reusable
