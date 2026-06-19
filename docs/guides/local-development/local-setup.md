# Track B Web App — Local Activation & Execution Guide

This guide provides the complete, step-by-step setup procedure to configure, migrate, and run the Track B hospitality dashboard locally.

---

## 1. Prerequisites

Before starting the setup, ensure your local development environment has:
* **Node.js:** version `18.x` or higher installed.
* **Database:** A running PostgreSQL instance (either a local instance or an accessible Azure PostgreSQL Flexible Server).
* **Package Manager:** `npm` (bundled with Node.js).

---

## 2. Step 1: Install Dependencies

You must install dependencies for both the root workspace (frontend) and the backend directory. We provide a helper command at the root to handle this in one step:

```bash
# From the root directory:
npm run install:all
```

*If you prefer installing them manually:*
```bash
# Install frontend dependencies:
npm install

# Install backend dependencies:
cd backend
npm install
cd ..
```

---

## 3. Step 2: Configure Environment Variables

The webapp is composed of a frontend React application and an Express backend. Each layer is configured via its own `.env` file.

### 3.1 Frontend Configuration (Root `.env`)
Copy the root `.env.example` file to `.env`:

```bash
# In the root directory:
cp .env.example .env
```

Open `.env` and verify the following variables are set:
```env
# Forces the frontend code to use the REST API repositories (Track B) rather than Supabase (Track A).
VITE_TRACK=B

# The local origin URL where your Express API is running.
VITE_TRACK_B_API_URL=http://localhost:3001

# The endpoint used by the Connect Integration button to grab transient session keys.
VITE_ONE_AUTH_TOKEN_URL=http://localhost:3001/api/one/auth-token
```

### 3.2 Backend Configuration (`backend/.env`)
Copy the backend `.env.example` file to `.env`:

```bash
# Navigate to backend:
cd backend
cp .env.example .env
```

Open `backend/.env` and update the database URL to point to your PostgreSQL database.
* **For a Local PostgreSQL Instance:**
  ```env
  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/m_management"
  ```
* **For an Azure PostgreSQL Instance:**
  ```env
  DATABASE_URL="postgresql://your_user:your_password@your-server.postgres.database.azure.com:5432/m_management?sslmode=require"
  ```

Additionally, ensure these default configurations are active:
```env
PORT=3001
INGEST_PIPELINE_ENABLED=true
ONE_DEV_TOKEN=dev-only-shared-secret
M_MANAGEMENT_BUILTIN_SOURCE_DIR=../database_design
```

---

## 4. Step 3: Initialize the Database (Prisma)

With your database connection string configured, initialize the database schema and generate the Prisma Client bindings:

```bash
# From the backend/ directory:

# 1. Validate the Prisma Schema file
npm run db:validate

# 2. Synchronize your database with the Prisma Schema
# This applies the migrations to create the required 17 tables.
npx prisma migrate dev --name init_local_schema

# 3. Generate the Prisma Client types
npm run db:generate
```

---

## 5. Step 4: Run the Web App Locally

You can launch both the frontend and backend servers together or in separate processes.

### Method A: Single Command (Recommended)
From the root workspace directory, run:

```bash
npm run dev:all
```
This starts both servers concurrently:
* **Frontend Dev Server:** runs on `http://localhost:5173` (using Vite proxy to handle `/api` calls).
* **Backend Express Server:** runs on `http://localhost:3001`.

### Method B: Separate Terminal Processes
If you prefer isolated logs, start the servers in separate terminals:

* **Terminal 1 (Backend):**
  ```bash
  cd backend
  npm run dev
  ```
* **Terminal 2 (Frontend):**
  ```bash
  npm run dev
  ```

---

## 6. Step 5: Verification & Verification Commands

To prove that the local setup is functioning correctly without errors, execute the following verification commands:

### 6.1 Backend Ingestion Verification
Run the integrated end-to-end integration sync test suite to confirm the ingestion endpoints are healthy and mock syncs succeed:
```bash
# From the backend/ directory:
npm run verify-ingestion
```

### 6.2 Full Compile Validation
Run TypeScript compilation and production builds to ensure the system is completely robust:
```bash
# From the root directory:

# 1. Verify frontend TypeScript type-safety
npm run typecheck

# 2. Build the production assets
npm run build:all
```

---

## 7. Troubleshooting Tips

> [!NOTE]
> **Database Cold Connects:** 
> First API requests (like `/api/dashboard/summary`) will pre-warm your connection pool automatically. Ensure the backend logs `Prisma pre-warm complete` on startup.

> [!WARNING]
> **CORS Blockers:**
> If you test the frontend using an IP address instead of `localhost`, verify that your root `backend/.env` CORS configuration matches the new URL origin exactly.
