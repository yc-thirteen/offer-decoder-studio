// Shared helper for scripts/shots.mjs and scripts/a11y.mjs.
//
// Why not `vite preview`: this app builds with Nitro's cloudflare-module preset
// (via @lovable.dev/vite-tanstack-config), and TanStack Start's preview plugin
// then looks for dist/server/server.js, which doesn't exist, so every request
// returns 500. Instead we build the same app with NITRO_PRESET=node-server
// (honored outside the Lovable sandbox; the Vite config is untouched) and run
// the resulting .output/server/index.mjs with node. The normal `npm run build`
// (and `npm run verify`) still produces the Cloudflare build Lovable deploys.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function buildForPreview() {
  console.log("[serve] building with NITRO_PRESET=node-server …");
  const res = spawnSync("npx", ["vite", "build"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, NITRO_PRESET: "node-server" },
  });
  if (res.status !== 0) throw new Error("[serve] build failed");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Starts the node-server build. Returns { url, stop }. */
export async function startServer() {
  const port = await freePort();
  const child = spawn("node", [path.join(ROOT, ".output/server/index.mjs")], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NITRO_PORT: String(port) },
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error("[serve] server exited early");
    try {
      await fetch(url + "/");
      break;
    } catch {
      if (Date.now() > deadline) {
        child.kill();
        throw new Error("[serve] server did not start within 30s");
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  console.log(`[serve] listening on ${url}`);
  return {
    url,
    stop: () => {
      child.kill();
    },
  };
}

/** Build unless --no-build was passed, then start the server. */
export async function buildAndServe(argv = process.argv) {
  if (!argv.includes("--no-build")) buildForPreview();
  return startServer();
}
