import type { UserProfile } from "@linespace/api-client";
import type { DatabaseClient } from "./client.js";
import { ensureDatabaseResult } from "./errors.js";

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
