# Hostinger Backend & Frontend Deployment Guide

This guide describes how to run both the React frontend and Express/Prisma backend on Hostinger VPS, ensuring they can interact properly under a single domain (`https://manage.mujosaigon.com`).

---

## 🛠️ The Architecture
To host both frontend and backend on Hostinger:
1.  **Nginx (Web Server / Reverse Proxy)**:
    *   Serves the static React build files (`dist/`) directly to browsers.
    *   Acts as a reverse proxy, forwarding any request starting with `/api` to the backend Express server running on port `3001`.
2.  **PM2 (Node.js Process Manager)**:
    *   Runs the Express backend persistently in the background. If the server crashes or reboots, PM2 automatically restarts the process.
3.  **PostgreSQL (Database)**:
    *   Runs either locally via Docker/system service or remotely on Azure.

---

## 📋 Step-by-Step Setup on Hostinger VPS

### Step 1: Start the Backend using PM2
To run the backend in the background so it doesn't stop when you close your terminal:

1.  SSH into your Hostinger VPS.
2.  Navigate to the backend directory:
    ```bash
    cd /home/deploy/Just_Management/backend
    ```
3.  Ensure your environment variables are configured:
    ```bash
    nano .env
    ```
    *(Verify `PORT=3001` and `DATABASE_URL` are set correctly, and `M_MANAGEMENT_IMPORT_ROOT` points to a valid Linux directory like `/home/deploy/Just_Management/backend/imports`).*
4.  Install backend dependencies, compile the TypeScript code, and generate the Prisma Client:
    ```bash
    npm ci
    npm run build
    ```
5.  Apply database migrations to make sure the database tables exist:
    ```bash
    npm run db:deploy
    ```
6.  Start the Express server with PM2:
    ```bash
    pm2 start dist/index.js --name "just-backend"
    ```
7.  Configure PM2 to start automatically on system boot:
    ```bash
    pm2 startup
    pm2 save
    ```

---

### Step 2: Configure Nginx to route Front and Back ends
Nginx needs to know how to divide traffic between your React files and the Node server.

1.  Open the Nginx configuration file for your website:
    ```bash
    sudo nano /etc/nginx/sites-available/manage.mujosaigon.com
    ```
2.  Use the following configuration structure:
    ```nginx
    server {
        listen 80;
        server_name manage.mujosaigon.com;
        # Redirect all HTTP requests to HTTPS
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name manage.mujosaigon.com;

        # TLS Certificates (Certbot / Let's Encrypt)
        ssl_certificate /etc/letsencrypt/live/manage.mujosaigon.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/manage.mujosaigon.com/privkey.pem;

        # Root folder pointing to the built React SPA
        root /home/deploy/Just_Management/dist;
        index index.html;

        # Serve React frontend static files
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Reverse proxy /api calls to the Express backend
        location /api {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```
3.  Test Nginx configuration for syntax errors:
    ```bash
    sudo nginx -t
    ```
4.  If successful, reload Nginx to apply the changes:
    ```bash
    sudo systemctl reload nginx
    ```

---

## 🔍 Troubleshooting the Backend

If the frontend works but database/API calls load forever or return errors, check the status of the backend:

1.  **Check if PM2 is running the backend**:
    ```bash
    pm2 list
    ```
2.  **View logs to see why the server crashed**:
    ```bash
    pm2 logs just-backend
    ```
    *Look for Database connection errors, missing environment variables, or port allocation issues.*
3.  **Check if Node is listening on port 3001**:
    ```bash
    sudo ss -lptn | grep 3001
    ```
4.  **Test the backend directly from the VPS console**:
    ```bash
    curl http://localhost:3001/health
    ```
    *Should return: `{"status":"ok","track":"B"}`.*
