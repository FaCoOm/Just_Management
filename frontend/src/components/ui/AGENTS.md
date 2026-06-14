# UI Primitives Guide

## Scope
- This folder contains reusable shadcn/ui-style primitives.
- These files are shared building blocks, not dashboard feature surfaces.

## Default Rule
- Prefer composition over editing primitives.
- Solve most UI requests with wrappers, props, and `className` from feature code.

## Do Not Put Here
- Supabase queries.
- Guest, property, or maintenance business logic.
- Dashboard-only copy, assumptions, or data contracts.
- Hospitality-specific semantics that make the primitive less reusable.

## When Editing Is Allowed
- A primitive has a real bug.
- A shared accessibility issue needs fixing.
- A global token or shared behavior must change for the whole app.

## Editing Rules
- Preserve the public API shape unless the task explicitly requires a breaking change.
- Keep styling token-driven through `frontend/src/index.css` values and Tailwind utilities.
- Do not hardcode one-off dashboard colors when Harbor/Brass tokens already exist.
- Assume a change here can affect dozens of call sites.

## Preferred Alternatives
- Wrap a primitive in dashboard feature code.
- Pass layout and visual adjustments through props.
- Add feature-specific structure outside this directory.

## Verification
- Run `npm run typecheck` after primitive edits.
- Run `npm run build` for shared import or styling changes.
- Spot-check multiple dashboard surfaces if a primitive actually changes.
