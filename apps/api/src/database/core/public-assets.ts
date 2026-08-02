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
