import { readdir, readFile } from "node:fs/promises";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const canonicalMigrationsUrl = new URL("../../../../../supabase/migrations/", import.meta.url);
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
const groupSharingMigration = await readFile(
  new URL("20260719000400_group_content_sharing.sql", canonicalMigrationsUrl),
  "utf8"
);
const contentDiscoveryMigration = await readFile(
  new URL("20260719000500_content_discovery.sql", canonicalMigrationsUrl),
  "utf8"
);
const liveContentRuntimeMigration = await readFile(
  new URL("20260720000100_live_content_runtime.sql", canonicalMigrationsUrl),
  "utf8"
);
const inboxActivityMigration = await readFile(
  new URL("20260720000200_inbox_activity_notifications.sql", canonicalMigrationsUrl),
  "utf8"
);
const contentExperienceMigration = await readFile(
  new URL("20260720000300_content_experience_progression.sql", canonicalMigrationsUrl),
  "utf8"
);
const groupTransactionsMigration = await readFile(
  new URL("20260720000400_inbox_group_transactions.sql", canonicalMigrationsUrl),
  "utf8"
);
const threadEngagementPermissionsMigration = await readFile(
  new URL("20260720000500_thread_engagement_delete_permissions.sql", canonicalMigrationsUrl),
  "utf8"
);
const engagementProfileInboxPostManagementMigration = await readFile(
  new URL("20260720000600_engagement_profile_inbox_post_management.sql", canonicalMigrationsUrl),
  "utf8"
);
const relayDraftSemanticsMigration = await readFile(
  new URL("20260721000100_relay_draft_semantics.sql", canonicalMigrationsUrl),
  "utf8"
);
const threadVersionParticipantPostsMigration = await readFile(
  new URL("20260721000200_thread_version_participant_posts.sql", canonicalMigrationsUrl),
  "utf8"
);
const stableThreadLinesMigration = await readFile(
  new URL("20260722000100_thread_continuation_stable_lines.sql", canonicalMigrationsUrl),
  "utf8"
);
const profileRepository = await readFile(
  new URL("../profile/supabase-profile.repository.ts", import.meta.url),
  "utf8"
);
const threadRepository = await readFile(
  new URL("../thread/thread.repository.ts", import.meta.url),
  "utf8"
);
const inboxRepository = await readFile(
  new URL("../inbox/inbox.repository.ts", import.meta.url),
  "utf8"
);
const canonicalMigrationFiles = (await readdir(canonicalMigrationsUrl))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();

assert(
  canonicalMigrationFiles.length === new Set(canonicalMigrationFiles).size,
  "Canonical Supabase migration names must be unique."
);

for (const required of [
  /with\s+recursive\s+continuation_lines/i,
  /new\.line_number\s*:=\s*parent_line_number\s*\+\s*1/i,
  /continuation thread, parent, and line number are immutable/i,
  /create\s+trigger\s+thread_continuations_validate_parent/i,
  /revoke\s+execute\s+on\s+function\s+public\.validate_thread_continuation_parent/i
] as const) {
  assert(
    required.test(stableThreadLinesMigration),
    `Stable thread line migration is missing ${required}.`
  );
}
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
for (const required of [
  /create\s+table\s+if\s+not\s+exists\s+public\.thread_version_posts/i,
  /primary\s+key\s*\(version_id,\s*user_id\)/i,
  /create\s+or\s+replace\s+function\s+public\.publish_thread_version_as_post[\s\S]*p_title\s+text\s+default\s+null/i,
  /thread_row\.author_user_id\s*<>\s*actor_id[\s\S]*public\.thread_continuations/i,
  /Only Thread participants can publish this version/i,
  /coalesce\(nullif\(btrim\(p_title\),\s*''\),\s*version_row\.title\)/i,
  /insert\s+into\s+public\.thread_version_posts/i,
  /grant\s+execute\s+on\s+function\s+public\.publish_thread_version_as_post\(text,\s*text,\s*text\)/i
] as const) {
  assert(
    required.test(threadVersionParticipantPostsMigration),
    `Thread Version participant-post migration is missing ${required}.`
  );
}

for (const required of [
  /add\s+column\s+if\s+not\s+exists\s+saves_count/i,
  /thread_saves_sync_thread_count/i,
  /post_comment_engagements_sync_count/i,
  /create\s+or\s+replace\s+function\s+public\.mark_inbox_activity_read/i,
  /create\s+or\s+replace\s+function\s+public\.publish_draft_over_post/i,
  /create\s+or\s+replace\s+function\s+public\.delete_my_post/i,
  /actor_id\s+text\s*:=\s*public\.current_linespace_user_id\(\)/i,
  /grant\s+execute\s+on\s+function\s+public\.mark_inbox_activity_read[\s\S]*to\s+authenticated/i
] as const) {
  assert(
    required.test(engagementProfileInboxPostManagementMigration),
    `Engagement/Profile/Inbox/Post migration is missing ${required}.`
  );
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

for (const required of [
  /create\s+or\s+replace\s+function\s+public\.share_post_to_inbox_group/i,
  /create\s+or\s+replace\s+function\s+public\.share_thread_to_inbox_group/i,
  /create\s+or\s+replace\s+function\s+public\.publish_thread_version_as_post/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.post_group_shares/i,
  /create\s+table\s+if\s+not\s+exists\s+public\.thread_group_shares/i,
  /inbox_group_messages_content_check/i,
  /current_user_is_active_inbox_group_member\(p_group_id\)/i,
  /revoke\s+all\s+on\s+public\.post_group_shares,\s*public\.thread_group_shares/i,
  /cardinality\(coalesce\(p_recipient_user_ids,\s*'\{\}'\)\)\s+not\s+between\s+1\s+and\s+50/i
] as const) {
  assert(
    required.test(groupSharingMigration),
    `Group content-sharing migration is missing ${required}.`
  );
}
assert(
  /grant\s+delete\s+on\s+public\.thread_likes,\s*public\.thread_continuation_likes,\s*public\.thread_saves\s+to\s+authenticated/i.test(
    threadEngagementPermissionsMigration
  ),
  "Thread engagement deletes must be enabled only through the existing actor-owned RLS policies."
);
assert(
  /orphan post_id values exist/i.test(groupSharingMigration) &&
    /will not rewrite message history/i.test(groupSharingMigration),
  "Group sharing migration must fail with repair guidance instead of rewriting historical messages."
);

assert(
  /create\s+or\s+replace\s+function\s+public\.content_search_document[\s\S]*immutable/i.test(
    contentDiscoveryMigration
  ) &&
    /posts_search_trgm_idx[\s\S]*public\.content_search_document/i.test(
      contentDiscoveryMigration
    ) &&
    /poetry_threads_search_trgm_idx[\s\S]*public\.content_search_document/i.test(
      contentDiscoveryMigration
    ),
  "Content search indexes must use the immutable search-document expression accepted by PostgreSQL."
);

for (const required of [
  /add\s+column\s+if\s+not\s+exists\s+likes_count/i,
  /create\s+trigger\s+thread_likes_sync_counter/i,
  /create\s+index\s+if\s+not\s+exists\s+posts_latest_page_idx/i,
  /create\s+index\s+if\s+not\s+exists\s+posts_popular_page_idx/i,
  /create\s+index\s+if\s+not\s+exists\s+threads_latest_page_idx/i,
  /create\s+index\s+if\s+not\s+exists\s+threads_popular_page_idx/i,
  /create\s+or\s+replace\s+function\s+public\.create_poem_draft/i,
  /actor_id\s+text\s*:=\s*public\.current_linespace_user_id\(\)/i,
  /revoke\s+execute\s+on\s+function\s+public\.create_poem_draft\(text\)[\s\S]*from\s+public,\s*anon/i,
  /grant\s+execute\s+on\s+function\s+public\.create_poem_draft\(text\)[\s\S]*to\s+authenticated/i
] as const) {
  assert(
    required.test(liveContentRuntimeMigration),
    `Live content runtime migration is missing ${required}.`
  );
}
assert(
  !/\b(user-lili|user-ray|user-jinghe|user-zhihan|user-roma)\b/i.test(
    liveContentRuntimeMigration
  ),
  "Live content runtime migration must never seed demo identities or conversations."
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
for (const required of [
  /create\s+table\s+if\s+not\s+exists\s+public\.inbox_activity_events/i,
  /post_likes_notify_inbox/i,
  /post_saves_notify_inbox/i,
  /post_comment_engagements_notify_inbox/i,
  /thread_likes_notify_inbox/i,
  /thread_saves_notify_inbox/i,
  /thread_continuation_likes_notify_inbox/i,
  /user_follows_notify_inbox/i,
  /posts_mentions_notify_inbox/i,
  /poetry_threads_mentions_notify_inbox/i,
  /alter\s+table\s+public\.inbox_activity_events\s+enable\s+row\s+level\s+security/i,
  /revoke\s+execute\s+on\s+function\s+public\.insert_inbox_activity_event[\s\S]*from\s+public,\s*anon,\s*authenticated/i,
  /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.inbox_activity_events/i,
  /grant\s+update\s*\(\s*read_at\s*\)\s+on\s+public\.inbox_activity_events/i
] as const) {
  assert(required.test(inboxActivityMigration), `Inbox activity migration is missing ${required}.`);
}
assert(
  !/auth_user_id/.test(profileRepository),
  "ProfileRepository must not expose the auth_user_id field."
);

for (const required of [
  /user_experience_level_check\s+check\s*\(level\s+between\s+1\s+and\s+10\)/i,
  /users_level_range_check\s+check\s*\(level\s+between\s+1\s+and\s+10\)/i,
  /greatest\([\s\S]{0,80}least\(10,[\s\S]{0,120}\/\s*10\.0\)[\s\S]{0,40}\+\s*1\)\)/i,
  /create\s+or\s+replace\s+function\s+public\.record_content_experience/i,
  /create\s+or\s+replace\s+function\s+public\.award_content_experience_from_row/i,
  /posts_award_experience/i,
  /poetry_threads_award_experience/i,
  /thread_continuations_award_experience/i,
  /post_comments_award_experience/i,
  /post_comment_engagements_award_experience/i,
  /on\s+conflict\s*\(event_key\)\s+do\s+nothing/i,
  /revoke\s+execute\s+on\s+function\s+public\.record_content_experience[\s\S]*authenticated/i
] as const) {
  assert(
    required.test(contentExperienceMigration),
    `Content experience migration is missing ${required}.`
  );
}

for (const required of [
  /create\s+or\s+replace\s+function\s+public\.create_inbox_group/i,
  /create\s+or\s+replace\s+function\s+public\.respond_to_group_invitation/i,
  /create\s+or\s+replace\s+function\s+public\.send_group_message/i,
  /actor_id\s+text\s*:=\s*public\.current_linespace_user_id\(\)/i,
  /group invitations are limited to mutual connections/i,
  /for\s+update/i,
  /revoke\s+insert\s+on\s+public\.inbox_groups\s+from\s+authenticated/i,
  /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.inbox_group_members/i,
  /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.inbox_group_messages/i,
  /grant\s+execute\s+on\s+function\s+public\.create_inbox_group[\s\S]*to\s+authenticated/i
] as const) {
  assert(
    required.test(groupTransactionsMigration),
    `Inbox group transaction migration is missing ${required}.`
  );
}
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
  /legacyThreadSelect/.test(threadRepository) &&
    /isMissingThreadSavesCount/.test(threadRepository) &&
    /normalizeThreadRows/.test(threadRepository),
  "Thread reads must remain available while the saves_count migration rolls out."
);
assert(
  /groupWithRelationsSelect/.test(inboxRepository) &&
    /referencedTable:\s*"inbox_group_messages"/.test(inboxRepository) &&
    /\.limit\(1,\s*\{\s*referencedTable:\s*"inbox_group_messages"\s*\}\)/.test(
      inboxRepository
    ),
  "Inbox group reads must batch members and the latest message through embedded relations."
);
assert(
  /return\s+this\.mapGroups\(groups\)/.test(inboxRepository) &&
    !/groups\.map\(\s*\(group\)\s*=>\s*this\.mapGroup\(group\)\s*\)/.test(inboxRepository),
  "Inbox group lists must use the batch mapper rather than issuing queries per group."
);
for (const required of [
  /add\s+column\s+if\s+not\s+exists\s+relay_first_line/i,
  /add\s+column\s+if\s+not\s+exists\s+relay_rules/i,
  /resolved_title\s*:=\s*coalesce\([\s\S]*'poem relay'/i,
  /resolved_first_line[\s\S]*draft_row\.relay_first_line/i,
  /resolved_rules[\s\S]*draft_row\.relay_rules/i,
  /grant\s+update\s*\(relay_first_line,\s*relay_rules\)/i
] as const) {
  assert(
    required.test(relayDraftSemanticsMigration),
    `Relay draft semantics migration is missing ${required}.`
  );
}
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
