# Backend Analysis Checklist

Use this checklist while running the skill.

## 1. Scope

- Identify what directory or runtime was analysed
- Record anything intentionally excluded
- Decide on the output filename

## 2. Discovery

- Find the main entrypoints
- Read the manifest or top-level configuration if present
- Identify runtime roles: UI, background, worker, content script, API server, scheduler, queue, storage layer

## 3. Capability Inventory

- Group features by capability area
- Search for implementation symbols, not just filenames
- For extension work, map `chrome.*` namespaces systematically

## 4. Flow Tracing

- Trace command or event entrypoints
- Follow message routing and dispatch tables
- Identify important side effects: storage, network, downloads, debugger, injected code

## 5. Evidence Quality

- Every major claim has a file path
- Every major claim has a line number or range
- Inference is labelled as inference
- Unknowns are called out explicitly

## 6. Output Review

- Report is structured, not a raw log
- Summary section exists
- Risks or gaps are listed
- Another engineer could use the report without redoing discovery
