import { readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const idempotentMigration = await readFile(
  new URL("./migrations/202607160004_auth_trigger_idempotent.sql", import.meta.url),
  "utf8"
);
const userDomainMigration = await readFile(
  new URL("./migrations/202607180001_user_domain_persistence.sql", import.meta.url),
  "utf8"
);
const profileSchema = await readFile(new URL("./profile-schema.sql", import.meta.url), "utf8");
const profileRepository = await readFile(
  new URL("./profile-repository.ts", import.meta.url),
  "utf8"
);

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

for (const required of [
  /alter\s+table\s+public\.user_follows\s+enable\s+row\s+level\s+security/i,
  /alter\s+table\s+public\.inbox_messages\s+enable\s+row\s+level\s+security/i,
  /create\s+or\s+replace\s+function\s+public\.search_public_users/i,
  /create\s+or\s+replace\s+function\s+public\.list_public_connections/i,
  /create\s+or\s+replace\s+function\s+public\.update_my_profile/i,
  /security\s+invoker/i,
  /current_linespace_user_id/i
]) {
  assert(required.test(userDomainMigration), `User domain migration is missing ${required}.`);
}

assert(
  !/\b(create|alter)\s+table\s+.*\b(posts|poems|comments)\b/i.test(userDomainMigration),
  "User domain migration must not introduce Feed, Poem, or comment tables."
);

assert(
  !/SUPABASE_SERVICE_ROLE_KEY/.test(profileRepository),
  "ProfileRepository must never use the Service Role key."
);
assert(
  !/auth_user_id/.test(profileRepository),
  "ProfileRepository must not expose the auth_user_id field."
);
assert(
  /\.from\("inbox_messages"\)[\s\S]*select\("sender_user_id,recipient_user_id,created_at"\)/.test(
    profileRepository
  ),
  "Recent-contact queries must select participants and timestamps only."
);
assert(
  !/\.offset\s*\(/.test(profileRepository),
  "User-domain pagination must use keyset cursors rather than offset scans."
);
assert(
  /grant\s+update\s*\(\s*display_name,\s*avatar_url,\s*avatar_color,\s*bio\s*\)/i.test(
    userDomainMigration
  ) &&
    !/grant\s+update\s*\([^)]*\bauth_user_id\b/i.test(userDomainMigration),
  "Users must only receive update privileges for editable public profile fields."
);

process.stdout.write(
  "Database migration check passed: auth profile provisioning and user-domain RLS/RPC contracts are present.\n"
);
