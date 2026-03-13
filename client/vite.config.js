import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Development proxy: any request to /api/* is forwarded to the Express server.
    // This means you can also set VITE_API_URL=/api in your .env and avoid
    // hardcoding the port, while also sidestepping browser CORS preflight entirely.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
