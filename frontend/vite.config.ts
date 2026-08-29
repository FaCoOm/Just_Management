import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: true,
    // Disable Vite's own CORS middleware: it answers AuthKit preflight OPTIONS
    // without Access-Control-Allow-Origin, blocking the widget's cross-origin
    // token POST. Backend CORS (ALLOWED_ORIGINS) is the single source of truth.
    cors: false,
    // Proxy current REST API calls to the Express backend during local dev.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
})
