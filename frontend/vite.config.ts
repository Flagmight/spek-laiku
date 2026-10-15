import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The browser sees one origin, so the SameSite=Lax sign-in cookie works without CORS.
      "/api": {
        target: "https://localhost:7254",
        changeOrigin: true,
        // The API uses the local ASP.NET Core development certificate.
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    // Process stylesheets in tests too, so the responsive tests can check the real CSS rules.
    css: { include: [/\.css(\?|$)/] },
    setupFiles: ["./src/tests/setup.ts"],
  },
})
