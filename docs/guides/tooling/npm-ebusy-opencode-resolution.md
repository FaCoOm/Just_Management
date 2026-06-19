# Issue Resolution: npm EBUSY Error for opencode-ai

## Problem
The user encountered an `EBUSY` error while trying to install `opencode-ai` globally.
The error indicated that `opencode.exe` was busy or locked, preventing npm from copying files.

## Investigation
Checked the task list to see if `opencode.exe` was running.
```powershell
tasklist /FI "IMAGENAME eq opencode.exe"
```
Found `opencode.exe` running with PID 73908.

## Resolution
1. Terminated the running process:
   ```powershell
   taskkill /F /IM opencode.exe
   ```
2. Retried the installation:
   ```powershell
   npm i -g opencode-ai
   ```

## Status
Resolved. The package `opencode-ai` was successfully updated/installed.
