import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

export default defineConfig({
  tanstackStart: {
    spa: { enabled: true, prerender: { outputPath: "/index" } },
  },
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "h3-v2": path.resolve(__dirname, "./node_modules/h3-v2/dist/_entries/cloudflare.mjs"),
      },
      noExternal: ["h3-v2"],
    },
    ssr: {
      noExternal: ["h3-v2"],
    },
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
  },
});
