import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/** mkcert filenames for `mkcert localhost` run inside ./certs */
const LOCAL_DEV_HOST = "localhost";

const certDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "certs");
const certPath = path.join(certDir, `${LOCAL_DEV_HOST}.pem`);
const keyPath = path.join(certDir, `${LOCAL_DEV_HOST}-key.pem`);
const https =
  fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      }
    : undefined;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
    allowedHosts: [LOCAL_DEV_HOST],
    ...(https
      ? {
          https,
          ws: {
            host: LOCAL_DEV_HOST,
          },
        }
      : {}),
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
  ],
});
