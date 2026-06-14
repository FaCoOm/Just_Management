# Analysis of Stitch MCP Server 405 Error and Notion MCP Server Integration

This document diagnoses the `Stitch MCP server SSE error: Non-200 status code (405)` and outlines how to configure the Model Context Protocol (MCP) server for Notion.

---

## 1. Understanding the SSE Error: Non-200 status code (405)

### What it Means
An HTTP **405 Method Not Allowed** error indicates that the client (the MCP client, such as OpenCode or `mcp-remote`) is attempting to communicate with the endpoint using an HTTP method that the server does not support for that specific resource.

### Why it Happens with Stitch MCP
The Stitch MCP endpoint is configured in your systems as:
- URL: `https://stitch.googleapis.com/mcp`
- Tool: `mcp-remote` (used to proxy the remote SSE connection into a local stdio stream)

Under the hood, `mcp-remote` attempts to establish a Server-Sent Events (SSE) connection by issuing an HTTP `GET` request. The 405 error occurs because:
1. **Gateway Rejection:** The Google Cloud API gateway or load balancer hosting `stitch.googleapis.com` rejects direct `GET` requests to that path if they lack valid authentication signatures (the `X-Goog-Api-Key` headers) or if the server expects a session-negotiating `POST` request.
2. **Mismatched Protocol Expectation:** If the API key is expired or incorrect, the gateway will refuse to initiate the SSE stream and return a 405 Method Not Allowed or 401/403 error depending on internal routing.

---

## 2. Enabling and Configuring the Notion MCP Server

Your local configuration files reveal that you have already defined a configuration for the official `@notionhq/notion-mcp-server`, but it is currently **disabled**.

### Your Current Config
In your global configuration file (`C:\Users\Fate_Conqueror\.gemini\antigravity-ide\mcp_config.json`), the Notion entry is:

```json
"notion-mcp-server": {
  "command": "npx",
  "args": [
    "-y",
    "@notionhq/notion-mcp-server"
  ],
  "env": {
    "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer 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\", \"Notion-Version\": \"2022-06-28\"}"
  },
  "disabled": true
}
```

### How to Modify and Enable It

To connect to Notion, you need to perform two updates to this configuration:
1. **Enable the server:** Change `"disabled": true` to `"disabled": false` (or remove the `"disabled"` line entirely).
2. **Use the official environment variable:** The official Notion MCP server package (`@notionhq/notion-mcp-server`) expects a **`NOTION_TOKEN`** environment variable rather than `OPENAPI_MCP_HEADERS`.

#### Modified Configuration Snippet
Update your `notion-mcp-server` block in `C:\Users\Fate_Conqueror\.gemini\antigravity-ide\mcp_config.json` to the following:

```json
"notion-mcp-server": {
  "command": "npx",
  "args": [
    "-y",
    "@notionhq/notion-mcp-server"
  ],
  "env": {
    "NOTION_TOKEN": "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"
  },
  "disabled": false
}
```

*Note: If you ever rotate your Notion Integration Token, replace the value in `NOTION_TOKEN` with your new key starting with `ntn_`.*

---

## 3. Alternative: Connecting via Hosted Notion MCP Server (OAuth)

Notion also offers a hosted, streaming HTTP/SSE-based MCP server. If your IDE supports direct remote endpoints (like Cursor or VS Code):
- **Server URL:** `https://mcp.notion.com/mcp`
- **Authentication:** OAuth-based. Upon connection, the IDE will open a browser window asking you to authorize your Notion workspace.

---

## 4. Next Steps
1. Edit `C:\Users\Fate_Conqueror\.gemini\antigravity-ide\mcp_config.json` with the updated JSON structure shown above.
2. Restart your IDE or OpenCode background processes to reload the configuration.
3. Ensure you have shared the target pages/databases in Notion with your integration (click **•••** -> **Add connections** -> select your integration).
