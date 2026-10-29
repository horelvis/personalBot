import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const server = "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": server, "/auth": server, "/health": server },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
