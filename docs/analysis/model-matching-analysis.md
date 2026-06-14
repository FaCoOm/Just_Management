# Model Matching Analysis: 9router vs. newapi

This document analyzes the available models from both the canonical `9router` provider and the newly added `newapi` provider, and designs an optimized routing configuration for Oh My OpenAgent.

## Available Provider & Model landscape

### 1. `9router`
- **Role**: Canonical, premium provider.
- **Key Models**:
  - `9router/cx/gpt-5.5` & `9router/cx/gpt-5.5-xhigh` (Proprietary GPT-family flagship)
  - `9router/kr/claude-opus-4.7` & `9router/kr/claude-sonnet-4.6` (Proprietary Claude-family flagship)
  - `9router/gc/gemini-3.1-pro-preview` (Gemini-family flagship for vision and multi-modal tasks)

### 2. `newapi`
- **Role**: High-efficiency, secondary OpenAI-compatible provider.
- **Key Models**:
  - `newapi/moonshotai/kimi-k2.6` (Excellent Claude-family alternative, instruction-following)
  - `newapi/z-ai/glm-5.1` (Solid instruction-following backup)
  - `newapi/deepseek-ai/deepseek-v4-pro` (Flagship coding specialist, closest OSS equivalent for autonomous coding)
  - `newapi/deepseek-ai/deepseek-v4-flash` (Fast coding and parsing specialist)
  - `newapi/nvidia/nemotron-3-ultra-550b-a55b` (Massive reasoning/logic model)
  - `newapi/qwen/qwen3-coder-480b-a35b-instruct` (State-of-the-art coding assistant)
  - `newapi/google/gemma-4-31b-it` (Sleek light-weight model)
  - `newapi/minimaxai/minimax-m2.7` (Fast utility/retrieval model)
  - `newapi/stepfun-ai/step-3.7-flash` (Ultra-fast flash assistant)

---

## Agent Mapping Strategy

| Agent / Category | Family Type | Primary Selection | newapi Equivalents / Fallbacks | Notes |
|---|---|---|---|---|
| **Sisyphus** | Claude (Instruction-heavy) | `9router/kr/claude-opus-4.7` | `newapi/moonshotai/kimi-k2.6`, `newapi/z-ai/glm-5.1`, `newapi/deepseek-ai/deepseek-v4-pro` | Sisyphus prompt is ~1,100 lines. Fallback to Kimi/GLM maintains strict checklist compliance. |
| **Hephaestus** | GPT (Principle-driven) | `9router/cx/gpt-5.5` | `newapi/deepseek-ai/deepseek-v4-pro`, `newapi/qwen/qwen3-coder-480b-a35b-instruct` | Requires GPT-family for autonomous deep reasoning. Removed sloppy Poolside models. |
| **Oracle** | GPT (Principle-driven) | `9router/cx/gpt-5.5` | `newapi/deepseek-ai/deepseek-v4-pro`, `newapi/nvidia/nemotron-3-ultra-550b-a55b` | Dedicated debugging and architecture specialist. |
| **Librarian** | GPT / Fast (Utility) | `9router/gh/gpt-5.4-mini` | `newapi/deepseek-ai/deepseek-v4-flash`, `newapi/stepfun-ai/step-3.7-flash` | Lightweight information retrieval. |
| **Explore** | Fast (Utility) | `newapi/minimaxai/minimax-m2.7` | `newapi/deepseek-ai/deepseek-v4-flash`, `newapi/stepfun-ai/step-3.5-flash` | Codebase exploration and fast file listings. |
| **Multimodal-Looker** | Gemini / Vision | `9router/gc/gemini-3.1-pro-preview` | `newapi/google/gemma-4-31b-it` | Handles screenshots and UI layout visual testing. |
| **Prometheus** | Dual-prompt (Claude preferred) | `9router/kr/claude-opus-4.7` | `newapi/nvidia/nemotron-3-ultra-550b-a55b`, `newapi/deepseek-ai/deepseek-v4-pro` | Implementation plan builder. |
| **Metis** | Dual-prompt (GPT preferred) | `9router/cx/gpt-5.5` | `newapi/deepseek-ai/deepseek-v4-pro`, `newapi/z-ai/glm-5.1` | Advanced logic orchestration. |
| **Momus** | GPT (Principle-driven) | `9router/cx/gpt-5.5` | `newapi/deepseek-ai/deepseek-v4-pro` | PR reviewer and refactoring critic. |
| **Atlas** | Claude / High-end | `9router/kr/claude-sonnet-4.6` | `newapi/moonshotai/kimi-k2.6`, `newapi/qwen/qwen3.5-122b-a10b` | General tasks and coding. |
| **Sisyphus-Junior** | Claude (Fast) | `9router/kr/claude-haiku-4.5` | `newapi/deepseek-ai/deepseek-v4-flash`, `newapi/moonshotai/kimi-k2.6` | Subagent execution and minor checklist tasks. |

---

## Category Mapping Strategy

| Category | Primary Selection | Fallback Selection |
|---|---|---|
| **visual-engineering** | `9router/gc/gemini-3.1-pro-preview` | `newapi/google/gemma-4-31b-it`, `newapi/z-ai/glm-5.1`, `newapi/moonshotai/kimi-k2.6` |
| **ultrabrain** | `9router/cx/gpt-5.5-xhigh` | `9router/kr/claude-opus-4.7`, `newapi/nvidia/nemotron-3-ultra-550b-a55b`, `newapi/deepseek-ai/deepseek-v4-pro` |
| **deep** | `9router/cx/gpt-5.5` | `9router/kr/claude-opus-4.7`, `newapi/deepseek-ai/deepseek-v4-pro`, `newapi/moonshotai/kimi-k2.6` |
| **artistry** | `9router/gc/gemini-3.1-pro-preview` | `newapi/google/gemma-4-31b-it`, `newapi/deepseek-ai/deepseek-v4-pro`, `newapi/moonshotai/kimi-k2.6` |
| **quick** | `9router/cx/gpt-5.4-mini` | `newapi/deepseek-ai/deepseek-v4-flash`, `newapi/stepfun-ai/step-3.5-flash` |
| **unspecified-low** | `9router/cx/gpt-5.4-mini` | `newapi/openai/gpt-oss-20b`, `newapi/deepseek-ai/deepseek-v4-flash` |
| **unspecified-high** | `9router/cx/gpt-5.4-high` | `newapi/qwen/qwen3-coder-480b-a35b-instruct`, `newapi/deepseek-ai/deepseek-v4-pro` |
| **writing** | `9router/cx/gpt-5.4-mini` | `newapi/deepseek-ai/deepseek-v4-flash`, `newapi/stepfun-ai/step-3.5-flash` |
