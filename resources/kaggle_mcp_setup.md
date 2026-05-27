# Kaggle MCP Setup & Integration Guide

This guide details the integration and verification process for enabling the official Kaggle Model Context Protocol (MCP) server natively within the Google Gemini and Antigravity developer environments.

---

## ⚡ Resolution: Direct HTTP Transport vs. Proxy Stdio

Unlike standard local MCP servers that run as child processes via Standard I/O (stdio), the official Kaggle MCP server is hosted remotely at `https://www.kaggle.com/mcp`. 

### The Native Schema Validation
When configuring remote HTTP MCP servers, the validation parser inside the Gemini CLI and Antigravity core engines expects strict property declarations. 

A common pitfall is using lowercase `"url"` inside the standard configuration files, which will trigger the error:
> `kaggle error: serverURL or command must be specified`

To resolve this validation failure, the connection must be defined using the camelCased **`serverURL`** property.

---

## ⚙️ Configuration Files

Apply the following block to your global MCP configuration:

### 📁 Config File Location
*   **Path:** `C:\Users\Fate_Conqueror\.gemini\config\mcp_config.json`

### 🔧 Configuration Block
```json
{
  "mcpServers": {
    "kaggle": {
      "serverURL": "https://www.kaggle.com/mcp"
    }
  }
}
```

---

## 🔑 Authentication

Since the Kaggle MCP is connected to natively over direct HTTP transport in a Google-aligned ecosystem, it handles authorization flows seamlessly:

1.  **OAuth Integration:** The connection automatically piggybacks off your active Google/Kaggle OAuth session (managed in `C:\Users\Fate_Conqueror\.gemini\settings.json` under `"selectedType": "oauth-personal"`).
2.  **No Local Keys Required:** You do **not** need a local `~/.kaggle/kaggle.json` credential file or manually injected `KAGGLE_USERNAME`/`KAGGLE_KEY` environment variables. The HTTP handshake integrates with your current logged-in developer session.

---

## 🔄 Summary of Supported Features

Once enabled, the Kaggle MCP exposes the following tools directly to your assistant context:
*   Search and download datasets
*   Interact with competition leaderboards and submissions
*   Retrieve, rename, or query Kaggle notebook statuses
*   Explore and analyze published Kaggle models
