import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type LocalCredentials = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

type FixtureUser = {
  authId: string;
  userId: string;
  client: SupabaseClient;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function localCredentials(): LocalCredentials {
  const cli = fileURLToPath(
    new URL("../../../../node_modules/supabase/dist/supabase.js", import.meta.url)
  );
  const result = spawnSync(process.execPath, [cli, "status", "-o", "env"], {
    cwd: new URL("../../../../", import.meta.url),
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error("Local Supabase is not running. Run pnpm db:start first.");
  }
  const values = new Map<string, string>();
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, name, rawValue] = match;
    if (name !== undefined && rawValue !== undefined) {
      values.set(name, rawValue.replace(/^"|"$/g, ""));
    }
  }
  const apiUrl = values.get("API_URL");
  const anonKey = values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  assert(apiUrl && anonKey && serviceRoleKey, "Local Supabase credentials are incomplete.");
  return { apiUrl, anonKey, serviceRoleKey };
}

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

async function createFixtureUser(
  admin: SupabaseClient,
  credentials: LocalCredentials,
  suffix: string,
  label: string
): Promise<FixtureUser> {
  const email = `rls-${label}-${suffix}@example.test`;
  const password = `Local-${crypto.randomUUID()}-9aA!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `rls_${label}_${suffix}`.slice(0, 32) }
  });
  assert(!created.error && created.data.user, `Could not create local user ${label}.`);
  const profile = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", created.data.user.id)
    .single();
  assert(!profile.error && profile.data, `Auth trigger did not create profile ${label}.`);
  const userClient = client(credentials.apiUrl, credentials.anonKey);
  const session = await userClient.auth.signInWithPassword({ email, password });
  assert(!session.error && session.data.session, `Could not sign in local user ${label}.`);
  return {
    authId: created.data.user.id,
    userId: profile.data.id as string,
    client: userClient
  };
}

async function run() {
  const credentials = localCredentials();
  const admin = client(credentials.apiUrl, credentials.serviceRoleKey);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const fixtures: FixtureUser[] = [];

  try {
    const userA = await createFixtureUser(admin, credentials, suffix, "a");
    const userB = await createFixtureUser(admin, credentials, suffix, "b");
    const userC = await createFixtureUser(admin, credentials, suffix, "c");
    fixtures.push(userA, userB, userC);

    const profileAttack = await userA.client
      .from("users")
      .update({ display_name: "Compromised" })
      .eq("id", userB.userId)
      .select("id");
    assert(!profileAttack.error && profileAttack.data?.length === 0, "User A modified B's profile.");

    const followAttack = await userA.client.from("user_follows").insert({
      follower_user_id: userB.userId,
      following_user_id: userC.userId
    });
    assert(Boolean(followAttack.error), "User A followed C as user B.");

    for (const [actor, target] of [
      [userA, userB],
      [userB, userA]
    ] as const) {
      const follow = await actor.client.from("user_follows").upsert(
        { follower_user_id: actor.userId, following_user_id: target.userId },
        { onConflict: "follower_user_id,following_user_id", ignoreDuplicates: true }
      );
      assert(!follow.error, "Could not prepare mutual local follows.");
    }

    const directMessage = await userB.client.rpc("send_inbox_message", {
      p_recipient_user_id: userC.userId,
      p_text: "private fixture",
      p_kind: "text",
      p_post_id: null,
      p_thread_id: null,
      p_continuation_id: null,
      p_excerpt: null
    });
    assert(!directMessage.error && directMessage.data, "Could not create private fixture message.");
    const inboxAttack = await userA.client
      .from("inbox_messages")
      .select("id")
      .eq("id", directMessage.data.id);
    assert(!inboxAttack.error && inboxAttack.data?.length === 0, "User A read B and C's private message.");

    const postId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const continuationId = crypto.randomUUID();
    const post = await admin.from("posts").insert({
      id: postId,
      author_user_id: userA.userId,
      title: "RLS post",
      body: "A persisted line for group sharing.",
      status: "published",
      visibility: "public",
      allow_sharing: true
    });
    assert(!post.error, "Could not create local Post fixture.");
    const thread = await admin.from("poetry_threads").insert({
      id: threadId,
      author_user_id: userA.userId,
      prompt: "RLS thread",
      starting_content: "The first shared line.",
      visibility: "public"
    });
    assert(
      !thread.error,
      `Could not create local Thread fixture: ${thread.error?.message ?? "unknown error"}`
    );
    const continuation = await admin.from("thread_continuations").insert({
      id: continuationId,
      thread_id: threadId,
      line_number: 2,
      content: "The second shared line.",
      author_user_id: userB.userId
    });
    assert(!continuation.error, "Could not create local continuation fixture.");

    const versionId = crypto.randomUUID();
    const version = await admin.from("thread_versions").insert({
      id: versionId,
      thread_id: threadId,
      kind: "custom",
      title: "Published RLS version",
      selected_continuation_ids: [continuationId],
      total_likes: 0,
      line_count: 2,
      created_by: userA.userId
    });
    assert(!version.error, "Could not create local Thread version fixture.");
    const versionLines = await admin.from("thread_version_lines").insert([
      {
        version_id: versionId,
        line_number: 1,
        text_content: "The first shared line.",
        author_user_id: userA.userId,
        likes: 0
      },
      {
        version_id: versionId,
        line_number: 2,
        continuation_id: continuationId,
        text_content: "The second shared line.",
        author_user_id: userB.userId,
        likes: 0
      }
    ]);
    assert(!versionLines.error, "Could not create local Thread version lines.");
    const foreignVersionPublish = await userB.client.rpc(
      "publish_thread_version_as_post",
      { p_thread_id: threadId, p_version_id: versionId }
    );
    assert(Boolean(foreignVersionPublish.error), "User B published user A's Thread version.");
    const versionPublish = await userA.client.rpc("publish_thread_version_as_post", {
      p_thread_id: threadId,
      p_version_id: versionId
    });
    assert(
      !versionPublish.error && typeof versionPublish.data === "string",
      "Thread version was not published as a Post."
    );
    const repeatedVersionPublish = await userA.client.rpc(
      "publish_thread_version_as_post",
      { p_thread_id: threadId, p_version_id: versionId }
    );
    assert(
      !repeatedVersionPublish.error &&
        repeatedVersionPublish.data === versionPublish.data,
      "Thread version publication was not idempotent."
    );
    const versionPost = await admin
      .from("posts")
      .select("author_user_id,title,body")
      .eq("id", versionPublish.data)
      .single();
    assert(
      !versionPost.error &&
        versionPost.data?.author_user_id === userA.userId &&
        versionPost.data?.body ===
          "The first shared line.\nThe second shared line.",
      "Published Thread version Post did not preserve its author or ordered lines."
    );

    const groupsBeforeRejectedInvite = await userA.client
      .from("inbox_groups")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userA.userId);
    const nonMutualGroup = await userA.client.rpc("create_inbox_group", {
      p_name: "Must roll back",
      p_invitee_user_ids: [userC.userId]
    });
    assert(Boolean(nonMutualGroup.error), "A non-mutual user was invited to a group.");
    const groupsAfterRejectedInvite = await userA.client
      .from("inbox_groups")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userA.userId);
    assert(
      !groupsBeforeRejectedInvite.error &&
        !groupsAfterRejectedInvite.error &&
      groupsBeforeRejectedInvite.count === groupsAfterRejectedInvite.count,
      "Rejected group creation left a partial group behind."
    );

    const directGroup = await userA.client.from("inbox_groups").insert({
      id: crypto.randomUUID(),
      name: "Bypass transaction",
      owner_user_id: userA.userId
    });
    assert(Boolean(directGroup.error), "A user directly inserted a group outside the RPC.");

    const createdGroup = await userA.client.rpc("create_inbox_group", {
      p_name: "RLS group",
      p_invitee_user_ids: [userB.userId, userB.userId]
    });
    assert(!createdGroup.error && createdGroup.data, "Could not create local Inbox group.");
    const groupId = createdGroup.data.id as string;
    const groupMembers = await userA.client
      .from("inbox_group_members")
      .select("user_id,role,status")
      .eq("group_id", groupId);
    assert(
      !groupMembers.error &&
        groupMembers.data?.length === 2 &&
        groupMembers.data.some(
          (member) =>
            member.user_id === userA.userId &&
            member.role === "owner" &&
            member.status === "active"
        ),
      "Group creation did not atomically create one owner and one deduplicated invite."
    );

    const accepted = await userB.client.rpc("respond_to_group_invitation", {
      p_group_id: groupId,
      p_response: "accepted"
    });
    assert(!accepted.error, "User B could not accept the local group invite.");
    const acceptedAgain = await userB.client.rpc("respond_to_group_invitation", {
      p_group_id: groupId,
      p_response: "accepted"
    });
    assert(!acceptedAgain.error, "Repeated identical invitation response was not idempotent.");

    const outsiderMessage = await userC.client.rpc("send_group_message", {
      p_group_id: groupId,
      p_text: "forged sender"
    });
    assert(Boolean(outsiderMessage.error), "A non-member sent a group message.");
    const memberMessage = await userB.client.rpc("send_group_message", {
      p_group_id: groupId,
      p_text: "transactional message"
    });
    assert(
      !memberMessage.error && memberMessage.data?.sender_user_id === userB.userId,
      "Group message sender was not derived from the JWT actor."
    );
    const directMessageBypass = await userB.client.from("inbox_group_messages").insert({
      id: crypto.randomUUID(),
      group_id: groupId,
      sender_user_id: userB.userId,
      kind: "text",
      text_body: "bypass"
    });
    assert(Boolean(directMessageBypass.error), "A member bypassed the group message RPC.");

    const sharedPost = await userA.client.rpc("share_post_to_inbox_group", {
      p_group_id: groupId,
      p_post_id: postId,
      p_note: "Open this Post"
    });
    assert(!sharedPost.error && sharedPost.data?.post_id === postId, "Group Post share failed.");
    const sharedThread = await userA.client.rpc("share_thread_to_inbox_group", {
      p_group_id: groupId,
      p_thread_id: threadId,
      p_continuation_id: null,
      p_note: "Open this Thread"
    });
    assert(!sharedThread.error && sharedThread.data?.thread_id === threadId, "Group Thread share failed.");
    const sharedContinuation = await userB.client.rpc("share_thread_to_inbox_group", {
      p_group_id: groupId,
      p_thread_id: threadId,
      p_continuation_id: continuationId,
      p_note: "Open this line"
    });
    assert(
      !sharedContinuation.error &&
        sharedContinuation.data?.continuation_id === continuationId &&
        sharedContinuation.data?.line_number === 2,
      "Group continuation click target failed."
    );

    const outsiderShare = await userC.client.rpc("share_post_to_inbox_group", {
      p_group_id: groupId,
      p_post_id: postId,
      p_note: null
    });
    assert(Boolean(outsiderShare.error), "A non-member shared content into the group.");
    const outsiderRead = await userC.client
      .from("inbox_group_messages")
      .select("id")
      .eq("group_id", groupId);
    assert(!outsiderRead.error && outsiderRead.data?.length === 0, "A non-member read group messages.");

    const memberRead = await userB.client
      .from("inbox_group_messages")
      .select("kind,post_id,thread_id,continuation_id,line_number")
      .eq("group_id", groupId);
    assert(!memberRead.error && memberRead.data?.length === 4, "Group messages and shares were not persisted.");

    const experienceBefore = await userA.client
      .from("user_experience")
      .select("creator_experience,total_experience,level")
      .eq("user_id", userA.userId)
      .single();
    assert(!experienceBefore.error && experienceBefore.data, "Could not load experience before engagement.");
    const realLike = await userB.client.from("thread_likes").insert({
      thread_id: threadId,
      user_id: userB.userId
    });
    assert(!realLike.error, "Could not create a real content experience event.");
    const experienceAfter = await userA.client
      .from("user_experience")
      .select("creator_experience,total_experience,level")
      .eq("user_id", userA.userId)
      .single();
    assert(
      !experienceAfter.error &&
        experienceAfter.data?.creator_experience ===
          (experienceBefore.data.creator_experience as number) + 2 &&
        experienceAfter.data.level >= 1 &&
        experienceAfter.data.level <= 10,
      "A real Thread like did not award exactly one bounded experience event."
    );
    const removedLike = await userB.client
      .from("thread_likes")
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", userB.userId);
    assert(!removedLike.error, "The engagement owner could not remove their Thread like.");
    const repeatedLike = await userB.client.from("thread_likes").insert({
      thread_id: threadId,
      user_id: userB.userId
    });
    assert(!repeatedLike.error, "Could not recreate the content engagement fixture.");
    const repeatedExperience = await userA.client
      .from("user_experience")
      .select("creator_experience")
      .eq("user_id", userA.userId)
      .single();
    assert(
      !repeatedExperience.error &&
        repeatedExperience.data?.creator_experience === experienceAfter.data.creator_experience,
      "Removing and recreating one engagement awarded duplicate experience."
    );
    const counters = await admin
      .from("poetry_threads")
      .select("shares_count")
      .eq("id", threadId)
      .single();
    const continuationCounters = await admin
      .from("thread_continuations")
      .select("shares_count")
      .eq("id", continuationId)
      .single();
    const postCounters = await admin
      .from("posts")
      .select("shares_count")
      .eq("id", postId)
      .single();
    assert(counters.data?.shares_count === 2, "Thread share counter is not atomic.");
    assert(continuationCounters.data?.shares_count === 1, "Continuation share counter is not atomic.");
    assert(postCounters.data?.shares_count === 1, "Post group-share counter is not atomic.");

    process.stdout.write(
      "Local database security check passed: profile/follow/inbox isolation, atomic group transactions, JWT-derived group senders, content-event experience, Thread-version publication, click targets, and atomic share counters.\n"
    );
  } finally {
    for (const fixture of fixtures.reverse()) {
      await admin.auth.admin.deleteUser(fixture.authId);
    }
  }
}

await run();
