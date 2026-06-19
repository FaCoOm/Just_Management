# Local Development Environment Variables Guide

This guide outlines the environment variable values to use when running the application on your local development machine.

---

## 🖥️ Backend Environment Variables (`backend/.env`)

Configure these in the `backend/.env` file on your local machine.

| Variable Name | Local Development Value | Rationale |
| :--- | :--- | :--- |
| **`PORT`** | `3001` | The port where the Express backend listens. |
| **`ALLOWED_ORIGINS`** | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:4173` | Allows CORS requests coming from the local Vite development servers. |
| **`DATABASE_URL`** | Local PostgreSQL connection string (or the Azure connection string for remote testing) | Set to your local PostgreSQL database (e.g. `postgresql://postgres:postgres@localhost:5432/just_management`). |
| **`M_MANAGEMENT_IMPORT_ROOT`** | `"C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/imports"` | **MUST BE A WINDOWS PATH** matching your local clone location. |

---

## 🌐 Frontend Environment Variables (`.env`)

Configure these in the root `.env` file of the project on your local machine.

| Variable Name | Local Development Value | Rationale |
| :--- | :--- | :--- |
| **`VITE_TRACK_B_API_URL`** | *(Blank / Empty)* or `http://localhost:3001` | Leaving it blank allows Vite's local dev server proxy (defined in `vite.config.ts`) to intercept `/api` calls and forward them to `http://localhost:3001` automatically. Set explicitly if bypassing proxy. |
| **`VITE_ONE_AUTH_TOKEN_URL`** | `/api/one/auth-token` | Maps AuthKit connection requests properly through the backend reverse proxy. |
