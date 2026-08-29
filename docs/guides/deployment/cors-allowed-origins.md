# CORS ALLOWED_ORIGINS Configuration Guide (Hostinger-Only Hosting)

This guide explains the purpose of the `ALLOWED_ORIGINS` environment variable and how to configure it when hosting both frontend and backend on Hostinger (with no local development machine).

## What is ALLOWED_ORIGINS?
`ALLOWED_ORIGINS` is a list of trusted websites (origins) allowed to make requests to the Express backend API.
*   **Security mechanism (CORS)**: Modern browsers block web applications from making requests to a different domain unless the backend explicitly permits it via Cross-Origin Resource Sharing (CORS) headers.
*   **How it works**: When the frontend app (e.g. running on `https://manage.mujosaigon.com`) sends an HTTP request to the backend, the browser includes the header `Origin: https://manage.mujosaigon.com`. The Express server checks if this matches the list defined in `ALLOWED_ORIGINS`. If it matches, the request is allowed. If not, the request fails with a CORS block error.

---

## Production Hostinger Configuration
Since you are serving both the frontend and backend strictly from Hostinger (production-only environment):

### 1. The Value to Set
In your `backend/.env` file on Hostinger, define it as:
```env
ALLOWED_ORIGINS=https://manage.mujosaigon.com,https://auth.withone.ai,https://app.withone.ai
```

> [!NOTE]
> `backend/src/index.ts` automatically merges `https://auth.withone.ai`, `https://app.withone.ai`, and `https://manage.mujosaigon.com` into `DEFAULT_ALLOWED_ORIGINS` and normalizes trailing slashes, ensuring AuthKit token requests are never rejected by CORS even if minimal configurations are provided.

### 2. Why omit localhost in Production?
Since you are not running the codebase or debugging from a local machine in production, omitting `http://localhost` or `http://127.0.0.1` ensures that no local mock setups can make API calls to your live database backend, raising your security posture.

### ⚠️ Rules for Origins
1.  **Normalization is Automatic**: While trailing slashes are automatically sanitized by the backend normalization layer, configuring clean origins (e.g. `https://manage.mujosaigon.com`) is standard practice.
2.  **Match HTTPS/HTTP exactly**: Ensure the protocol is correct. If your production site uses HTTPS, specify `https://manage.mujosaigon.com`, not `http://manage.mujosaigon.com`.
