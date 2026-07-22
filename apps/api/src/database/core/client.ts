import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DatabaseClient = SupabaseClient;

export function createDatabaseClientForRequest(
  authorization?: string
): DatabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !publicKey) return null;

  const token = extractBearerToken(authorization);
  return createClient(url, publicKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    ...(token
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      : {})
  });
}

export function extractBearerToken(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || undefined;
}
