import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  UserConnectionKind,
  UserConnectionPage,
  UserConnectionQuery,
  UserFollowResult,
  UserProfile,
  UserProfileDetails,
  UserSearchPage,
  UserSearchQuery,
  UserSearchResult,
  UpdateUserFollowInput,
  UpdateUserProfileInput
} from "@linespace/api-client";

const publicUserSelect =
  "id,linespace_id,handle,display_name,avatar_url,avatar_color,bio,level,created_at,updated_at";

type ProfileChanges = Omit<UpdateUserProfileInput, "userId">;

type UserRow = {
  id: string;
  linespace_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  level: number;
  created_at: string;
  updated_at: string;
};

type StatsRow = {
  user_id: string;
  followers_count: number;
  following_count: number;
  likes_received_count: number;
  saves_received_count: number;
  posts_count: number;
  comments_count: number;
  threads_count: number;
  saves_count: number;
};

type ExperienceRow = {
  user_id: string;
  creator_experience: number;
  reviewer_experience: number;
  total_experience: number;
  level: number;
};

type VisibilityRow = {
  user_id: string;
  posts_public: boolean;
  threads_public: boolean;
  comments_public: boolean;
  saves_public: boolean;
};

type BadgeRow = {
  id: string;
  label: string;
  symbol: string | null;
  tone: "neutral" | "warm";
};

type UserBadgeRow = {
  badge_id: string;
  display_order: number;
};

type SearchRow = UserRow & {
  sort_rank: number;
  sort_handle: string;
  is_friend: boolean;
  has_recent_chat: boolean;
  has_more: boolean;
};

type ConnectionRow = UserRow & {
  is_following: boolean;
  follows_you: boolean;
  is_friend: boolean;
  sort_created_at: string;
  total_count: number;
  has_more: boolean;
};

type InboxParticipantRow = {
  sender_user_id: string;
  recipient_user_id: string;
  created_at: string;
};

type FollowRow = {
  follower_user_id: string;
  following_user_id: string;
};

type SearchCursor = {
  query: string;
  rank: number;
  handle: string;
  id: string;
};

type ConnectionCursor = {
  createdAt: string;
  userId: string;
};

export type RecentContactsPagination = {
  limit?: number;
  cursor?: string;
};

export type ProfileRepositoryErrorCode =
  | "PROFILE_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_PROFILE"
  | "INVALID_CURSOR"
  | "USER_DOMAIN_UNAVAILABLE"
  | "USER_DOMAIN_CONFLICT";

export class ProfileRepositoryError extends Error {
  constructor(
    readonly code: ProfileRepositoryErrorCode,
    readonly status: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "ProfileRepositoryError";
  }
}

export interface ProfileRepository {
  getProfile(userId: string): Promise<UserProfileDetails | null>;
  updateProfile(
    actorUserId: string,
    targetUserId: string,
    changes: ProfileChanges
  ): Promise<UserProfileDetails>;
  searchUsers(
    actorUserId: string,
    query: string,
    options?: UserSearchQuery
  ): Promise<UserSearchPage>;
  listConnections(
    actorUserId: string,
    targetUserId: string,
    kind: UserConnectionKind,
    query?: UserConnectionQuery
  ): Promise<UserConnectionPage>;
  listRecentContacts(
    actorUserId: string,
    pagination?: RecentContactsPagination
  ): Promise<UserSearchResult[]>;
  setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult>;
}

export function createProfileRepositoryForRequest(
  authorization?: string
): ProfileRepository | null {
  const url = process.env.SUPABASE_URL;
  const publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !publicKey) return null;

  const accessToken = extractOptionalBearerToken(authorization);
  const clientOptions = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {})
  };

  // This client is created per API request. It is never stored globally and
  // never receives a Service Role key.
  return createSupabaseProfileRepository(
    createClient(url, publicKey, clientOptions)
  );
}

export function createSupabaseProfileRepository(
  client: SupabaseClient
): ProfileRepository {
  return new SupabaseProfileRepository(client);
}

class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getProfile(userId: string): Promise<UserProfileDetails | null> {
    const userResult = await this.client
      .from("users")
      .select(publicUserSelect)
      .eq("id", userId)
      .maybeSingle();
    ensureDatabaseResult(userResult.error);
    if (!userResult.data) return null;

    const user = userResult.data as UserRow;
    const [statsResult, visibilityResult, badgeRowsResult, experienceResult] = await Promise.all([
      this.client
        .from("user_profile_stats")
        .select(
          "user_id,followers_count,following_count,likes_received_count,saves_received_count,posts_count,comments_count,threads_count,saves_count"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      this.client
        .from("user_profile_visibility")
        .select("user_id,posts_public,threads_public,comments_public,saves_public")
        .eq("user_id", userId)
        .maybeSingle(),
      this.client
        .from("user_badges")
        .select("badge_id,display_order")
        .eq("user_id", userId)
        .order("display_order", { ascending: true }),
      this.client
        .from("user_experience")
        .select("user_id,creator_experience,reviewer_experience,total_experience,level")
        .eq("user_id", userId)
        .maybeSingle()
    ]);
    ensureDatabaseResult(statsResult.error);
    ensureDatabaseResult(visibilityResult.error);
    ensureDatabaseResult(badgeRowsResult.error);
    ensureDatabaseResult(experienceResult.error);

    const badgeRows = (badgeRowsResult.data as UserBadgeRow[] | null) ?? [];
    const badgeIds = badgeRows.map((row) => row.badge_id);
    const badgesResult =
      badgeIds.length > 0
        ? await this.client
            .from("badges")
            .select("id,label,symbol,tone")
            .in("id", badgeIds)
        : { data: [], error: null };
    ensureDatabaseResult(badgesResult.error);

    const badgesById = new Map(
      ((badgesResult.data as BadgeRow[] | null) ?? []).map((badge) => [badge.id, badge])
    );
    const badges = badgeRows
      .map((row) => badgesById.get(row.badge_id))
      .filter((badge): badge is BadgeRow => Boolean(badge))
      .map((badge) => ({
        id: badge.id,
        label: badge.label,
        ...(badge.symbol ? { symbol: badge.symbol } : {}),
        tone: badge.tone
      }));

    return toProfileDetails(
      user,
      (statsResult.data as StatsRow | null) ?? emptyStats(userId),
      (visibilityResult.data as VisibilityRow | null) ?? emptyVisibility(userId),
      badges,
      (experienceResult.data as ExperienceRow | null) ?? emptyExperienceRow(userId)
    );
  }

  async updateProfile(
    actorUserId: string,
    targetUserId: string,
    changes: ProfileChanges
  ): Promise<UserProfileDetails> {
    if (actorUserId !== targetUserId) {
      throw new ProfileRepositoryError(
        "FORBIDDEN",
        403,
        "This resource belongs to another user."
      );
    }

    validateProfileChanges(changes);
    const existing = await this.getProfile(targetUserId);
    if (!existing) {
      throw new ProfileRepositoryError(
        "PROFILE_NOT_FOUND",
        404,
        "The requested user profile was not found."
      );
    }

    const result = await this.client.rpc("update_my_profile", {
      p_display_name: changes.displayName?.trim() ?? null,
      p_avatar_url: changes.avatarUrl?.trim() ?? null,
      p_avatar_color: changes.avatarColor?.trim() ?? null,
      p_bio: changes.bio?.trim() ?? null,
      p_visibility:
        changes.visibility && Object.keys(changes.visibility).length > 0
          ? changes.visibility
          : null
    });
    ensureDatabaseResult(result.error);

    const updated = await this.getProfile(targetUserId);
    if (!updated) {
      throw new ProfileRepositoryError(
        "PROFILE_NOT_FOUND",
        404,
        "The requested user profile was not found."
      );
    }
    return updated;
  }

  async searchUsers(
    actorUserId: string,
    query: string,
    options: UserSearchQuery = {}
  ): Promise<UserSearchPage> {
    const normalized = normalizeSearchQuery(query);
    const limit = clampLimit(options.limit);
    const cursor = decodeSearchCursor(options.cursor, normalized);
    const resultRows = normalized
      ? await this.runSearchRpc(normalized, Math.min(50, limit + 16), cursor)
      : [];
    const discoveryRows = await this.runSearchRpc("", 50, undefined);
    const recent = await this.listRecentContacts(actorUserId, { limit: 8 });
    const recentIds = new Set(recent.map((item) => item.id));
    const friends = dedupeUsers(
      discoveryRows
        .filter((row) => row.is_friend)
        .map((row) => toSearchResult(row))
    )
      .filter((item) => !recentIds.has(item.id))
      .slice(0, 8);
    const reservedIds = new Set([
      ...recentIds,
      ...friends.map((item) => item.id)
    ]);
    const pageRows = resultRows
      .slice(0, limit + reservedIds.size)
      .filter((row) => !reservedIds.has(row.id))
      .slice(0, limit);
    const lastRow = pageRows.at(-1);
    const hasMore = resultRows[0]?.has_more ?? false;

    return {
      query,
      recent,
      friends,
      results: pageRows.map((row) => toSearchResult(row)),
      nextCursor:
        hasMore && lastRow
          ? encodeSearchCursor({
              query: normalized,
              rank: lastRow.sort_rank,
              handle: lastRow.sort_handle,
              id: lastRow.id
            })
          : null
    };
  }

  async listConnections(
    actorUserId: string,
    targetUserId: string,
    kind: UserConnectionKind,
    query: UserConnectionQuery = {}
  ): Promise<UserConnectionPage> {
    const limit = clampLimit(query.limit);
    const cursor = decodeConnectionCursor(query.cursor);
    const result = await this.client.rpc("list_public_connections", {
      p_target_user_id: targetUserId,
      p_kind: kind,
      p_limit: limit,
      p_after_created_at: cursor?.createdAt ?? null,
      p_after_user_id: cursor?.userId ?? null
    });
    ensureDatabaseResult(result.error);

    const rows = (result.data as ConnectionRow[] | null) ?? [];
    const pageRows = rows.slice(0, limit);
    const lastRow = pageRows.at(-1);
    const hasMore = rows[0]?.has_more ?? false;
    return {
      userId: targetUserId,
      kind,
      total: countValue(rows[0]?.total_count),
      items: pageRows.map((row) => ({
        ...toUserProfile(row),
        isFollowing: row.is_following,
        followsYou: row.follows_you,
        isFriend: row.is_friend
      })),
      ...(hasMore && lastRow
        ? {
            nextCursor: encodeConnectionCursor({
              createdAt: lastRow.sort_created_at,
              userId: lastRow.id
            })
          }
        : {})
    };
  }

  async listRecentContacts(
    actorUserId: string,
    pagination: RecentContactsPagination = {}
  ): Promise<UserSearchResult[]> {
    const limit = clampLimit(pagination.limit ?? 8);
    const after = decodeRecentContactsCursor(pagination.cursor);
    const sentQuery = this.client
        .from("inbox_messages")
        .select("sender_user_id,recipient_user_id,created_at")
        .eq("sender_user_id", actorUserId)
        .order("created_at", { ascending: false })
        .limit(Math.min(50, limit * 4));
    const receivedQuery = this.client
        .from("inbox_messages")
        .select("sender_user_id,recipient_user_id,created_at")
        .eq("recipient_user_id", actorUserId)
        .order("created_at", { ascending: false })
        .limit(Math.min(50, limit * 4));
    const [sentResult, receivedResult] = await Promise.all([
      after ? sentQuery.lt("created_at", after) : sentQuery,
      after ? receivedQuery.lt("created_at", after) : receivedQuery
    ]);
    ensureDatabaseResult(sentResult.error);
    ensureDatabaseResult(receivedResult.error);

    const participantOrder = new Map<string, string>();
    for (const row of [
      ...((sentResult.data as InboxParticipantRow[] | null) ?? []),
      ...((receivedResult.data as InboxParticipantRow[] | null) ?? [])
    ]) {
      const participant =
        row.sender_user_id === actorUserId ? row.recipient_user_id : row.sender_user_id;
      const previous = participantOrder.get(participant);
      if (!previous || Date.parse(row.created_at) > Date.parse(previous)) {
        participantOrder.set(participant, row.created_at);
      }
    }

    const ids = [...participantOrder.entries()]
      .sort((left, right) => Date.parse(right[1]) - Date.parse(left[1]))
      .slice(0, limit)
      .map(([id]) => id);
    if (ids.length === 0) return [];

    const [profilesResult, outgoingResult, incomingResult] = await Promise.all([
      this.client.from("users").select(publicUserSelect).in("id", ids),
      this.client
        .from("user_follows")
        .select("follower_user_id,following_user_id")
        .eq("follower_user_id", actorUserId)
        .in("following_user_id", ids),
      this.client
        .from("user_follows")
        .select("follower_user_id,following_user_id")
        .eq("following_user_id", actorUserId)
        .in("follower_user_id", ids)
    ]);
    ensureDatabaseResult(profilesResult.error);
    ensureDatabaseResult(outgoingResult.error);
    ensureDatabaseResult(incomingResult.error);

    const outgoing = new Set(
      ((outgoingResult.data as FollowRow[] | null) ?? []).map((row) => row.following_user_id)
    );
    const incoming = new Set(
      ((incomingResult.data as FollowRow[] | null) ?? []).map((row) => row.follower_user_id)
    );
    const profiles = new Map(
      ((profilesResult.data as UserRow[] | null) ?? []).map((row) => [row.id, row])
    );
    return ids
      .map((id) => profiles.get(id))
      .filter((row): row is UserRow => Boolean(row))
      .map((row) => ({
        ...toUserProfile(row),
        isFriend: outgoing.has(row.id) && incoming.has(row.id),
        hasRecentChat: true
      }));
  }

  async setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult> {
    if (input.userId === input.targetUserId) {
      throw new ProfileRepositoryError(
        "INVALID_PROFILE",
        400,
        "You cannot follow yourself."
      );
    }

    const target = await this.getProfile(input.targetUserId);
    if (!target) {
      throw new ProfileRepositoryError(
        "PROFILE_NOT_FOUND",
        404,
        "The requested user profile was not found."
      );
    }

    if (input.isActive) {
      const result = await this.client.from("user_follows").insert({
        follower_user_id: input.userId,
        following_user_id: input.targetUserId
      });
      if (result.error && result.error.code !== "23505") {
        ensureDatabaseResult(result.error);
      }
    } else {
      const result = await this.client
        .from("user_follows")
        .delete()
        .eq("follower_user_id", input.userId)
        .eq("following_user_id", input.targetUserId);
      ensureDatabaseResult(result.error);
    }

    const [outgoingResult, incomingResult, actorProfile, targetProfile] = await Promise.all([
      this.client
        .from("user_follows")
        .select("follower_user_id,following_user_id")
        .eq("follower_user_id", input.userId)
        .eq("following_user_id", input.targetUserId)
        .maybeSingle(),
      this.client
        .from("user_follows")
        .select("follower_user_id,following_user_id")
        .eq("follower_user_id", input.targetUserId)
        .eq("following_user_id", input.userId)
        .maybeSingle(),
      this.getProfile(input.userId),
      this.getProfile(input.targetUserId)
    ]);
    ensureDatabaseResult(outgoingResult.error);
    ensureDatabaseResult(incomingResult.error);
    if (!actorProfile || !targetProfile) {
      throw new ProfileRepositoryError(
        "PROFILE_NOT_FOUND",
        404,
        "The requested user profile was not found."
      );
    }

    const isFollowing = Boolean(outgoingResult.data);
    const followsYou = Boolean(incomingResult.data);
    return {
      targetUserId: input.targetUserId,
      isFollowing,
      followsYou,
      isFriend: isFollowing && followsYou,
      followers: targetProfile.stats.followers,
      following: actorProfile.stats.following
    };
  }

  private async runSearchRpc(
    query: string,
    limit: number,
    cursor: SearchCursor | undefined
  ): Promise<SearchRow[]> {
    const result = await this.client.rpc("search_public_users", {
      p_query: query,
      p_limit: limit,
      p_after_rank: cursor?.rank ?? null,
      p_after_handle: cursor?.handle ?? null,
      p_after_id: cursor?.id ?? null
    });
    ensureDatabaseResult(result.error);
    return (result.data as SearchRow[] | null) ?? [];
  }
}

function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    ...(row.bio ? { bio: row.bio } : {})
  };
}

function toProfileDetails(
  row: UserRow,
  stats: StatsRow,
  visibility: VisibilityRow,
  badges: UserProfileDetails["badges"],
  experience: ExperienceRow
): UserProfileDetails {
  const level = countValue(experience.level);
  return {
    ...toUserProfile(row),
    linespaceId: row.linespace_id,
    level,
    experience: {
      creator: countValue(experience.creator_experience),
      reviewer: countValue(experience.reviewer_experience),
      total: countValue(experience.total_experience),
      level,
      levelProgress:
        countValue(experience.total_experience) >= 100
          ? 1
          : (countValue(experience.total_experience) % 10) / 10,
      nextLevelAt:
        countValue(experience.total_experience) >= 100
          ? null
          : (level + 1) * 10
    },
    badges,
    stats: {
      followers: countValue(stats.followers_count),
      following: countValue(stats.following_count),
      likesAndSaves:
        countValue(stats.likes_received_count) + countValue(stats.saves_received_count)
    },
    contentCounts: {
      posts: countValue(stats.posts_count),
      threads: countValue(stats.threads_count),
      comments: countValue(stats.comments_count),
      saves: countValue(stats.saves_count)
    },
    visibility: {
      posts: visibility.posts_public,
      threads: visibility.threads_public,
      comments: visibility.comments_public,
      saves: visibility.saves_public
    }
  };
}

function toSearchResult(row: SearchRow): UserSearchResult {
  return {
    ...toUserProfile(row),
    isFriend: row.is_friend,
    hasRecentChat: row.has_recent_chat
  };
}

function emptyStats(userId: string): StatsRow {
  return {
    user_id: userId,
    followers_count: 0,
    following_count: 0,
    likes_received_count: 0,
    saves_received_count: 0,
    posts_count: 0,
    comments_count: 0,
    threads_count: 0,
    saves_count: 0
  };
}

function emptyVisibility(userId: string): VisibilityRow {
  return {
    user_id: userId,
    posts_public: true,
    threads_public: true,
    comments_public: true,
    saves_public: true
  };
}

function emptyExperienceRow(userId: string): ExperienceRow {
  return {
    user_id: userId,
    creator_experience: 0,
    reviewer_experience: 0,
    total_experience: 0,
    level: 0
  };
}

function countValue(value: number | string | bigint | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function dedupeUsers(items: UserSearchResult[]): UserSearchResult[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function validateProfileChanges(changes: ProfileChanges) {
  if (
    changes.displayName !== undefined &&
    (changes.displayName.trim().length === 0 || changes.displayName.trim().length > 120)
  ) {
    throw new ProfileRepositoryError(
      "INVALID_PROFILE",
      400,
      "displayName must contain 1 to 120 characters."
    );
  }
  if (changes.bio !== undefined && changes.bio.trim().length > 280) {
    throw new ProfileRepositoryError(
      "INVALID_PROFILE",
      400,
      "bio cannot exceed 280 characters."
    );
  }
  if (changes.avatarUrl !== undefined && changes.avatarUrl.trim().length === 0) {
    throw new ProfileRepositoryError(
      "INVALID_PROFILE",
      400,
      "avatarUrl must be a non-empty string."
    );
  }
  if (
    changes.avatarColor !== undefined &&
    !/^#[0-9a-f]{6,8}$/i.test(changes.avatarColor.trim())
  ) {
    throw new ProfileRepositoryError(
      "INVALID_PROFILE",
      400,
      "avatarColor must be a hexadecimal color."
    );
  }
  if (changes.visibility) {
    const values = Object.values(changes.visibility);
    if (values.some((value) => typeof value !== "boolean")) {
      throw new ProfileRepositoryError(
        "INVALID_PROFILE",
        400,
        "visibility values must be boolean."
      );
    }
  }
}

function normalizeSearchQuery(query: string): string {
  return query.normalize("NFKC").trim().toLocaleLowerCase("en-US").slice(0, 64);
}

function clampLimit(value: number | undefined): number {
  return Number.isInteger(value) ? Math.min(50, Math.max(1, value as number)) : 20;
}

function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeSearchCursor(value: string | undefined, query: string): SearchCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SearchCursor>;
    if (
      parsed.query !== query ||
      typeof parsed.rank !== "number" ||
      typeof parsed.handle !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("invalid cursor");
    }
    return { query, rank: parsed.rank, handle: parsed.handle, id: parsed.id };
  } catch {
    throw new ProfileRepositoryError(
      "INVALID_CURSOR",
      400,
      "The search cursor is invalid."
    );
  }
}

function encodeConnectionCursor(cursor: ConnectionCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeConnectionCursor(value: string | undefined): ConnectionCursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as Partial<ConnectionCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.userId !== "string") {
      throw new Error("invalid cursor");
    }
    return { createdAt: parsed.createdAt, userId: parsed.userId };
  } catch {
    throw new ProfileRepositoryError(
      "INVALID_CURSOR",
      400,
      "The connection cursor is invalid."
    );
  }
}

function decodeRecentContactsCursor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new ProfileRepositoryError(
      "INVALID_CURSOR",
      400,
      "The recent-contact cursor is invalid."
    );
  }
  return timestamp.toISOString();
}

function extractOptionalBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || undefined;
}

function ensureDatabaseResult(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (error.code === "42501" || error.code === "PGRST301") {
    throw new ProfileRepositoryError(
      "FORBIDDEN",
      403,
      "You are not allowed to access this user data."
    );
  }
  if (error.code === "23505") {
    throw new ProfileRepositoryError(
      "USER_DOMAIN_CONFLICT",
      409,
      "This user relationship already exists."
    );
  }
  throw new ProfileRepositoryError(
    "USER_DOMAIN_UNAVAILABLE",
    503,
    "User data is temporarily unavailable."
  );
}
