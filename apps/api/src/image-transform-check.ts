import {
  toAvatarThumbnailUrl,
  toFeedThumbnailUrl
} from "./database/core/public-assets.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const original =
  "https://sample.supabase.co/storage/v1/object/public/linespace-media/user/posts/image.png";
const feedThumbnail = toFeedThumbnailUrl(original);
assert(feedThumbnail, "A public Supabase image must produce a Feed thumbnail URL.");
const feedUrl = new URL(feedThumbnail);
assert(
  feedUrl.pathname ===
    "/storage/v1/render/image/public/linespace-media/user/posts/image.png",
  "The Feed URL must use Supabase's public image-render endpoint."
);
assert(
  feedUrl.searchParams.get("width") === "800" &&
    feedUrl.searchParams.get("quality") === "70" &&
    feedUrl.searchParams.get("resize") === "contain" &&
    !feedUrl.searchParams.has("height"),
  "The Feed thumbnail must preserve aspect ratio at the intended size and quality."
);

const avatarThumbnail = toAvatarThumbnailUrl(original);
assert(avatarThumbnail, "A public Supabase avatar must produce a thumbnail URL.");
const avatarUrl = new URL(avatarThumbnail);
assert(
  avatarUrl.searchParams.get("width") === "192" &&
    avatarUrl.searchParams.get("height") === "192" &&
    avatarUrl.searchParams.get("quality") === "70" &&
    avatarUrl.searchParams.get("resize") === "cover",
  "Avatar thumbnails must use the intended square crop."
);
assert(
  toFeedThumbnailUrl("https://images.example.com/image.png") === undefined,
  "External images must keep their original URL instead of being rewritten."
);
assert(
  toFeedThumbnailUrl("data:image/png;base64,AAAA") === undefined,
  "Inline image data must never enter a Feed response."
);

process.stdout.write(
  "Image transform check passed: Feed thumbnails and avatar derivatives preserve original assets.\n"
);
