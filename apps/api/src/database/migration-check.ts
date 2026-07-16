import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const idempotentMigration = await readFile(
  new URL("./migrations/202607160004_auth_trigger_idempotent.sql", import.meta.url),
  "utf8"
);
const profileSchema = await readFile(new URL("./profile-schema.sql", import.meta.url), "utf8");

for (const [label, sql] of [
  ["auth trigger migration", idempotentMigration],
  ["fresh profile schema", profileSchema]
] as const) {
  assert(
    /on\s+conflict\s*\(auth_user_id\)\s+do\s+nothing/i.test(sql),
    `${label} must provision auth profiles idempotently.`
  );
}

assert(
  /create\s+or\s+replace\s+function\s+public\.handle_new_auth_user/i.test(idempotentMigration),
  "Auth trigger migration must be repeatable."
);

process.stdout.write("Database migration check passed: auth profile provisioning is idempotent.\n");
