import { readFile } from "node:fs/promises";
import * as vercelHandlerModule from "../../../api/index.js";

type VercelHandler = {
  fetch(request: Request): Promise<Response>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isVercelHandler(value: unknown): value is VercelHandler {
  return Boolean(
    value &&
      typeof value === "object" &&
      "fetch" in value &&
      typeof value.fetch === "function"
  );
}

const moduleDefault: unknown = vercelHandlerModule.default;
const nestedDefault =
  moduleDefault && typeof moduleDefault === "object" && "default" in moduleDefault
    ? moduleDefault.default
    : undefined;
const vercelHandler = isVercelHandler(moduleDefault)
  ? moduleDefault
  : isVercelHandler(nestedDefault)
    ? nestedDefault
    : null;
assert(vercelHandler, "The stable Vercel API entry does not export a fetch handler.");

const healthResponse = await vercelHandler.fetch(
  new Request("https://linespace.example/api?__linespace_api_path=health")
);
const health = await healthResponse.json() as { ok?: boolean; service?: string };
assert(healthResponse.status === 200, "Rewritten Vercel health route did not return 200.");
assert(
  health.ok === true && health.service === "linespace-api",
  "Rewritten Vercel API route was not handled by LineSpace API."
);
assert(
  healthResponse.headers.get("access-control-allow-origin") === "*",
  "Vercel API response is missing its CORS header."
);

const readinessResponse = await vercelHandler.fetch(
  new Request("https://linespace.example/api?__linespace_api_path=health/ready")
);
const readiness = await readinessResponse.json() as {
  service?: string;
  authConfigured?: boolean;
  communitySparkConfigured?: boolean;
  communitySparkModel?: string;
  communitySparkProvider?: string;
  communitySparkKeySource?: "DEEPSEEK_API_KEY" | "OPENAI_API_KEY" | null;
};
assert(
  readiness.service === "linespace-api" &&
    typeof readiness.authConfigured === "boolean" &&
    typeof readiness.communitySparkConfigured === "boolean" &&
    Boolean(readiness.communitySparkModel) &&
    readiness.communitySparkProvider === "deepseek" &&
    (readiness.communitySparkKeySource === null ||
      readiness.communitySparkKeySource === "DEEPSEEK_API_KEY" ||
      readiness.communitySparkKeySource === "OPENAI_API_KEY"),
  "Vercel readiness route did not return the Auth and Community Spark configuration contract."
);

const preflightResponse = await vercelHandler.fetch(
  new Request(
    "https://linespace.example/api?__linespace_api_path=v1/auth/register",
    { method: "OPTIONS" }
  )
);
assert(preflightResponse.status === 204, "Vercel Auth preflight did not return 204.");
assert(
  preflightResponse.headers.get("access-control-allow-methods") ===
    "GET,POST,PUT,DELETE,OPTIONS",
  "Vercel API preflight has an incomplete method list."
);

const config = JSON.parse(
  await readFile(new URL("../../../vercel.json", import.meta.url), "utf8")
) as {
  rewrites?: Array<{ source?: string; destination?: string }>;
};
const rootPackage = JSON.parse(
  await readFile(new URL("../../../package.json", import.meta.url), "utf8")
) as { type?: string };
const functionEntry = await readFile(
  new URL("../../../api/[...path].ts", import.meta.url),
  "utf8"
);

assert(
  rootPackage.type === "module",
  "The root package must remain ESM so Vercel does not require() the ESM API service."
);
assert(
  functionEntry.includes('import("../apps/api/src/routes.js")'),
  "The Vercel Function must load the ESM API route module with dynamic import()."
);
assert(
  !functionEntry.includes('import { handleApiRequest } from "../apps/api/src/routes.js"'),
  "The Vercel Function must not statically bridge its runtime to the ESM route module."
);
assert(
  config.rewrites?.[0]?.source === "/api/:path*" &&
    config.rewrites[0].destination === "/api?__linespace_api_path=:path*",
  "The API rewrite must precede the Expo SPA fallback."
);
assert(
  config.rewrites?.[1]?.destination === "/index.html",
  "The Expo SPA fallback is missing."
);

process.stdout.write(
  "Vercel check passed: the ESM Function handles /api before the Expo SPA fallback.\n"
);
