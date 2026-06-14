# Secure Coder & Antigravity IDE Investigation

## Executive Summary
This report analyzes why the "Secure Coder" feature (or extension) is not active or present in current versions of the Antigravity IDE. 

In summary, the feature relied on a real-time static analysis engine (`semgrep-core-proprietary`) that suffered from critical performance regressions, runaway background processes, massive memory leaks (often exceeding 100GB), and system-wide freezes. To protect user environments and maintain IDE stability, the development team has temporarily disabled or removed it by default.

---

## 1. What is "Secure Coder"?
The term **"Secure Coder"** appears in two distinct contexts within the AI-assisted development ecosystem:

1. **IBM Concert Secure Coder:** A standalone security orchestration tool designed by IBM to flag vulnerabilities and suggest remediation steps directly within developers' environments in real time.
2. **Antigravity IDE Integration:** In the context of the Antigravity IDE (an agentic, AI-first fork focused on autonomous workflows), "Secure Coder" refers to the built-in real-time security scanning and vulnerability analysis extension.

---

## 2. Technical Causes of Removal
Recent stable releases of the Antigravity IDE (especially around version 2.0) deactivated the real-time "Secure Coder" pipeline due to severe issues with its core static analysis binary, `semgrep-core-proprietary`:

* **Runaway Processes:** The IDE would repeatedly spawn hundreds of concurrent `semgrep-core-proprietary` processes in the background.
* **CPU and Memory Leaks:** These processes caused extreme CPU spikes (exceeding 500% utilization) and astronomical memory leaks (often consuming up to 130GB of RAM).
* **System Freezes & Panics:** The performance regression was particularly severe on Apple Silicon macOS hardware, frequently resulting in system-wide unresponsive states, "beach balling," and kernel panics.

### Primary Root Cause
The static analysis scanning engine failed to correctly skip massive directories (e.g., deep `node_modules`, build artifacts, and nested symlinks), entering infinite recursive scanning loops.

---

## 3. Current Status & Workarounds
To preserve system stability and usability, the development team set:
```json
"securecoder.enabled": false
```
and temporarily omitted the execution binary path references from the default configuration.

### Temporary Workarounds for Impacted Users
* **Manual Process Termination:** If your system exhibits extreme lag or memory pressure while using an older version of the IDE, force-terminate the runaway processes via the terminal:
  ```bash
  sudo killall -9 semgrep-core-proprietary
  ```
* **Explicit Disabling:** Verify your active global settings (e.g., `settings.json` or `opencode.jsonc`) to ensure security scan settings are set to `false`.
