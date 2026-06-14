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
    allowedHosts: ["host.docker.internal", "localhost", "127.0.0.1"],
    // In Track B mode, proxy /api calls to the Express backend.
    // Set VITE_TRACK=B in .env to use the REST API backend instead of Supabase.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
})
