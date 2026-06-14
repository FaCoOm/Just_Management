# Monorepo Migration Analysis

This document outlines the research, design trade-offs, and structural changes required to transition the repository into a formal monorepo structure using NPM Workspaces.

---

## 🏗️ Current vs. Proposed Layout

### Current Structure
```text
Just_Management/                  <-- Root acts as the Frontend workspace
├── package.json                  <-- Frontend dependencies & scripts
├── vite.config.ts                <-- Frontend bundler config
├── tsconfig.json                 <-- Frontend TypeScript config
├── src/                          <-- Frontend source code
├── public/                       <-- Frontend static assets
├── components.json               <-- Shadcn UI config (references root src/)
│
├── backend/                      <-- Nested Backend package
│   ├── package.json              <-- Backend dependencies & scripts
│   ├── src/                      <-- Backend source code
│   └── prisma/                   <-- Database schema and migrations
│
└── frontend/                     <-- Legacy bridge directory
    └── package.json              <-- Single run command for Docker
```

### Proposed Monorepo Structure
```text
Just_Management/                  <-- Monorepo Root (Orchestrator)
├── package.json                  <-- Root workspaces configuration and scripts
├── Dockerfile                    <-- Monorepo-aware Dockerfile
│
├── frontend/                     <-- Isolated Frontend Workspace
│   ├── package.json              <-- Frontend dependencies & scripts
│   ├── index.html                <-- Moved inside frontend/
│   ├── vite.config.ts            <-- Updated to resolve local directories
│   ├── tsconfig.json             <-- Updated TS configuration
│   ├── components.json           <-- Updated to target "./src" relative to frontend/
│   ├── src/                      <-- React source code
│   └── public/                   <-- Static assets
│
└── backend/                      <-- Isolated Backend Workspace
    ├── package.json              <-- Backend dependencies & scripts
    ├── src/                      <-- Backend source code
    └── prisma/                   <-- Database schema and migrations
```

---

## ⚖️ Trade-offs Analysis

### Pros
1. **Clean Codebase Structure**: Completely isolates the frontend configuration from the root directory. Root will only contain monorepo-level setups (e.g. global tools, CI/CD, docker config).
2. **Proper Separation of Concerns**: Frontend and Backend packages exist as peer sub-packages (`frontend` and `backend`), each maintaining their own TS configs, linters, and dependency maps.
3. **Easier Tooling Sharing**: Allows easy introduction of shared packages (e.g. `packages/shared-types` or `packages/ui`) in the future if needed.
4. **Standard Monorepo Workflow**: Developers can run scripts targetting workspaces from the root (e.g., `npm run dev --workspace=frontend`).

### Cons & Risks
1. **Broken Paths/Aliases**: Relocating folders requires updating:
   * TypeScript path configs (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`).
   * Shadcn UI path overrides (`components.json` paths).
   * Vite configuration file assets references.
2. **Docker Build Updates**: The `Dockerfile` must be rewritten to handle the new workspaces package copy and compilation layout.
3. **Local Dev Commands**: Developers must learn the new monorepo commands or use updated root scripts (`npm run dev:all`, etc.).
4. **Git History Noise**: Performing a large folder relocation (`git mv src/ -> frontend/src/`) might make tracking history slightly more verbose, although modern git logs track this easily with `--follow`.

---

## 📋 Action Plan for Migration

1. **Clean Legacy Directory**: Delete the current legacy [frontend/package.json](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/frontend/package.json).
2. **Relocate Frontend Assets**: Move `src/`, `public/`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, and `components.json` from the root into the `frontend/` folder.
3. **Configure Frontend Package File**: Move the root `package.json` into the `frontend/` folder and name the package `"frontend"`.
4. **Initialize Root Package File**: Create a new root `package.json` file defining NPM workspaces:
   ```json
   {
     "name": "just-management-monorepo",
     "private": true,
     "workspaces": [
       "frontend",
       "backend"
     ],
     "scripts": {
       "dev:all": "concurrently \"npm run dev -w frontend\" \"npm run dev -w backend\"",
       "build:all": "npm run build -w frontend && npm run build -w backend",
       "install:all": "npm install",
       "typecheck": "npm run typecheck -w frontend",
       "test:frontend": "npm run test:frontend -w frontend"
     },
     "devDependencies": {
       "concurrently": "^9.2.1"
     }
   }
   ```
5. **Adjust Configurations**:
   * Update [frontend/components.json](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/frontend/components.json) paths to point correctly within `frontend/` directory context.
   * Adjust Vite environment file locations so the frontend continues loading root `.env` values (using Vite's `envDir: "../"` configuration).
6. **Update Deployment Configurations**: Update the root `Dockerfile` to match the new structure.
7. **Verification**: Run `npm install`, then run verification scripts (`npm run build:all`, `npm run typecheck`, etc.) to prove the workspace executes flawlessly.
