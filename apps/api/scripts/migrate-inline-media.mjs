import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const [{ data: postRows, error: postError }, { data: userRows, error: userError }] =
  await Promise.all([
    client.from("posts").select("id,author_user_id,title,media").not("media", "is", null),
    client.from("users").select("id,handle,avatar_url").not("avatar_url", "is", null)
  ]);

if (postError) throw postError;
if (userError) throw userError;

const posts = (postRows ?? []).filter((row) => isInlineMedia(row.media?.uri));
const users = (userRows ?? []).filter((row) => isInlineMedia(row.avatar_url));

process.stdout.write(
  `${apply ? "APPLY" : "DRY RUN"}: found ${posts.length} inline post media item(s) and ${users.length} inline avatar(s).\n`
);

for (const post of posts) {
  const parsed = parseDataUrl(post.media.uri);
  const path = `${post.author_user_id}/migrated/posts/${post.id}.${parsed.extension}`;
  process.stdout.write(`post ${post.id} (${post.title ?? "untitled"}) -> ${path} (${parsed.buffer.length} bytes)\n`);
  if (!apply) continue;

  const publicUrl = await upload(path, parsed);
  const { error } = await client
    .from("posts")
    .update({ media: { ...post.media, uri: publicUrl, mimeType: parsed.contentType } })
    .eq("id", post.id);
  if (error) throw error;
}

for (const user of users) {
  const parsed = parseDataUrl(user.avatar_url);
  const path = `${user.id}/migrated/avatars/avatar.${parsed.extension}`;
  process.stdout.write(`avatar ${user.id} (@${user.handle}) -> ${path} (${parsed.buffer.length} bytes)\n`);
  if (!apply) continue;

  const publicUrl = await upload(path, parsed);
  const { error } = await client
    .from("users")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);
  if (error) throw error;
}

process.stdout.write(
  apply
    ? "Migration complete. Every database value was replaced only after its Storage upload succeeded.\n"
    : "No data was changed. Re-run with --apply after reviewing this list.\n"
);

async function upload(path, parsed) {
  const bucket = client.storage.from("linespace-media");
  const { error } = await bucket.upload(path, parsed.buffer, {
    contentType: parsed.contentType,
    cacheControl: "31536000",
    upsert: true
  });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

function isInlineMedia(value) {
  return typeof value === "string" && value.startsWith("data:");
}

function parseDataUrl(value) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(value);
  if (!match) throw new Error("Only Base64 JPEG, PNG, WebP, and GIF data URLs can be migrated.");
  const contentType = match[1];
  return {
    contentType,
    extension: contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length),
    buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64")
  };
}
