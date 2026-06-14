# Unified Run and Build Guide

This document describes the changes made to the root [package.json](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/package.json) to allow running and building the entire project with single top-level scripts.

---

## 🛠️ Root Scripts Configuration
The root [package.json](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/package.json) scripts have been modified as follows:

```json
  "scripts": {
    "dev": "concurrently \"vite\" \"cd backend && npm run dev\"",
    "build": "tsc -b && vite build && cd backend && npm run build",
    "build:all": "npm run build",
    "install:all": "npm install && cd backend && npm install",
    "typecheck": "tsc --noEmit",
    "test:frontend": "vitest run --passWithNoTests",
    "preview": "vite preview",
    "start": "cd backend && node dist/index.js",
    "postinstall": "cd backend && npm install"
  }
```

---

## 🚀 Commands Usage

### 1. Development Mode (`npm run dev`)
To run both the React frontend and the Express backend concurrently on your local machine:
```bash
npm run dev
```
*   **Vite Frontend** runs on `http://localhost:5173`
*   **Express Backend** runs on `http://localhost:3001`
*   Vite acts as a reverse proxy for all `/api` calls.

### 2. Production Build (`npm run build`)
To compile both the React frontend and the Express backend:
```bash
npm run build
```
This builds:
*   Frontend files to `dist/` at the repository root.
*   Backend compiled files to `backend/dist/index.js`.

### 3. Production Run (`npm run start`)
To run the production backend service (Express server):
```bash
npm run start
```
*(On Hostinger, you can start the backend persistently under PM2 using `pm2 start backend/dist/index.js --name "just-backend"`).*
