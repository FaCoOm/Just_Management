<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# <PROJECT_NAME> Agent Guide

## OpenCode Behavioral Overlay

Use these rules to keep OpenCode sessions predictable, minimal, and verifiable.

### 1. Think Before Coding
- State assumptions explicitly when the request is ambiguous.
- Do not silently choose between materially different interpretations.
- If a simpler path exists, say so before implementing the larger one.
- If confusion remains after exploration, name it clearly instead of guessing.

### 2. Simplicity First
- Implement exactly what was requested and nothing speculative.
- Avoid abstractions, flags, or extension points that are not needed yet.
- Prefer the smallest diff that satisfies the request.
- If the solution feels bigger than the problem, reduce it.

### 3. Surgical Changes
- Touch only the files directly related to the task.
- Do not clean up adjacent code, comments, or formatting unless your change requires it.
- Match existing project patterns even if you would design them differently from scratch.
- Remove only the dead code your own change creates.

### 4. Goal-Driven Execution
- Convert requests into explicit pass/fail outcomes before implementation.
- For multi-step work, state a short plan with verification after each step.
- Do not claim success without fresh evidence from this repository.
- Manual QA is required for behavior changes; static checks alone are not enough.

## Snapshot
- Product/domain: <ONE_SENTENCE_SUMMARY>
- Primary runtime: <FRONTEND_BACKEND_OR_SERVICE_SUMMARY>
- Key stack: <LANGUAGES_FRAMEWORKS_DATABASES>
- Current source of truth: <MAIN_DATA_OR_LOGIC_BOUNDARY>
- Historical/stale docs to treat carefully: <LIST_OR_NONE>

## Real Entry Points
- `<ENTRY_FILE_1>` — <WHY_IT_MATTERS>
- `<ENTRY_FILE_2>` — <WHY_IT_MATTERS>
- `<ENTRY_FILE_3>` — <WHY_IT_MATTERS>

## Structure
- `<PATH_OR_FOLDER>` — <RESPONSIBILITY>
- `<PATH_OR_FOLDER>` — <RESPONSIBILITY>
- `<PATH_OR_FOLDER>` — <RESPONSIBILITY>

## Current Domain Model
- Core entities: <LIST>
- Compatibility or legacy surfaces: <LIST_OR_NONE>
- Deferred scope: <LIST_OR_NONE>

## Where To Edit
| Change | Primary location | Notes |
|---|---|---|
| <CHANGE_TYPE> | `<PATH>` | <GUIDANCE> |
| <CHANGE_TYPE> | `<PATH>` | <GUIDANCE> |
| <CHANGE_TYPE> | `<PATH>` | <GUIDANCE> |

## Conventions
- Use `<IMPORT_OR_MODULE_CONVENTION>`.
- Keep `<BUSINESS_LOGIC_TYPE>` in `<EXPECTED_LAYER>`.
- Treat `<SHARED_AREA>` as stable shared infrastructure.
- Keep typing/validation explicit at system boundaries.
- Preserve existing architectural boundaries unless the task explicitly changes them.

## Anti-Patterns
- Do not put `<WRONG_LOGIC>` inside `<WRONG_LAYER>`.
- Do not treat `<LEGACY_MODEL>` as the source of truth if it is compatibility-only.
- Do not hardcode secrets, credentials, or environment-specific values.
- Do not trust stale docs when they conflict with current code or runtime entry points.

## Commands
Primary development commands:
```bash
<COMMAND_1>
<COMMAND_2>
<COMMAND_3>
```

Optional secondary commands:
```bash
<COMMAND_4>
<COMMAND_5>
```

## Verification
- Standard checks: `<CHECK_1>`, `<CHECK_2>`.
- Additional subsystem checks: `<CHECK_3>`.
- Manual QA expectations: <WHAT_TO_RUN_OR_OBSERVE>.
- If there is no test suite or CI, state that explicitly.

## Reference Docs
- `<DOC_PATH>` — <WHY_READ_IT>
- `<DOC_PATH>` — <WHY_READ_IT>
- `<DOC_PATH>` — <WHY_READ_IT>

## Local Overrides
- `<LOCAL_AGENTS_PATH>` — <SPECIALIZED_SCOPE>
- `<LOCAL_AGENTS_PATH>` — <SPECIALIZED_SCOPE>

## Optional Skill Enforcement Snippet

If you want this repo to force a project-local skill at session start, add a short policy such as:

```md
Before any substantial response or code change, invoke the OpenCode skill
`opencode-karpathy-guidelines`.
If the task is trivial and purely conversational, use judgment.
```
