import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";
const CLOUDFLARE_DATABASE_ID = "aaee091f-edd7-409a-956a-a11e7ae645f3";
const CLOUDFLARE_UPLOADS_KV_ID = "6680aff711c64a2ea4366046655c8ddd";

const { d1, r2 } = hostingConfig;
const isDirectCloudflareDeploy = process.env.CLOUDFLARE_DEPLOY === "1";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: "shenlun-ocr",
  main: "./worker/index.ts",
  compatibility_date: "2026-07-26",
  compatibility_flags: ["nodejs_compat"],
  observability: { enabled: true },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: isDirectCloudflareDeploy
            ? "shenlun-ocr-db"
            : "site-creator-d1",
          database_id: isDirectCloudflareDeploy
            ? CLOUDFLARE_DATABASE_ID
            : SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  // Direct Cloudflare deployment adds UPLOADS after the account's R2
  // subscription is enabled. Sites injects its own private bucket.
  r2_buckets: r2 && !isDirectCloudflareDeploy
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
  kv_namespaces: isDirectCloudflareDeploy
    ? [
        {
          binding: "UPLOADS_KV",
          id: CLOUDFLARE_UPLOADS_KV_ID,
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
