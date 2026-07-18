import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCli = process.env.npm_execpath;

if (!pnpmCli) {
  process.stderr.write("Run this helper through `pnpm dev:api:local`.\n");
  process.exit(1);
}

const status = spawnSync(
  process.execPath,
  [pnpmCli, "exec", "supabase", "status", "-o", "env"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false
  }
);

if (status.status !== 0) {
  process.stderr.write(
    status.stderr ||
      status.error?.message ||
      "Local Supabase is not running.\n"
  );
  process.stderr.write("Start it with `pnpm db:start`, then try again.\n");
  process.exit(status.status ?? 1);
}

const localSupabase = parseEnv(status.stdout);
const publishableKey =
  localSupabase.PUBLISHABLE_KEY ?? localSupabase.ANON_KEY;
const required = {
  API_URL: localSupabase.API_URL,
  PUBLISHABLE_KEY: publishableKey,
  SERVICE_ROLE_KEY: localSupabase.SERVICE_ROLE_KEY
};
const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  process.stderr.write(
    `Local Supabase status did not provide: ${missing.join(", ")}.\n`
  );
  process.exit(1);
}

process.stdout.write(
  `Starting LineSpace API with local Supabase at ${localSupabase.API_URL}\n`
);

const child = spawn(
  process.execPath,
  [
    pnpmCli,
    "--filter",
    "@linespace/api",
    "exec",
    "tsx",
    "src/server.ts"
  ],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      PORT: process.env.PORT ?? "4000",
      SUPABASE_URL: localSupabase.API_URL,
      SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_ANON_KEY: localSupabase.ANON_KEY ?? publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: localSupabase.SERVICE_ROLE_KEY,
      AUTH_EMAIL_REDIRECT_URL:
        process.env.AUTH_EMAIL_REDIRECT_URL ??
        "http://localhost:8081/auth/confirm"
    },
    stdio: "inherit",
    shell: false
  }
);

child.on("error", (error) => {
  process.stderr.write(`Could not start the local API: ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

function parseEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}
