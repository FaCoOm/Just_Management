# 9router Responses vs. Completions Analysis

An analysis of OpenCode request routing, model configuration, and the difference between `/chat/completions` and `responses` endpoints.

## Executive Summary

Based on the logs in [logs.txt](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/logs.txt) and the OpenCode configuration in [opencode.json](file:///C:/Users/Fate_Conqueror/.config/opencode/opencode.json):
1. **Endpoint Type:** Requests sent to the 9router provider are sent as standard stateless **`completions`** (`/v1/chat/completions`) requests, not `responses`.
2. **Format Translation:** The `openai-responses` format seen in the logs is a format mapper used specifically by OpenCode's `codex` provider (GitHub Copilot's backend).
3. **9router Support:** 9router exposes standard OpenAI-compatible endpoints (`/v1/chat/completions`) and does not natively support the stateful OpenAI Responses API (`/v1/responses`).
4. **Efficiency & Tokens:** Transitioning to a `responses` architecture would not inherently reduce token consumption or improve efficiency compared to current prompt caching mechanisms. In fact, standard completions endpoints already support server-side **Prompt Caching** (e.g., Anthropic, DeepSeek, OpenAI) which drastically cuts down input tokens without the overhead of server-side session management.

---

## Log Deep-Dive Analysis

### 1. The Codex Flow (openai → openai-responses)
In the provided [logs.txt](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/logs.txt), we see the following output when routing requests to GitHub Copilot's `codex` provider:
```
[01:49:05] 📥 POST /v1/chat/completions | cx/gpt-5.4-high | 230 msgs | 94 tools | effort=medium
[01:49:05] 🔍 [AUTH] API Key: sk-f...d018
[01:49:05] ℹ️ [ROUTING] cx/gpt-5.4-high → codex/gpt-5.4-high
...
[01:49:05] 🔍 [FORMAT] openai → openai-responses | stream=true
[01:49:05] 🔍 [CAVEMAN] ultra | openai-responses
[01:49:05] [PENDING] START | provider=codex | model=gpt-5.4-high
[01:49:05] 🔍 [REQUEST] CODEX | gpt-5.4-high | 395 msgs
```

* **Incoming Request:** The IDE client sends a request to the local OpenCode proxy via `/v1/chat/completions` (the standard stateless OpenAI-compatible chat completion endpoint).
* **Format Conversion:** Because the target provider is `codex` (GitHub Copilot), OpenCode's translation layer transforms the payload from the standard `openai` payload into the proprietary `openai-responses` format.

### 2. The 9router Flow
Under [opencode.json](file:///C:/Users/Fate_Conqueror/.config/opencode/opencode.json), the 9router provider configuration is:
```json
"9router": {
  "npm": "@ai-sdk/openai-compatible",
  "options": {
    "apiKey": "sk-f...",
    "baseURL": "https://6s6qfv.tail66d69b.ts.net/v1"
  }
}
```

* The NPM package `@ai-sdk/openai-compatible` is a stateless adapter.
* When OpenCode delegates to 9router, it formats the request according to the OpenAI Chat Completions schema and dispatches it to the `/v1/chat/completions` path of your configured base URL.

---

## Completions vs. Responses API

The OpenAI **Responses API** (`/v1/responses`) is designed for stateful, agentic workflows:

> [!NOTE]
> * **Completions API (`/v1/chat/completions`):** Stateless. The client must send the entire conversation history (system prompts, user questions, assistant responses, and tool call histories) with every request.
> * **Responses API (`/v1/responses`):** Stateful. The conversation state is stored server-side. The client only sends new messages, and the model handles tool execution loops internally on the server.

### Does 9router support the Responses API?
**No.** 9router acts as a routing, load-balancing, and format-translation proxy layer. It does not manage persistent conversation states or execute server-side agentic loops. Supporting `/v1/responses` would require 9router to store conversation states, manage user sessions, and autonomously execute tool calls.

---

## Token Efficiency & Optimization

Would supporting the `responses` API result in better efficiency and decreased token consumption?

**Not necessarily.** The main driver of token efficiency in large context windows is **Prompt Caching** (not the stateful Responses API itself).

### How Caching Works in Both Systems:
1. **Completions API (with Prompt Caching):** Modern providers (like Anthropic, DeepSeek, and OpenAI) automatically cache the prefix of your prompt history. Even though the client sends the entire history in the payload, the provider only charges you a fraction of the cost for the cached prefix (often 90% discount).
   * *Evidence in logs:*
     `[01:49:04] 📊 [USAGE] CODEX | in=148686 | out=1116 | ... | cache_read=147456`
     Here, **147,456 tokens** out of **148,686 input tokens** were read from the cache (99.1% cache hit rate), showing extreme token efficiency without utilizing the stateful Responses API.
2. **Responses API:** While it avoids sending the payload over the network by keeping the state server-side, the model still has to process the context window tokens under the hood, utilizing prompt caching in the same way.

> [!TIP]
> To achieve the best efficiency and decrease token consumption with 9router:
> * Ensure the upstream models you route to via 9router support **Prompt Caching** (e.g., Anthropic Claude models, DeepSeek models, or OpenAI gpt-4o).
> * The network payload size is reduced under the Responses API, but the **billed input tokens** remain virtually identical to a Prompt-Cached Completions request.
