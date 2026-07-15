import type { AuthSession } from "@linespace/api-client";

export type EmailConfirmationCallback =
  | { kind: "session"; session: AuthSession }
  | { kind: "error" }
  | { kind: "none" };

/** Parses the documented Supabase implicit-flow URL fragment without logging it. */
export function parseEmailConfirmationUrl(rawUrl: string): EmailConfirmationCallback {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: "none" };
  }

  const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!fragment) return { kind: "none" };
  const params = new URLSearchParams(fragment);
  if (params.has("error") || params.has("error_code")) return { kind: "error" };

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresAt = Number(params.get("expires_at"));
  const expiresIn = Number(params.get("expires_in"));
  const tokenType = params.get("token_type") ?? "bearer";
  if (
    !accessToken ||
    !refreshToken ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(expiresIn)
  ) {
    return { kind: "error" };
  }

  return {
    kind: "session",
    session: { accessToken, refreshToken, expiresAt, expiresIn, tokenType }
  };
}

export function clearEmailConfirmationFragment() {
  if (typeof window === "undefined" || !window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

