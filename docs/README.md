# 🗂️ Just Management - Documentation Center

Welcome to the consolidated Documentation Center for **Just Management** (Hospitality Operations Dashboard). Current architecture is React + REST repositories + Express + Prisma + Azure PostgreSQL.

This directory enforces a **purpose-based taxonomy**. Historical (Track A / Supabase-era) docs are preserved but clearly marked. Do not treat archive as current runtime truth.

---

## 🧭 Quick Start

| I want to... | Go to |
| :--- | :--- |
| Understand the system | `docs/architecture/` |
| Run the app locally | `docs/guides/local-development/` |
| Deploy to production | `docs/guides/deployment/` |
| Read or write a plan | `docs/plans/` |
| Check QA reports | `docs/reports/qa/` |
| Find historical decisions | `docs/archive/` |

---

## 📚 Directory Map

### 🏛️ `architecture/` — Systems & Decisions

Current canonical specs only. Historical architecture archived.

| File | Description |
| :--- | :--- |
| `system-overview.md` | High-level system architecture |
| `api-architecture.md` | Express API routing, Prisma, backend design |
| `operations-pipeline.md` | Domain ops/state-machine reference |
| `ingestion-sync-reference.md` | Ingestion operational reference |
| `patterns/` | Architecture patterns analysis |

---

### 🎨 `design/` — Visual System

| File | Description |
| :--- | :--- |
| `design-system.md` | Design tokens, HSL colors, typography |

---

### 📖 `guides/` — How-to, Runbooks & Tooling

**`deployment/`**
| File | Description |
| :--- | :--- |
| `hostinger-deployment-plan.md` | Deployment plan and phases |
| `hostinger-backend-frontend.md` | Deployment guide |
| `hostinger-env-variables.md` | Env variable matrix |
| `cors-allowed-origins.md` | CORS configuration |

**`local-development/`**
| File | Description |
| :--- | :--- |
| `local-setup.md` | Local setup steps |
| `env-variables.md` | Local env variables |
| `unified-run-and-build.md` | Dev/build commands |
| `project-structure.md` | Monorepo structure |

**`ingestion/'**
| File | Description |
| :--- | :--- |
| `ingestion-setup.md` | Ingestion setup and user stories |
| `withone-google-sheets.md` | WithOne Sheets integration |

**`tooling/`**
| File | Description |
| :--- | :--- |
| `opencode-skill-enforcement.md` | AI agent usage rules |
| `kaggle-mcp-setup.md` | Kaggle MCP setup |
| `npm-ebusy-opencode-resolution.md` | npm troubleshooting |
| `one-cli-windows-init-failure.md` | One CLI Windows bug |

---

### 🗺️ `plans/' — Active PRDs & Backlog

| Directory | Contents |
| :--- | :--- |
| `active/` | Current implementation plans |
| `archive/' | Superseded plans (e.g., Supabase-era) |

---

### 📊 `reports/' — Completed Work, Handoffs & Verification

| Directory | Purpose |
| :--- | :--- |
| `implementation/` | Feature dashboards, sync reports |
| `qa/' | Dated QA verification reports |
| `performance/' | Performance findings |
| `troubleshooting/' | Frontend fixes, API reconfigurations |

---

### 🔬 `analysis/' — Research & Architecture Analysis

* `ai-tooling/' — AI agent usage, token optimization, platform analysis
* Other architectural analyses in `analysis/' root (migrated incrementally). |

---

### 📌 `reference/' — External Data & Exports

* `external-exports/' — Notion, Kaggle, etc.
* `database/' — DB source mappings, raw exports |

---

### 🏛️ `adr/' — Architecture Decision Records

---

### 🚫 `archive/' — Historical / Superseded

| Directory | Contents |
| :--- | :--- |
| `implementation/' | Old static/Supabase implementations |
| `plans/' | Retired roadmaps |
| `status/' | Historical sprint statuses |
| `sensitive-redacted/' | Documents with redacted credentials |

> All archived files include a `> Historical. Not current runtime truth.` banner.

---

## 🗄️ Pre-existing Directories (Historical)

These directories still contain files from earlier project phases and will be gradually consolidated:

| Directory | Contents | Future |
| :--- | :--- | :--- |
| guidelines/ | Build execution guidelines | Review and move |
| implementation/ | Session handoffs | Move to `reports/implementation/` |
| qa/, qa-testing/ | Test plans and walkthroughs | Move to `reports/qa/' or `archive/' |
| database_design/, db_design/ | Raw CSVs, schema refs | Consider `reference/database/' |
| superpowers/ | Plans and specs | Consider `plans/' or `reports/' |

---

## 🏗️ Allocation Rules

**Never put new documents in `docs/' root.** Use this table:

| Document Type | Destination |
| :--- | :--- |
| Architecture / API spec | `architecture/' |
| Design / UI spec | `design/' |
| How-to, runbook, tooling | `guides/<topic>/' |
| Active PRD, backlog | `plans/active/' |
| Completed report / handoff | `reports/<category>/' |
| Research / AI analysis | `analysis/<subtopic>/' |
| External data / exports | `reference/<category>/' |
| Historical / retired | `archive/' |

Naming: **lower-kebab-case**.md`. Avoid: spaces, CamelCase, underscores, generic names.

---

## ✅ Status

- **Last reorganization**: 2026-06-19
- **Structure version**: 2.0
- **Runtime**: REST repositories + Express + Prisma + Azure PostgreSQL
