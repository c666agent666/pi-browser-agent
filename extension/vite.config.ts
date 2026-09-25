import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: "src/sidepanel/index.html",
        background: "src/background/index.ts",
        content: "src/content/index.ts",
      },
    },
  },
  server: {
    port: 5173,
    hmr: { port: 5174 },
  },
});