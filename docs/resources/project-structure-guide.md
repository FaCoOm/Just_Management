# Project Structure & Architecture Guide

This document maps out where the frontend and backend workspace files are located in this monorepo repository.

---

## 🗺️ File Structure Map

```text
Just_Management/                   <-- Monorepo Root Directory (Orchestrator)
├── package.json                   <-- Root workspaces configuration and scripts
├── Dockerfile                     <-- Monorepo production backend Dockerfile
├── .env                           <-- Local environment variables (loaded by workspaces)
│
├── frontend/                      <-- ACTIVE FRONTEND WORKSPACE (React 19 + Vite 7 + TS)
│   ├── package.json               <-- Frontend dependencies & scripts
│   ├── index.html                 <-- Frontend HTML entry point
│   ├── vite.config.ts             <-- Vite configuration (loads .env from root via envDir)
│   ├── tsconfig.json              <-- TypeScript project config
│   ├── components.json            <-- Shadcn UI configuration
│   └── src/                       <-- React source code (components, hooks, routing, etc.)
│       ├── components/            <-- UI panels and pages (dashboard, reservations, etc.)
│       ├── hooks/                 <-- Shared state & query hooks
│       ├── lib/                   <-- REST API repository implementations
│       └── main.tsx               <-- React mount point
│
└── backend/                       <-- ACTIVE BACKEND WORKSPACE (Express API + Prisma)
    ├── package.json               <-- Backend dependencies & scripts
    ├── server.py                  <-- Reverse proxy bridge (uvicorn -> Express)
    ├── src/                       <-- Backend source code (ingest, integrations, tax-export)
    └── prisma/                    <-- Prisma schema & Azure migration history
```

---

## 🔍 Key Clarifications

1.  **Workspaces Setup**
    This repository is configured as an NPM Workspaces monorepo. Dependencies for both workspaces can be installed simultaneously by running `npm install` at the root.
2.  **Running Development Servers**
    *   To run both frontend and backend concurrently: `npm run dev:all` (or just `npm run dev`) at the root.
    *   To run the frontend only: `npm run dev -w frontend`.
    *   To run the backend only: `npm run dev -w backend`.
3.  **Building the Workspaces**
    *   To build both: `npm run build:all` (or `npm run build`) at the root.
    *   To build frontend only: `npm run build -w frontend`.
    *   To build backend only: `npm run build -w backend`.
4.  **Environment Variables**
    Environment configurations (`.env`) reside at the root level. The frontend is configured with `envDir: "../"` in its Vite config to load these variables from the parent root directory.
