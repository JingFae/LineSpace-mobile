import type {
  FeedQuery,
  InboxConversationMessage,
  PoemComment,
  PoemCommentEngagementResult,
  PoemDraftMedia,
  PoemEngagementResult,
  PoemLayoutConfig,
  PoemSummary,
  SharePoemInput,
  SharePoemResult,
  UpdateCommentCollectionInput,
  UpdatePoemCollectionInput,
  UserPoemCollections
} from "@linespace/api-client";
import type { DatabaseClient } from "./repository-support.js";
import {
  arrayOfStrings,
  countValue,
  dateLabel,
  ensureDatabaseResult,
  getCurrentLinespaceUserId,
  loadProfiles,
  objectValue,
  toUserProfile,
  type UserRow
} from "./repository-support.js";

type PostRow = {
  id: string;
  author_user_id: string;
  title: string;
  body: string;
  tags: string[] | null;
  mentions: string[] | null;
  artwork_url: string | null;
  media: unknown;
  layout: unknown;
  visibility: "public" | "include" | "exclude";
  audience_user_ids: string[] | null;
  status: "draft" | "published";
  declare_original: boolean;
  allow_comments: boolean;
  allow_sharing: boolean;
  allow_save: boolean;
  started_at: string;
  edited_at: string;
  comments_count: number;
  likes_count: number;
  shares_count: number;
  saves_count: number;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  likes_count: number;
  saves_count: number;
};

type EngagementRow = {
  post_id?: string;
  comment_id?: string;
  kind?: "liked" | "saved";
};

const postSelect =
  "id,author_user_id,title,body,tags,mentions,artwork_url,media,layout,visibility,audience_user_ids,status,declare_original,allow_comments,allow_sharing,allow_save,started_at,edited_at,comments_count,likes_count,shares_count,saves_count";

export class PostRepository {
  constructor(private readonly client: DatabaseClient) {}

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    let request = this.client
      .from("posts")
      .select(postSelect)
      .eq("status", "published")
      .limit(100);

    request = query.section === "popular"
      ? request
          .order("likes_count", { ascending: false })
          .order("started_at", { ascending: false })
          .order("id", { ascending: false })
      : request
          .order("started_at", { ascending: false })
          .order("id", { ascending: false });

    if (query.section === "following") {
      if (!actorId) return [];
      const followResult = await this.client
        .from("user_follows")
        .select("following_user_id")
        .eq("follower_user_id", actorId);
      ensureDatabaseResult(followResult.error);
      const ids = ((followResult.data as Array<{ following_user_id: string }> | null) ?? [])
        .map((row) => row.following_user_id);
      if (ids.length === 0) return [];
      request = request.in("author_user_id", ids);
    }

    const result = await request;
    ensureDatabaseResult(result.error);
    let rows = ((result.data as PostRow[] | null) ?? []);

    if (query.filter === "most-contributed") {
      rows = rows.sort(
        (left, right) =>
          right.comments_count + right.likes_count -
          (left.comments_count + left.likes_count)
      );
    } else if (query.filter === "growing") {
      rows = rows.filter((row) => row.status === "published");
    } else if (query.filter === "final") {
      rows = rows.filter((row) => row.status === "published");
    }

    return this.mapSummaries(rows, actorId);
  }

  async getPoem(id: string): Promise<PoemSummary | null> {
    const result = await this.client
      .from("posts")
      .select(postSelect)
      .eq("id", id)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) return null;
    const summaries = await this.mapSummaries([result.data as PostRow], await getCurrentLinespaceUserId(this.client));
    const summary = summaries[0];
    if (!summary) return null;
    summary.comments = await this.listComments(id);
    return summary;
  }

  async createPoemComment(input: {
    poemId: string;
    userId: string;
    body: string;
    parentCommentId?: string;
  }): Promise<PoemComment> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) {
      throw new Error("comment actor mismatch");
    }
    const result = await this.client
      .from("post_comments")
      .insert({
        id: crypto.randomUUID(),
        post_id: input.poemId,
        author_user_id: actorId,
        body: input.body.trim(),
        parent_comment_id: input.parentCommentId ?? null
      })
      .select(
        "id,post_id,author_user_id,parent_comment_id,body,created_at,edited_at,likes_count,saves_count"
      )
      .single();
    ensureDatabaseResult(result.error);
    return this.mapComment(result.data as CommentRow, actorId);
  }

  async setCommentCollection(
    input: UpdateCommentCollectionInput
  ): Promise<PoemCommentEngagementResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) {
      throw new Error("comment actor mismatch");
    }
    const kind = input.collection === "liked" ? "liked" : "saved";
    if (input.isActive) {
      const result = await this.client.from("post_comment_engagements").upsert(
        {
          user_id: actorId,
          comment_id: input.commentId,
          kind
        },
        { onConflict: "user_id,comment_id,kind", ignoreDuplicates: true }
      );
      ensureDatabaseResult(result.error);
    } else {
      const result = await this.client
        .from("post_comment_engagements")
        .delete()
        .eq("user_id", actorId)
        .eq("comment_id", input.commentId)
        .eq("kind", kind);
      ensureDatabaseResult(result.error);
    }

    const commentResult = await this.client
      .from("post_comments")
      .select(
        "id,post_id,author_user_id,parent_comment_id,body,created_at,edited_at,likes_count,saves_count"
      )
      .eq("id", input.commentId)
      .maybeSingle();
    ensureDatabaseResult(commentResult.error);
    if (!commentResult.data) throw new Error("comment not found");
    const comment = await this.mapComment(commentResult.data as CommentRow, actorId);
    const poem = await this.getPoem(input.poemId);
    if (!poem) throw new Error("post not found");
    return { poem, comment };
  }

  async setPoemCollection(
    input: UpdatePoemCollectionInput
  ): Promise<PoemEngagementResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) {
      throw new Error("post actor mismatch");
    }
    const table = input.collection === "liked" ? "post_likes" : "post_saves";
    if (input.isActive) {
      const result = await this.client
        .from(table)
        .upsert(
          { user_id: actorId, post_id: input.poemId },
          { onConflict: "post_id,user_id", ignoreDuplicates: true }
        );
      ensureDatabaseResult(result.error);
    } else {
      const result = await this.client
        .from(table)
        .delete()
        .eq("user_id", actorId)
        .eq("post_id", input.poemId);
      ensureDatabaseResult(result.error);
    }
    const poem = await this.getPoem(input.poemId);
    if (!poem) throw new Error("post not found");
    return {
      poem,
      collections: await this.getUserPoemCollections(actorId)
    };
  }

  async getUserPoemCollections(userId: string): Promise<UserPoemCollections> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== userId) throw new Error("collection actor mismatch");
    const [likedResult, savedResult] = await Promise.all([
      this.client.from("post_likes").select("post_id").eq("user_id", actorId),
      this.client.from("post_saves").select("post_id").eq("user_id", actorId)
    ]);
    ensureDatabaseResult(likedResult.error);
    ensureDatabaseResult(savedResult.error);
    return {
      userId: actorId,
      likedPoemIds: ((likedResult.data as Array<{ post_id: string }> | null) ?? []).map(
        (row) => row.post_id
      ),
      savedPoemIds: ((savedResult.data as Array<{ post_id: string }> | null) ?? []).map(
        (row) => row.post_id
      )
    };
  }

  async sharePoem(input: SharePoemInput): Promise<SharePoemResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.senderId) throw new Error("share actor mismatch");
    const result = await this.client.rpc("share_post_to_inbox", {
      p_post_id: input.poemId,
      p_recipient_user_ids: [...new Set(input.recipientIds)],
      p_note: input.note ?? null
    });
    ensureDatabaseResult(result.error);
    const messages = await this.mapInboxMessages(
      (result.data as InboxRow[] | null) ?? [],
      actorId
    );
    return {
      poemId: input.poemId,
      recipientIds: input.recipientIds,
      messages
    };
  }

  async listComments(postId: string): Promise<PoemComment[]> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    const result = await this.client
      .from("post_comments")
      .select(
        "id,post_id,author_user_id,parent_comment_id,body,created_at,edited_at,likes_count,saves_count"
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    ensureDatabaseResult(result.error);
    return Promise.all(
      ((result.data as CommentRow[] | null) ?? []).map((row) =>
        this.mapComment(row, actorId)
      )
    );
  }

  async listProfilePosts(userId: string): Promise<PoemSummary[]> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    const result = await this.client
      .from("posts")
      .select(postSelect)
      .eq("author_user_id", userId)
      .eq("status", "published")
      .order("started_at", { ascending: false })
      .limit(50);
    ensureDatabaseResult(result.error);
    return this.mapSummaries((result.data as PostRow[] | null) ?? [], actorId);
  }

  private async mapSummaries(
    rows: PostRow[],
    actorId: string | null
  ): Promise<PoemSummary[]> {
    const profiles = await loadProfiles(
      this.client,
      rows.map((row) => row.author_user_id)
    );
    const viewer = await this.loadPostViewer(rows.map((row) => row.id), actorId);
    return rows
      .map((row) => {
        const author = profiles.get(row.author_user_id);
        if (!author) return null;
        return toPoemSummary(row, author, viewer.liked.has(row.id), viewer.saved.has(row.id));
      })
      .filter((item): item is PoemSummary => Boolean(item));
  }

  private async mapComment(row: CommentRow, actorId: string | null): Promise<PoemComment> {
    const profileResult = await this.client
      .from("users")
      .select("id,linespace_id,handle,display_name,avatar_url,avatar_color,bio,level")
      .eq("id", row.author_user_id)
      .maybeSingle();
    ensureDatabaseResult(profileResult.error);
    const profileRow = profileResult.data as (UserRow & { level?: number }) | null;
    if (!profileRow) throw new Error("comment author not found");
    const engagement = actorId
      ? await this.client
          .from("post_comment_engagements")
          .select("kind")
          .eq("user_id", actorId)
          .eq("comment_id", row.id)
      : { data: [], error: null };
    ensureDatabaseResult(engagement.error);
    const kinds = new Set(
      ((engagement.data as Array<{ kind: string }> | null) ?? []).map((item) => item.kind)
    );
    return {
      id: row.id,
      author: toUserProfile(profileRow),
      dateLabel: dateLabel(row.created_at),
      body: row.body,
      createdAt: row.created_at,
      ...(row.parent_comment_id ? { parentCommentId: row.parent_comment_id } : {}),
      likes: countValue(row.likes_count),
      level: countValue(profileRow.level),
      viewer: {
        liked: kinds.has("liked"),
        saved: kinds.has("saved")
      }
    };
  }

  private async loadPostViewer(
    postIds: string[],
    actorId: string | null
  ): Promise<{ liked: Set<string>; saved: Set<string> }> {
    if (!actorId || postIds.length === 0) {
      return { liked: new Set(), saved: new Set() };
    }
    const [likedResult, savedResult] = await Promise.all([
      this.client.from("post_likes").select("post_id").eq("user_id", actorId).in("post_id", postIds),
      this.client.from("post_saves").select("post_id").eq("user_id", actorId).in("post_id", postIds)
    ]);
    ensureDatabaseResult(likedResult.error);
    ensureDatabaseResult(savedResult.error);
    return {
      liked: new Set(
        ((likedResult.data as Array<{ post_id: string }> | null) ?? []).map(
          (row) => row.post_id
        )
      ),
      saved: new Set(
        ((savedResult.data as Array<{ post_id: string }> | null) ?? []).map(
          (row) => row.post_id
        )
      )
    };
  }

  private async mapInboxMessages(
    rows: InboxRow[],
    actorId: string
  ): Promise<InboxConversationMessage[]> {
    const profileIds = rows.flatMap((row) => [row.sender_user_id, row.recipient_user_id]);
    const profiles = await loadProfiles(this.client, profileIds);
    const posts = await this.loadSharedPosts(rows);
    return rows.map((row) => ({
      id: row.id,
      sender: profiles.get(row.sender_user_id) ?? {
        id: row.sender_user_id,
        handle: "unknown",
        displayName: "Unknown",
        avatarColor: "#DCD8D3"
      },
      ...(row.recipient_user_id
        ? { recipient: profiles.get(row.recipient_user_id) }
        : {}),
      createdAt: row.created_at,
      kind: row.kind,
      ...(row.text_body ? { text: row.text_body } : {}),
      ...(row.kind === "shared-post" && row.post_id
        ? { sharedPost: posts.get(row.post_id) }
        : {}),
      ...(row.kind === "shared-thread" || row.kind === "shared-continuation"
        ? {
            sharedThread: {
              threadId: row.thread_id ?? "",
              ...(row.continuation_id ? { continuationId: row.continuation_id } : {}),
              title: row.excerpt ?? "Shared thread",
              excerpt: row.excerpt ?? "",
              ...(row.line_number ? { lineNumber: row.line_number } : {}),
              author:
                profiles.get(row.sender_user_id) ?? {
                  id: row.sender_user_id,
                  handle: "unknown",
                  displayName: "Unknown",
                  avatarColor: "#DCD8D3"
                }
            }
          }
        : {})
    }));
  }

  private async loadSharedPosts(
    rows: InboxRow[]
  ): Promise<Map<string, NonNullable<InboxConversationMessage["sharedPost"]>>> {
    const ids = rows
      .map((row) => row.post_id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return new Map();
    const result = await this.client
      .from("posts")
      .select(postSelect)
      .in("id", ids);
    ensureDatabaseResult(result.error);
    const postRows = (result.data as PostRow[] | null) ?? [];
    const profiles = await loadProfiles(
      this.client,
      postRows.map((row) => row.author_user_id)
    );
    return new Map(
      postRows.flatMap((row) => {
        const author = profiles.get(row.author_user_id);
        if (!author) return [];
        return [
          [
            row.id,
            {
              id: row.id,
              title: row.title,
              excerpt: row.body.slice(0, 160),
              tags: row.tags ?? [],
              author,
              ...(row.artwork_url ? { artworkUrl: row.artwork_url } : {})
            }
          ] as const
        ];
      })
    );
  }
}

type InboxRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  kind: "text" | "shared-post" | "shared-thread" | "shared-continuation";
  text_body: string | null;
  post_id: string | null;
  thread_id: string | null;
  continuation_id: string | null;
  excerpt: string | null;
  line_number: number | null;
  created_at: string;
};

function toPoemSummary(
  row: PostRow,
  author: ReturnType<typeof toUserProfile>,
  liked: boolean,
  saved: boolean
): PoemSummary {
  const media = toMedia(row.media);
  const layout = toLayout(row.layout);
  const background = layout?.backgroundId;
  return {
    id: row.id,
    title: row.title,
    lines: row.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    author,
    contributorsCount: 1,
    tags: row.tags ?? [],
    mentions: row.mentions ?? [],
    visibility: row.visibility,
    audienceUserIds: row.audience_user_ids ?? [],
    declareOriginal: row.declare_original,
    allowComments: row.allow_comments,
    allowSharing: row.allow_sharing,
    status: "final",
    startedAt: row.started_at,
    editedAt: row.edited_at,
    ...(row.artwork_url ? { artworkUrl: row.artwork_url } : {}),
    ...(media ? { media } : {}),
    ...(layout ? { layout } : {}),
    metrics: {
      comments: countValue(row.comments_count),
      likes: countValue(row.likes_count),
      shares: countValue(row.shares_count),
      contributions: 1,
      saves: countValue(row.saves_count)
    },
    viewer: { liked, saved },
    artworkTone:
      background === "midnight"
        ? "night"
        : background === "kraft-paper"
          ? "paper"
          : "water"
  };
}

function toMedia(value: unknown): PoemDraftMedia | undefined {
  const media = objectValue(value);
  if (
    typeof media.uri !== "string" ||
    (media.kind !== "image" && media.kind !== "video") ||
    typeof media.name !== "string"
  ) {
    return undefined;
  }
  return {
    uri: media.uri,
    kind: media.kind,
    name: media.name,
    ...(typeof media.width === "number" ? { width: media.width } : {}),
    ...(typeof media.height === "number" ? { height: media.height } : {}),
    ...(typeof media.mimeType === "string" ? { mimeType: media.mimeType } : {})
  };
}

function toLayout(value: unknown): PoemLayoutConfig | undefined {
  const layout = objectValue(value);
  const templateId = layout.templateId;
  const typographyId = layout.typographyId;
  const backgroundId = layout.backgroundId;
  if (
    templateId !== "quiet-letter" &&
    templateId !== "night-whisper" &&
    templateId !== "travel-postcard"
  ) {
    return undefined;
  }
  if (
    typographyId !== "literary-serif" &&
    typographyId !== "handwritten" &&
    typographyId !== "clean-sans"
  ) {
    return undefined;
  }
  if (
    backgroundId !== "letter-paper" &&
    backgroundId !== "kraft-paper" &&
    backgroundId !== "postcard" &&
    backgroundId !== "midnight"
  ) {
    return undefined;
  }
  const stickerIds = arrayOfStrings(layout.stickerIds).filter(
    (item): item is PoemLayoutConfig["stickerIds"][number] =>
      item === "botanical" || item === "moon" || item === "postmark"
  );
  return {
    templateId,
    typographyId,
    backgroundId,
    stickerIds
  };
}
