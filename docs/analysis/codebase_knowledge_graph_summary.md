# Codebase Knowledge Graph Analysis Summary

This document summarizes the codebase structure and relationship metadata generated for the **Just_Management** repository.

## Project Metadata
- **Project Name:** Just_Management
- **Description:** Hospitality operations dashboard for 8 Vietnamese properties with React, Express, Prisma, and Azure PostgreSQL.
- **Complexity:** Large
- **Total Files Scanned:** 438
- **Files Excluded via Ignored Patterns:** 115

## Architectural Layers
The project files have been mapped to **7 logical layers**:
1. **API Backend Layer** (33 files): Express server routes, ingestion scripts, integrations, and services under `backend/`.
2. **Database Schema & Migrations** (20 files): Prisma schema and SQL migrations representing database structures.
3. **Frontend UI Components** (89 files): React components and UI primitives for dashboard and operational views.
4. **Frontend Logic & Routing** (25 files): Custom React hooks, API repositories, routing setup, and utilities.
5. **Infrastructure & Deployment** (1 files): Docker files and other pipeline specifications.
6. **Project Configuration** (215 files): Workspace-level package, TypeScript, and build configs.
7. **Documentation** (55 files): Markdown documentation and architecture guides.

## Knowledge Graph Composition

### Graph Nodes (937 total)
- **Files (Code/Scripts):** 151
- **Functions:** 488
- **Classes:** 11
- **Configurations:** 213
- **Documents:** 53
- **Services (Infrastructure):** 1
- **Tables (SQL Migrations):** 19
- **Schema (Prisma):** 1

### Graph Edges (1,029 total)
- **Contains:** 499 (relationships between files and their functions/classes)
- **Exports:** 408 (explicit module exports)
- **Imports:** 48 (resolved internal dependencies)
- **Calls:** 74 (direct function call graph edges)

## Guided Tour Structure
An 8-step guided tour was compiled to onboard new developers to the codebase:
1. **Project Overview**: Covers `README.md` and `DESIGN.md`.
2. **Frontend Entry & Routing**: Covers React mount and router settings.
3. **State & Data Hooks**: Covers core query hooks.
4. **Repository Contracts**: Covers abstractions for both Supabase (Track A) and REST (Track B).
5. **Backend Server & Routes**: Covers Express endpoint hooks.
6. **Ingestion Pipeline**: Explains custom spreadsheet parser and pipeline seeding.
7. **Prisma Database Schema**: Explains schema design and tables.
8. **Containerization**: Shows Docker packaging.

## Review Notes
- **Issues:** 0 (Mechanical validation passed with no errors).
- **Warnings:** Only expected warnings regarding orphan nodes (e.g. static markdown files and config files with no code-level imports).
- **Artifact Path:** `c:/Users/Fate_Conqueror/GitHub/Just_Management/.understand-anything/knowledge-graph.json`
