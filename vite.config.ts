import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import fs from "node:fs";
import type { PluginOption } from "vite";

// Workaround: @tanstack/start-plugin-core preview-server-plugin looks for
// `dist/server/server.js`, but nitro (cloudflare-module preset in sandbox)
// outputs `dist/server/index.mjs`. Write a tiny shim so prerender/preview
// can resolve the expected entry path.
function serverEntryShim(): PluginOption {
  return {
    name: "lovable-server-entry-shim",
    apply: "build",
    closeBundle: {
      order: "post",
      handler() {
        const dir = path.resolve(__dirname, "dist/server");
        const target = path.join(dir, "index.mjs");
        const shim = path.join(dir, "server.js");
        if (fs.existsSync(target) && !fs.existsSync(shim)) {
          fs.writeFileSync(
            shim,
            `import handler from "./index.mjs";\n` +
              `// Wrap incoming Request to allow the Cloudflare adapter to set\n` +
              `// .ip/.runtime/.waitUntil (it assumes a Workers Request which permits\n` +
              `// arbitrary property assignment; native Request rejects writes).\n` +
              `function wrapReq(req) {\n` +
              `  const extras = Object.create(null);\n` +
              `  return new Proxy(req, {\n` +
              `    get(t, k) { if (k in extras) return extras[k]; const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v; },\n` +
              `    set(_t, k, v) { extras[k] = v; return true; },\n` +
              `    has(t, k) { return k in extras || k in t; },\n` +
              `  });\n` +
              `}\n` +
              `export default {\n` +
              `  fetch(req, env, ctx) {\n` +
              `    return handler.fetch(wrapReq(req), env ?? {}, ctx ?? { waitUntil() {}, passThroughOnException() {} });\n` +
              `  },\n` +
              `};\n`,
          );
        }
      },
    },
  };
}

export default defineConfig({
  plugins: [serverEntryShim()],
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
