import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@linespace/api-client";

export type DatabaseClient = SupabaseClient;

export class DomainRepositoryError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID"
      | "UNAVAILABLE",
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "DomainRepositoryError";
  }
}

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

export function ensureDatabaseResult(
  error: { code?: string; message?: string } | null
): void {
  if (!error) return;
  if (error.code === "23505") {
    throw new DomainRepositoryError(
      "CONFLICT",
      409,
      "The requested resource already exists."
    );
  }
  if (error.code === "42501" || error.code === "PGRST301") {
    throw new DomainRepositoryError(
      "FORBIDDEN",
      403,
      "You do not have permission to perform this action."
    );
  }
  if (error.code === "40001") {
    throw new DomainRepositoryError(
      "CONFLICT",
      409,
      "The resource changed. Please retry."
    );
  }
  throw new DomainRepositoryError(
    "UNAVAILABLE",
    503,
    "The data service is temporarily unavailable."
  );
}

export async function getCurrentLinespaceUserId(
  client: DatabaseClient
): Promise<string | null> {
  const result = await client.rpc("current_linespace_user_id");
  ensureDatabaseResult(result.error);
  return typeof result.data === "string" ? result.data : null;
}

export type UserRow = {
  id: string;
  linespace_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
};

export const publicUserSelect =
  "id,linespace_id,handle,display_name,avatar_url,avatar_color,bio";

export function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    ...(row.bio ? { bio: row.bio } : {})
  };
}

export async function loadProfiles(
  client: DatabaseClient,
  ids: string[]
): Promise<Map<string, UserProfile>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const result = await client
    .from("users")
    .select(publicUserSelect)
    .in("id", uniqueIds);
  ensureDatabaseResult(result.error);
  const rows = (result.data as UserRow[] | null) ?? [];
  return new Map(rows.map((row) => [row.id, toUserProfile(row)]));
}

export function countValue(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

export function dateLabel(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric"
  });
}

export function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

