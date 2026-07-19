import { readdir, readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const canonicalMigrationsUrl = new URL("../../../../supabase/migrations/", import.meta.url);
const idempotentMigration = await readFile(
  new URL("20260716000400_auth_trigger_idempotent.sql", canonicalMigrationsUrl),
  "utf8"
);
const userDomainMigration = await readFile(
  new URL("20260718000100_user_domain_persistence.sql", canonicalMigrationsUrl),
  "utf8"
);
const profileSchema = await readFile(
  new URL("20260715000000_profile_foundation.sql", canonicalMigrationsUrl),
  "utf8"
);
const inboxGroupsMigration = await readFile(
  new URL("20260718000200_inbox_groups.sql", canonicalMigrationsUrl),
  "utf8"
);
const experienceMigration = await readFile(
  new URL("20260718000300_profile_experience.sql", canonicalMigrationsUrl),
  "utf8"
);
const contentMigration = await readFile(
  new URL("20260719000300_content_draft_inbox_persistence.sql", canonicalMigrationsUrl),
  "utf8"
);
const profileRepository = await readFile(
  new URL("./profile-repository.ts", import.meta.url),
  "utf8"
);
const canonicalMigrationFiles = (await readdir(canonicalMigrationsUrl))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();

assert(
  canonicalMigrationFiles.length === new Set(canonicalMigrationFiles).size,
  "Canonical Supabase migration names must be unique."
);
for (const fileName of canonicalMigrationFiles) {
  assert(
    /^\d{14}_[a-z0-9_]+\.sql$/.test(fileName),
    `Supabase migration ${fileName} must use a 14-digit timestamp and snake_case name.`
  );
}

assert(
  /create\s+table\s+if\s+not\s+exists\s+inbox_messages/i.test(profileSchema),
  "The core foundation must create inbox_messages for recent-contact queries."
);
assert(
  !/update\s+public\.users\s+set\s+handle\s*=\s*lower/i.test(
    await readFile(new URL("20260715000100_auth_identity.sql", canonicalMigrationsUrl), "utf8")
  ),
  "Auth identity migration must not silently rewrite existing handles."
);
for (const required of [
  /create\s+table\s+if\s+not\s+exists\s+public\.posts/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.post_comments/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.poem_drafts/i,
  /create\s+or\s+replace\s+function\s+public\.send_inbox_message/i,
  /create\s+or\s+replace\s+function\s+public\.share_post_to_inbox/i,
  /create\s+or\s+replace\s+function\s+public\.share_thread_to_inbox/i,
  /create\s+or\s+replace\s+function\s+public\.apply_draft_operation/i,
  /create\s+or\s+replace\s+function\s+public\.publish_draft_as_post/i,
  /create\s+or\s+replace\s+function\s+public\.publish_draft_as_thread/i,
  /storage\.buckets/i,
  /alter\s+table\s+public\.posts\s+enable\s+row\s+level\s+security/i,
  /alter\s+table\s+public\.post_comments\s+enable\s+row\s+level\s+security/i,
  /alter\s+table\s+public\.poem_drafts\s+enable\s+row\s+level\s+security/i,
  /create\s+trigger\s+posts_sync_profile_stats/i,
  /posts_count\s*=\s*greatest/i
] as const) {
  assert(required.test(contentMigration), `Content migration is missing ${required}.`);
}

assert(
  /revoke\s+execute\s+on\s+function\s+public\.award_profile_experience[\s\S]*authenticated/i.test(
    contentMigration
  ),
  "Experience awards must not be callable by regular authenticated clients."
);
assert(
  /create\s+or\s+replace\s+function\s+public\.is_active_inbox_group_member\(\s*p_group_id\s+text\)/i.test(
    contentMigration
  ) &&
    /create\s+or\s+replace\s+function\s+public\.is_active_inbox_group_member\(\s*p_group_id\s+text,\s*p_user_id[\s\S]*select\s+public\.current_user_is_active_inbox_group_member\(p_group_id\)/i.test(
      contentMigration
    ),
  "Inbox membership checks, including the compatibility overload, must derive the actor from JWT."
);
assert(
  /alter\s+table\s+public\.inbox_messages\s+enable\s+row\s+level\s+security/i.test(
    userDomainMigration
  ) &&
    /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.inbox_messages/i.test(
      contentMigration
    ),
  "Inbox writes must use actor-derived server transactions."
);
assert(
  /create\s+or\s+replace\s+function\s+public\.current_user_can_view_draft/i.test(
    contentMigration
  ) &&
    /owner_user_id\s*=\s*public\.current_linespace_user_id\(\)[\s\S]*current_user_can_view_draft\(id\)/i.test(
      contentMigration
    ),
  "Draft RLS must support owners and collaborators without recursive policies."
);
assert(
  /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.posts\s+from\s+authenticated/i.test(
    contentMigration
  ) &&
    /grant\s+insert\s*\(\s*id,\s*post_id,\s*author_user_id,\s*parent_comment_id,\s*body\s*\)/i.test(
      contentMigration
    ),
  "Clients must not write post counters or privileged post fields directly."
);
assert(
  /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.poem_drafts\s+from\s+authenticated/i.test(
    contentMigration
  ) &&
    !/grant\s+update\s*\([^)]*\bpublished_post_id\b/i.test(contentMigration),
  "Draft clients must not forge publication references."
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

for (const required of [
  /create\s+table\s+if\s+not\s+exists\s+public\.inbox_groups/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.inbox_group_members/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.inbox_group_messages/i,
  /validate_inbox_group_invitee/i,
  /mutual connections/i,
  /alter\s+table\s+public\.inbox_group_members\s+enable\s+row\s+level\s+security/i,
  /invitees respond to invitations/i,
  /active members send group messages/i
] as const) {
  assert(required.test(inboxGroupsMigration), `Inbox group migration is missing ${required}.`);
}

for (const required of [
  /create\s+table\s+if\s+not\s+exists\s+public\.user_experience/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.experience_events/i,
  /award_profile_experience/i,
  /recalculate_user_experience/i,
  /badge-ink-weaver/i,
  /badge-soul-echo/i,
  /alter\s+table\s+public\.experience_events\s+enable\s+row\s+level\s+security/i
] as const) {
  assert(required.test(experienceMigration), `Profile experience migration is missing ${required}.`);
}

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
  "Database migration check passed: canonical Supabase migrations preserve Auth/user contracts and enforce content, draft, inbox, Storage, and RLS contracts.\n"
);
