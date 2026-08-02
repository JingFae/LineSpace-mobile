/**
 * Only portable remote URLs may cross the API boundary. Inline data URLs make
 * feed responses enormous, while device-local file/blob URLs cannot be opened
 * by another user.
 */
export function isRemoteAssetUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;

  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export type SupabaseImageTransformOptions = {
  width: number;
  height?: number;
  quality: number;
  resize: "cover" | "contain" | "fill";
};

const supabasePublicObjectPath = "/storage/v1/object/public/";
const supabasePublicImagePath = "/storage/v1/render/image/public/";

/**
 * Derives a Supabase Image Transformation URL without changing the durable
 * object URL stored in the database. Non-Supabase URLs deliberately return
 * undefined so callers can keep using the original asset as a safe fallback.
 */
export function toSupabaseImageTransformUrl(
  value: unknown,
  options: SupabaseImageTransformOptions
): string | undefined {
  if (!isRemoteAssetUrl(value)) return undefined;

  const url = new URL(value);
  if (!url.pathname.includes(supabasePublicObjectPath)) return undefined;

  url.pathname = url.pathname.replace(
    supabasePublicObjectPath,
    supabasePublicImagePath
  );
  url.searchParams.set("width", String(options.width));
  if (options.height) url.searchParams.set("height", String(options.height));
  url.searchParams.set("quality", String(options.quality));
  url.searchParams.set("resize", options.resize);
  return url.toString();
}

export function toFeedThumbnailUrl(value: unknown) {
  return toSupabaseImageTransformUrl(value, {
    width: 800,
    quality: 70,
    resize: "contain"
  });
}

export function toAvatarThumbnailUrl(value: unknown) {
  return toSupabaseImageTransformUrl(value, {
    width: 192,
    height: 192,
    quality: 70,
    resize: "cover"
  });
}
