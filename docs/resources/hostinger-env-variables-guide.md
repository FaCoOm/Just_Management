# Hostinger Production Environment Variables Guide (Production-Only Hostinger Setup)

Since both the frontend and backend are hosted strictly on the Hostinger VPS (without local machine development), here is the streamlined configuration for your environment.

---

## 🖥️ Backend Environment Variables (`backend/.env`)

Configure these directly on the Hostinger VPS inside the `backend/.env` file or within the PM2 environment configuration.

| Variable Name | Production Hostinger Value | Rationale |
| :--- | :--- | :--- |
| **`PORT`** | `3001` | The internal port where the Express backend listens. Nginx proxies traffic to this port. |
| **`ALLOWED_ORIGINS`** | `https://manage.mujosaigon.com` | Only allow requests originating from your production domain. Since local development is not used, localhost origins can be omitted for security. |
| **`DATABASE_URL`** | `postgresql://user:pass@localhost:5432/m_management` | Update this to the self-hosted PostgreSQL database running on the Hostinger VPS. |
| **`M_MANAGEMENT_IMPORT_ROOT`** | `"/home/deploy/Just_Management/backend/imports"` | **MUST BE A LINUX PATH.** Ensure the folder exists on the server and that the process running the Node backend has full read/write permissions. |

---

## 🌐 Frontend Environment Variables (`.env.production`)

Configure these variables before building the frontend bundle on Hostinger (`npm run build`).

| Variable Name | Production Hostinger Value | Rationale |
| :--- | :--- | :--- |
| **`VITE_TRACK_B_API_URL`** | `https://manage.mujosaigon.com` | Set explicitly to the production domain so that all frontend API calls target the backend correctly. |
| **`VITE_ONE_AUTH_TOKEN_URL`** | `/api/one/auth-token` | Maps AuthKit connection requests properly through the backend reverse proxy. |


---

## 🔒 Security Posture
*   By setting `ALLOWED_ORIGINS` to only `https://manage.mujosaigon.com`, you prevent any external domain or unauthorized local machine scripts from calling your backend APIs.
