# One API Web App Integration Knowledge Report

---

## Docs Covered
- https://www.withone.ai/docs/auth
- https://www.withone.ai/docs/auth/setup
- https://www.withone.ai/docs/auth/management
- https://www.withone.ai/docs/webhooks
- https://www.withone.ai/docs/cli
- https://www.withone.ai/docs/mcp
- https://www.withone.ai/docs/api-reference/introduction
- https://www.withone.ai/docs/api-reference/management
- https://github.com/withoneai/knowledge
- https://github.com/withoneai/cli
- https://raw.githubusercontent.com/withoneai/auth/main/README.md

---

## Implementation‑Ready Knowledge

### Frontend Integration
- Install the auth package:
  ```bash
  npm install @withone/auth
  ```
- Use in your React app:
  ```tsx
  import { useOneAuth } from "@withone/auth";
  ```

### Backend Token Endpoint (Next.js App Router example)
```tsx
// app/api/one-auth/route.ts
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const page = req.nextUrl.searchParams.get("page");
    const limit = req.nextUrl.searchParams.get("limit");
    const response = await fetch(
      `https://api.withone.ai/v1/authkit/token?page=${page}&limit=${limit}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-One-Secret": process.env.ONE_SECRET_KEY!,
        },
        body: JSON.stringify({ identity: userId, identityType: "user" }),
      },
    );
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to generate token" }, { status: response.status, headers: corsHeaders });
    }
    const token = await response.json();
    return NextResponse.json(token, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500, headers: corsHeaders });
  }
}
```

### Frontend Connect Button
```tsx
"use client";
import { useOneAuth } from "@withone/auth";

type ConnectIntegrationButtonProps = { userId: string };

export function ConnectIntegrationButton({ userId }: ConnectIntegrationButtonProps) {
  const { open } = useOneAuth({
    token: {
      url: "https://your-domain.com/api/one-auth",
      headers: { "x-user-id": userId },
    },
    onSuccess: async (connection) => {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          platform: connection.platform,
          connection_key: connection.key,
          environment: connection.environment,
        }),
      });
    },
    onError: (error) => console.error("Connection failed:", error),
    onClose: () => console.log("Auth modal closed"),
  });
  return <button onClick={open}>Connect Integration</button>;
}
```

> **NOTE** Optional config example:
> ```tsx
> useOneAuth({
>   token: { url: "https://your-domain.com/api/one-auth", headers: { "x-user-id": userId } },
>   selectedConnection: "Gmail",
>   showNameInput: true,
>   appTheme: "light",
>   title: "Connect Gmail",
>   companyName: "Your Company",
>   authWindow: "popup",
> });
> ```

---

## Connection Record Interface (TypeScript)
```ts
interface ConnectionRecord {
  _id: string;
  key: string;
  name: string;
  platform: string;
  platformVersion: string;
  connectionDefinitionId: string;
  environment: string;
  identity?: string;
  identityType?: "user" | "team" | "organization" | "project";
  secretsServiceId: string;
  settings: {
    parseWebhookBody: boolean;
    showSecret: boolean;
    allowCustomEvents: boolean;
    oauth: boolean;
  };
  throughput: { key: string; limit: number };
  createdAt: number;
  updatedAt: number;
  updated: boolean;
  version: string;
  lastModifiedBy: string;
  deleted: boolean;
  tags: string[];
  active: boolean;
  deprecated: boolean;
}
```

### Persisted Fields (minimum)
- `key`
- `platform`
- `environment`
- `identity`

### Useful Extra Fields
- `_id`, `name`, `createdAt`, `identityType`, `tags`, `active`

---

## Recommended DB Table
```sql
CREATE TABLE user_connections (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    connection_key TEXT UNIQUE,
    environment TEXT DEFAULT 'live',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Server‑Side Passthrough Example
```ts
const response = await fetch(
  "https://api.withone.ai/v1/passthrough/gmail/messages/send",
  {
    method: "POST",
    headers: {
      "x-one-secret": process.env.ONE_SECRET_KEY!,
      "x-one-connection-key": user.gmailConnectionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "recipient@example.com", subject: "Hello", body: "Message content" }),
  },
);
```

---

## Knowledge API Overview
| Endpoint | Purpose |
|---|---|
| `GET /open/knowledge/:platform` | Get platform overview |
| `GET /open/knowledge/:platform/auth` | Get platform auth details |
| `GET /open/knowledge/:platform/actions` | List platform actions |
| `GET /open/knowledge/:platform/actions/search?query=` | Search actions |
| `GET /open/knowledge/:platform/actions/:actionId` | Get full action knowledge |

---

## Example Action Knowledge (Gmail List Messages)
```json
{
  "id": "conn_mod_def::GJ3odOE-fdw::ijLww5s-SCSplLQtLpxkrw",
  "title": "List a User's Gmail Messages",
  "modelName": "messages",
  "method": "GET",
  "path": "/gmail/v1/users/{{userId}}/messages",
  "tags": []
}
```

---

## Action Execution Workflow
1. **List connections** → find relevant connection.
2. **Search action** → locate desired action ID.
3. **Get action knowledge** → understand required parameters.
4. **Execute action** → perform the call.

> **IMPORTANT** Always read the action knowledge before executing!

---

## Vault / Connection Management (cURL examples)
```bash
# List connections for an identity
curl "https://api.withone.ai/v1/vault/connections?identity=user_123" -H "x-one-secret: YOUR_API_KEY"

# Delete a connection
curl -X DELETE "https://api.withone.ai/v1/vault/connections/{CONNECTION_ID}" -H "x-one-secret: YOUR_API_KEY"

# Tag a connection
curl -X PATCH "https://api.withone.ai/v1/vault/connections/{CONNECTION_ID}" \
  -H "x-one-secret: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["new-user", "default"]}'
```

---

## Connection Ownership Rules
- Every connection created via Auth belongs to the identity used when generating the token.
- Enables:
  - Per‑user isolation
  - Team‑shared connections
  - Organization‑shared connections
  - Project‑scoped connections
  - Filtered queries
  - Access control

---

## AuthKit Management
- Dashboard: https://app.withone.ai/settings/authkit
- Integrations must be enabled before they appear in the widget.
- OAuth redirect URI: `https://api.withone.ai/connections/oauth/callback`

---

## Webhooks
- Dashboard: https://app.withone.ai/webhooks
- Supported event groups: passthrough, connections, OAuth, others.
- Signature header: `X-Webhook-Signature`
- Retries up to 3 times on failure.

---

## Management API (for SaaS provisioning)
```bash
curl https://api.withone.ai/v1/management/organizations/setup \
  -X POST \
  -H "x-one-secret: $YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "description": "Production workspace for Acme", "keyName": "acme-root"}'
```
> **NOTE** Returns a service‑account key (store it immediately).

---

## Project & Organization Scoping
- **Project‑scoped keys**: access only one project’s connections and AuthKit config.
- **Organization‑scoped keys**: access all projects under the org.
- **Best practice**: Use project‑scoped keys for production environments.

---

## Security Practices
- Never expose `ONE_SECRET_KEY` client‑side.
- Rotate keys regularly and delete unused ones.
- Use HTTPS in production.
- Store connection keys securely.

---

## Local Development Tips
- Auth widget token URL must be reachable externally (e.g., via ngrok).
- Disable Chrome Local Network Access Checks or use ngrok for realistic testing.

---

## Troubleshooting Summary
| Issue | Cause | Fix |
|---|---|---|
| 405 Method Not Allowed | Missing OPTIONS route | Add CORS OPTIONS handler |
| CORS error | Missing custom headers | Add to `Access-Control-Allow-Headers` |
| Token fetch fails | Invalid secret key | Verify key at app.withone.ai/settings/api-keys |
| Auth opens list instead of integration | Wrong `selectedConnection` | Use display name like `"Gmail"` |
| Connection not saving | `onSuccess` not persisting | Save `connection.key` |
| Passthrough 401 | Missing/incorrect `x-one-secret` | Use backend secret |
| Passthrough 403 | Wrong key scope/permissions | Check project/org API key |
| Connection not found | Stale or wrong connection key | List vault connections for identity |
| User sees no integrations | AuthKit apps disabled | Enable apps in dashboard |

---

## Gaps / Caution
- `@withone/ai` package is unavailable on npm; use `@withone/auth` instead.
- Some API reference URLs return 404; details are spread across Auth, CLI, Knowledge docs.
- Ensure backend token endpoint is a full URL (not relative) for iframe compatibility.

---

## Verdict & Next Steps
- **Status**: Ready for web‑app integration planning and implementation.
- **Validated**: MCP server, action discovery, knowledge lookup, Gmail passthrough.
- **Decision Required**: Choose tenant identity model (user, team, organization, project).
- **Suggested First Build**: Gmail read‑only integration (list messages) using the flow above.

---

*Prepared by Antigravity – your AI coding assistant.*