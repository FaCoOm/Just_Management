# 🗂️ Just Management - Documentation Center

Welcome to the consolidated Documentation Center for **Just Management** (Hospitality Operations Dashboard). This folder serves as the single source of truth for all architectural decisions, design tokens, ingestion pipelines, database structures, project status, sprint plans, and developer resources.

---

## 🧭 Documentation Portal

Use the directories and files mapped below to navigate the project's design and technical specifications.

### 🏛️ Core Architecture & Design Specs

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| [ARCHITECTURE.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/ARCHITECTURE.md) | High-level system architecture, technology stacks, data access contracts, and environment. | Developers & Architects |
| [API_ARCHITECTURE_GUIDE.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/API_ARCHITECTURE_GUIDE.md) | Elaborates on Express API routing, Prisma interactions, and backend design details. | Backend Developers |
| [DESIGN.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/DESIGN.md) | Visual design tokens, HSL colors (Harbor/Brass), typography, and component rules. | Frontend Developers & UI Designers |
| [IMPLEMENTATION.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/IMPLEMENTATION.md) | Initial implementation details and historical architecture context. | Developers |
| [implementation-notes.html](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/implementation-notes.html) | Direct HTML logs detailing architectural transitions. | Developers |

---

### 📊 Project Status & Sprints

| Document | Description | Directory |
| :--- | :--- | :--- |
| [status.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/status.md) | High-level summary of the overall project status. | `docs/` |
| [NEXT_STEPS.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/NEXT_STEPS.md) | Upcoming backlog, user feedback loop, and critical tasks. | `docs/` |
| [SPRINT1_STATUS.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/SPRINT1_STATUS.md) | Review of Sprint 1 goals, completed items, and remaining items. | `docs/` |
| [Scrum Backlog & Sprints.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/Scrum%20Backlog%20%26%20Sprints.md) | Detailed Scrum items, backlog priorities, and sprint timeline. | `docs/plans/` |

---

### 🗺️ Project Directories & Folders

#### 📋 1. [plans/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans) — Product Requirements & Technical Plans
*   [Dual-Architecture PRD.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/Dual-Architecture%20PRD.md) — Product Requirements Document (PRD) detailing dual-architecture switching.
*   [m-management-ingestion-pipeline-implementation-plan.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/m-management-ingestion-pipeline-implementation-plan.md) — Plan for spreadsheets normalizer and ingest pipeline.
*   [track-b-technical-validation-plan.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/track-b-technical-validation-plan.md) — Technical verification and integration validation plans.
*   [manual-reservation-creation-2026-05-26.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/manual-reservation-creation-2026-05-26.md) — Backend and frontend execution plans.
*   [qa-testing-stack-implementation-2026-06-09.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/qa-testing-stack-implementation-2026-06-09.md) — Playwright e2e + axe-core + Lighthouse CI + GitHub Actions, with Browserbase Browse CLI local-mode exploratory QA path.

#### 🧠 2. [analysis/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/analysis) — Architectural & Cost Optimization Reports
*   [token-cost-optimization-report.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/analysis/token-cost-optimization-report.md) — Token-efficient guidelines for agent context.
*   [current-orchestration-efficiency-guide.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/analysis/current-orchestration-efficiency-guide.md) — Multi-agent workflow telemetry and efficiency patterns.
*   [omo-context-architecture-guide.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/analysis/omo-context-architecture-guide.md) — Guide on Context management, prompts, and agent behaviors.
*   [frontend-pages-reference.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/analysis/frontend-pages-reference.md) — Stakeholder-friendly page inventory with user stories and Mermaid sequence diagrams for every routed frontend page.

#### 💾 3. [database_design/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design) & [db_design/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/db_design) — Schemas & Raw Source Mappings
*   [database-implementation-overview.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/db_design/database-implementation-overview.md) — Database design models, constraints, and tables.
*   [schema-and-listing-sync-audit.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/db_design/schema-and-listing-sync-audit.md) — Database state validation and classification auditing.
*   [listings.csv](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design/listings.csv) & [reservations.csv](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design/reservations.csv) — Sample raw CSV files for ingestion testing.
*   [db-schema-airbnb.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design/db-schema-airbnb.md) — Reference-only PostgreSQL schema structures.

#### ⚙️ 4. [implementation/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/implementation) & [guidelines/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/guidelines) — Dev Guidelines & Session Logs
*   [opencode-skill-enforcement-guide.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/opencode-skill-enforcement-guide.md) — Custom skill loading and verification criteria.
*   [low-token-continuation-handoff-2026-05-26.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/implementation/low-token-continuation-handoff-2026-05-26.md) — Continuation state handoff report.
*   [manual-reservation-effort-and-token-cost-2026-05-26.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/implementation/manual-reservation-effort-and-token-cost-2026-05-26.md) — Token analysis and implementation cost telemetry.

#### 💡 5. [resources/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources) — Developer Support & Telemetry Reports
Contains 16 detailed developer guides, reports, and troubleshooting references:
*   [BACKEND_ANALYSIS.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources/BACKEND_ANALYSIS.md) — Deep Express backend structure and endpoint logic analysis.
*   [agent_input_context_mechanics.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources/agent_input_context_mechanics.md) — Deep-dive into AI agent context size optimization.
*   [ai_usage_efficiency_report.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources/ai_usage_efficiency_report.md) — Efficiency recommendations for AI model execution.
*   [antigravity-vs-cursor-insights-2026.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources/antigravity-vs-cursor-insights-2026.md) — Platform comparison notes on developer workspace integration.
*   [local_setup_guide.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources/local_setup_guide.md) — Step-by-step local development setup for React/Express/Prisma.
*   [performance_profiling_report.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/resources/performance_profiling_report.md) — Performance profiles and bundle-size analysis.

---

> [!TIP]
> Keep this folder tidy! When creating a new design schema or technical plan, place it in the appropriate `docs/` subfolder, and remember to update this `README.md` to keep our documentation easily navigable.
