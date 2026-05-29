# OpenCode CLI Session Management Research

This document covers research and instructions for managing and exporting OpenCode CLI sessions as JSON files or URLs.

---

## 1. Session Commands Overview

The OpenCode CLI provides dedicated commands under the `session`, `export`, and `import` command trees to handle session lifecycle and transcripts:

### Listing Sessions
To view recent session IDs, status, and summary details:
```bash
opencode session list
```
* **Flags:**
  - `--max-count` (`-n`): Limit to $N$ most recent sessions.
  - `--format`: Format output as `table` or `json` (defaults to `table`).

### Deleting a Session
To remove session data from local storage:
```bash
opencode session delete <sessionID>
```

### Show Session Statistics
To review token usage and cost statistics for sessions:
```bash
opencode stats
```
* **Flags:**
  - `--days`: Show stats for the last $N$ days.
  - `--tools`: Number of tools to show in breakdown.
  - `--models`: Show model usage breakdown.
  - `--project`: Filter statistics by a specific project name.

---

## 2. Exporting and Importing Sessions

### Exporting Session Data
The `export` command converts a specific session transcript and metadata into JSON format:
```bash
opencode export [sessionID]
```
* **Redirection to a File:** Because the CLI prints the JSON payload to standard output (`stdout`), standard shell redirection should be used to write to a file to prevent terminal buffer overflow or truncation:
  ```powershell
  # PowerShell / CMD / Bash
  opencode export ses_1936ec0aeffeF6ZOfDy4x22H9y > session.json
  ```
* **Sanitization:** To redact sensitive credentials, tokens, or file contents from the exported transcript:
  ```bash
  opencode export <sessionID> --sanitize
  ```

### Importing Session Data
To import an exported session JSON file or a shared OpenCode URL back into the CLI environment:
```bash
opencode import <file_path_or_url>
```
* **Examples:**
  ```bash
  opencode import session.json
  opencode import https://opncd.ai/s/abc123
  ```

---

## 3. Environment Variables for Session Configuration

OpenCode supports several environment variables to tune session and storage behavior:
* `OPENCODE_AUTO_SHARE` (boolean): Automatically share sessions.
* `OPENCODE_DISABLE_PRUNE` (boolean): Disable automatic pruning of old data.
* `OPENCODE_DISABLE_AUTOCOMPACT` (boolean): Disable automatic context compaction.
