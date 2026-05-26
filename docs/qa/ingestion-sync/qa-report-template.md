# QA Report: Ingestion Sync Workflow

## Environment

- Branch:
- Commit:
- Date/time:
- Browser:
- Browser automation tool:
- Browserbase MCP used: yes/no
- DB target:

## Build and Verification Commands

Paste command outputs or attach logs:

- `npm run classify:listings`:
- `npm run typecheck`:
- `npm run build`:
- `cd backend && npm run db:generate`:
- `cd backend && npm run db:validate`:
- `cd backend && npm run db:verify:migration`:
- `cd backend && npm run build`:

## Dashboard Sync Test

- Result: pass/fail
- Screenshot: initial dashboard:
- Screenshot: pending state:
- Screenshot: toast:
- Console errors/warnings:

## Network Verification

- Request URL:
- Request method:
- Request payload:
- Response status:
- Response body:

## Database Verification

- `channel_listings` total rows:
- owner distribution:
- duplicate provider listing IDs:
- subset tables remaining:
- sync/seed run evidence:

## Negative Tests

### Backend unavailable

- Result:
- Evidence:
- Expected:
- Actual:

### Duplicate click / pending state

- Result:
- Evidence:
- Expected:
- Actual:

### Idempotency

- Result:
- First run counts:
- Second run counts:
- Expected:
- Actual:

## Issues

### ISSUE-001

- Severity:
- Summary:
- Reproduction steps:
- Evidence:
- Expected:
- Actual:
- Suggested owner:

## Final Verdict

- Overall: pass/fail
- Blocking issues:
- Non-blocking issues:
- Open questions:
