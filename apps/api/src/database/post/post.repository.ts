import type {
  ApplyCommunitySparkInput,
  ApplyCommunitySparkResult,
  UndoCommunitySparkInput,
  UndoCommunitySparkResult,
  DeletePoemInput,
  DeletePoemResult,
  FeedQuery,
  InboxConversationMessage,
  PoemComment,
  PoemCommentEngagementResult,
  PoemCreditPerson,
  PoemDraftMedia,
  PoemEngagementResult,
  PoemLayoutConfig,
  PoemSummary,
  SharePoemInput,
  SharePoemResult,
  UpdateCommentCollectionInput,
  UpdatePoemCollectionInput,
  UserProfileContentItem,
  UserPoemCollections
} from "@linespace/api-client";
import { getCurrentLinespaceUserId } from "../core/auth-context.js";
import type { DatabaseClient } from "../core/client.js";
import {
  DomainRepositoryError,
  ensureDatabaseResult
} from "../core/errors.js";
import {
  isRemoteAssetUrl,
  toFeedThumbnailUrl
} from "../core/public-assets.js";
import {
  loadProfiles,
  toUserProfile,
  type UserRow
} from "../core/user-mapper.js";
import {
  arrayOfStrings,
  countValue,
  dateLabel,
  objectValue
} from "../core/value-mappers.js";

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
  version_lines: unknown;
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

type CommentContributionRow = {
  post_id: string;
  contributor_user_id: string;
  created_at: string;
};

type ProfilePostRow = Pick<
  PostRow,
  | "id"
  | "title"
  | "body"
  | "tags"
  | "artwork_url"
  | "media"
  | "layout"
  | "started_at"
  | "likes_count"
>;

const postSelect =
  "id,author_user_id,title,body,tags,mentions,artwork_url,media,layout,version_lines,visibility,audience_user_ids,status,declare_original,allow_comments,allow_sharing,allow_save,started_at,edited_at,comments_count,likes_count,shares_count,saves_count";

export class PostRepository {
  constructor(private readonly client: DatabaseClient) {}

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    let request = this.client
      .from("posts")
      .select(postSelect)
      .eq("status", "published")
      .limit(limit);

    if (query.cursor) {
      const cursorResult = await this.client
        .from("posts")
        .select("id,started_at,likes_count")
        .eq("id", query.cursor)
        .maybeSingle();
      ensureDatabaseResult(cursorResult.error);
      const cursor = cursorResult.data as Pick<PostRow, "id" | "started_at" | "likes_count"> | null;
      if (!cursor) return [];
      request = query.section === "popular"
        ? request.or(
            `likes_count.lt.${cursor.likes_count},and(likes_count.eq.${cursor.likes_count},started_at.lt.${cursor.started_at}),and(likes_count.eq.${cursor.likes_count},started_at.eq.${cursor.started_at},id.lt.${cursor.id})`
          )
        : request.or(
            `started_at.lt.${cursor.started_at},and(started_at.eq.${cursor.started_at},id.lt.${cursor.id})`
          );
    }

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

    return this.mapSummaries(rows, actorId, { includeMediaThumbnail: true });
  }

  async getPoem(id: string): Promise<PoemSummary | null> {
    const result = await this.client
      .from("posts")
      .select(postSelect)
      .eq("id", id)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) return null;
    const actorId = await getCurrentLinespaceUserId(this.client);
    const [summaries, comments] = await Promise.all([
      this.mapSummaries([result.data as PostRow], actorId),
      this.listComments(id, actorId)
    ]);
    const summary = summaries[0];
    if (!summary) return null;
    summary.comments = comments;
    return summary;
  }

  async deletePoem(input: DeletePoemInput): Promise<DeletePoemResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) throw new Error("post actor mismatch");
    const result = await this.client.rpc("delete_my_post", { p_post_id: input.poemId });
    ensureDatabaseResult(result.error);
    if (result.data !== true) throw new Error("post not found or forbidden");
    return { poemId: input.poemId, deleted: true };
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

  async applyCommunitySpark(
    input: ApplyCommunitySparkInput
  ): Promise<ApplyCommunitySparkResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) {
      throw new Error("community spark actor mismatch");
    }
    const result = await this.client.rpc("apply_community_spark", {
      p_post_id: input.poemId,
      p_suggestion_id: input.suggestionId,
      p_base_revision: input.baseRevision,
      p_proposed_lines: input.proposedLines,
      p_source_comment_id: input.sourceCommentId ?? null
    });
    if (result.error) {
      console.error("Community Spark database application failed", {
        poemId: input.poemId,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint
      });
      if (result.error.code === "40001" || result.error.code === "55P03") {
        throw new DomainRepositoryError(
          "CONFLICT",
          409,
          /busy|lock/i.test(result.error.message)
            ? "This post is being updated. Please try the idea again."
            : "This idea was made for an older version. Refresh for new ideas."
        );
      }
      if (result.error.code === "22023" || result.error.code === "23514") {
        throw new DomainRepositoryError(
          "INVALID",
          400,
          "The selected suggestion cannot be applied."
        );
      }
    }
    ensureDatabaseResult(result.error);
    const transaction = objectValue(result.data);
    const poem = await this.getPoem(input.poemId);
    if (!poem) throw new Error("post not found");
    const replyCommentId =
      typeof transaction.replyCommentId === "string"
        ? transaction.replyCommentId
        : null;
    return {
      poem,
      reply: replyCommentId
        ? poem.comments?.find((comment) => comment.id === replyCommentId) ?? null
        : null
    };
  }

  async undoCommunitySpark(
    input: UndoCommunitySparkInput
  ): Promise<UndoCommunitySparkResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) {
      throw new Error("community spark actor mismatch");
    }
    const result = await this.client.rpc("undo_community_spark", {
      p_post_id: input.poemId,
      p_suggestion_id: input.suggestionId,
      p_applied_lines: input.appliedLines,
      p_previous_lines: input.previousLines
    });
    if (result.error) {
      console.error("Community Spark database undo failed", {
        poemId: input.poemId,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint
      });
      if (result.error.code === "40001" || result.error.code === "55P03") {
        throw new DomainRepositoryError(
          "CONFLICT",
          409,
          "This AI change can no longer be undone because the poem changed."
        );
      }
      if (result.error.code === "42501") {
        throw new DomainRepositoryError(
          "FORBIDDEN",
          403,
          "Only the post author can undo this AI change."
        );
      }
      if (result.error.code === "22023") {
        throw new DomainRepositoryError(
          "INVALID",
          400,
          "The selected AI change cannot be undone."
        );
      }
    }
    ensureDatabaseResult(result.error);
    const poem = await this.getPoem(input.poemId);
    if (!poem) throw new Error("post not found");
    return { poem };
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

  async listComments(
    postId: string,
    knownActorId?: string | null
  ): Promise<PoemComment[]> {
    const actorId =
      knownActorId === undefined
        ? await getCurrentLinespaceUserId(this.client)
        : knownActorId;
    const result = await this.client
      .from("post_comments")
      .select(
        "id,post_id,author_user_id,parent_comment_id,body,created_at,edited_at,likes_count,saves_count"
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    ensureDatabaseResult(result.error);
    return this.mapComments(
      (result.data as CommentRow[] | null) ?? [],
      actorId
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

  async listProfilePostContent(
    userId: string
  ): Promise<UserProfileContentItem[]> {
    const result = await this.client
      .from("posts")
      .select(
        "id,title,body,tags,artwork_url,media,layout,started_at,likes_count"
      )
      .eq("author_user_id", userId)
      .eq("status", "published")
      .order("started_at", { ascending: false })
      .limit(50);
    ensureDatabaseResult(result.error);
    return ((result.data as ProfilePostRow[] | null) ?? []).map((row) => {
      const media = toMedia(row.media);
      const layout = toLayout(row.layout);
      return {
        id: `profile-${row.id}`,
        kind: "post" as const,
        poemId: row.id,
        title: row.title,
        excerpt:
          row.body
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) ?? "",
        tags: row.tags ?? [],
        finishedAt: row.started_at,
        highlightCount: countValue(row.likes_count),
        ...(row.artwork_url ? { artworkUrl: row.artwork_url } : {}),
        ...(media ? { media } : {}),
        ...(layout ? { layout } : {}),
        artworkTone:
          layout?.backgroundId === "midnight"
            ? "night"
            : layout?.backgroundId === "kraft-paper"
              ? "paper"
              : "water"
      };
    });
  }

  async listPoemsByIds(ids: string[]): Promise<PoemSummary[]> {
    if (ids.length === 0) return [];
    const actorId = await getCurrentLinespaceUserId(this.client);
    const result = await this.client
      .from("posts")
      .select(postSelect)
      .in("id", [...new Set(ids)])
      .eq("status", "published");
    ensureDatabaseResult(result.error);
    const mapped = await this.mapSummaries((result.data as PostRow[] | null) ?? [], actorId);
    const byId = new Map(mapped.map((item) => [item.id, item]));
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }

  private async mapSummaries(
    rows: PostRow[],
    actorId: string | null,
    options: { includeMediaThumbnail?: boolean } = {}
  ): Promise<PoemSummary[]> {
    const contributions = await this.loadCommentContributions(rows.map((row) => row.id));
    const profiles = await loadProfiles(
      this.client,
      rows.flatMap((row) => [
        row.author_user_id,
        ...versionLineAuthorIds(row.version_lines),
        ...contributions
          .filter((contribution) => contribution.post_id === row.id)
          .map((contribution) => contribution.contributor_user_id)
      ])
    );
    const viewer = await this.loadPostViewer(rows.map((row) => row.id), actorId);
    return rows
      .map((row) => {
        const author = profiles.get(row.author_user_id);
        if (!author) return null;
        const commentContributors = [
          ...new Set(
            contributions
              .filter((contribution) => contribution.post_id === row.id)
              .map((contribution) => contribution.contributor_user_id)
          )
        ].flatMap((userId) => {
          const profile = profiles.get(userId);
          return profile ? [toPostCreditPerson(profile)] : [];
        });
        const quoteContributors = [
          ...new Set(
            versionLineAuthorIds(row.version_lines).filter(
              (userId) => userId !== row.author_user_id
            )
          )
        ].flatMap((userId) => {
          const profile = profiles.get(userId);
          return profile ? [toPostCreditPerson(profile)] : [];
        });
        return toPoemSummary(
          row,
          author,
          viewer.liked.has(row.id),
          viewer.saved.has(row.id),
          toVersionLines(row.version_lines, profiles),
          commentContributors,
          quoteContributors,
          options.includeMediaThumbnail === true
        );
      })
      .filter((item): item is PoemSummary => Boolean(item));
  }

  private async loadCommentContributions(
    postIds: string[]
  ): Promise<CommentContributionRow[]> {
    if (postIds.length === 0) return [];
    const result = await this.client
      .from("post_comment_contributions")
      .select("post_id,contributor_user_id,created_at")
      .in("post_id", [...new Set(postIds)])
      .order("created_at", { ascending: true });
    ensureDatabaseResult(result.error);
    return (result.data as CommentContributionRow[] | null) ?? [];
  }

  private async mapComment(row: CommentRow, actorId: string | null): Promise<PoemComment> {
    const comments = await this.mapComments([row], actorId);
    const comment = comments[0];
    if (!comment) throw new Error("comment author not found");
    return comment;
  }

  private async mapComments(
    rows: CommentRow[],
    actorId: string | null
  ): Promise<PoemComment[]> {
    if (rows.length === 0) return [];
    const commentIds = rows.map((row) => row.id);
    const authorIds = [...new Set(rows.map((row) => row.author_user_id))];
    const [profilesResult, engagementResult] = await Promise.all([
      this.client
        .from("users")
        .select(
          "id,linespace_id,handle,display_name,avatar_url,avatar_color,bio,level"
        )
        .in("id", authorIds),
      actorId
        ? this.client
            .from("post_comment_engagements")
            .select("comment_id,kind")
            .eq("user_id", actorId)
            .in("comment_id", commentIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    ensureDatabaseResult(profilesResult.error);
    ensureDatabaseResult(engagementResult.error);

    const profiles = new Map(
      (
        (profilesResult.data as Array<UserRow & { level?: number }> | null) ?? []
      ).map((profile) => [profile.id, profile] as const)
    );
    const engagementByComment = new Map<string, Set<string>>();
    for (const engagement of
      (engagementResult.data as Array<{
        comment_id: string;
        kind: string;
      }> | null) ?? []) {
      const kinds =
        engagementByComment.get(engagement.comment_id) ?? new Set<string>();
      kinds.add(engagement.kind);
      engagementByComment.set(engagement.comment_id, kinds);
    }

    return rows.map((row) => {
      const profile = profiles.get(row.author_user_id);
      if (!profile) throw new Error("comment author not found");
      const kinds = engagementByComment.get(row.id) ?? new Set<string>();
      return {
        id: row.id,
        author: toUserProfile(profile),
        dateLabel: dateLabel(row.created_at),
        body: row.body,
        createdAt: row.created_at,
        ...(row.parent_comment_id
          ? { parentCommentId: row.parent_comment_id }
          : {}),
        likes: countValue(row.likes_count),
        level: countValue(profile.level),
        viewer: {
          liked: kinds.has("liked"),
          saved: kinds.has("saved")
        }
      };
    });
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

function splitPoemBodyPreservingStanzas(value: string) {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  return normalized.split("\n").map((line) => line.trim());
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
  saved: boolean,
  versionLines?: PoemSummary["versionLines"],
  commentContributors: PoemCreditPerson[] = [],
  quoteContributors: PoemCreditPerson[] = [],
  includeMediaThumbnail = false
): PoemSummary {
  const media = toMedia(row.media, includeMediaThumbnail);
  const layout = toLayout(row.layout);
  const background = layout?.backgroundId;
  return {
    id: row.id,
    title: row.title,
    lines: splitPoemBodyPreservingStanzas(row.body),
    author,
    contributorsCount: new Set([
      author.handle,
      ...commentContributors.map((person) => person.handle),
      ...quoteContributors.map((person) => person.handle)
    ]).size,
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
    ...(isRemoteAssetUrl(row.artwork_url) ? { artworkUrl: row.artwork_url } : {}),
    ...(media ? { media } : {}),
    ...(layout ? { layout } : {}),
    ...(versionLines?.length ? { versionLines } : {}),
    metrics: {
      comments: countValue(row.comments_count),
      likes: countValue(row.likes_count),
      shares: countValue(row.shares_count),
      contributions: 1,
      saves: countValue(row.saves_count)
    },
    viewer: { liked, saved },
    credits: {
      // The full author (including avatar) already appears above. Omitting the
      // duplicate avatar here prevents the same image URL/data being serialized
      // twice in every feed card.
      startedBy: toPostCreditPerson(author, false),
      commentContributors,
      quoteContributors
    },
    artworkTone:
      background === "midnight"
        ? "night"
        : background === "kraft-paper"
          ? "paper"
          : "water"
  };
}

function toPostCreditPerson(
  profile: ReturnType<typeof toUserProfile>,
  includeAvatar = true
): PoemCreditPerson {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarColor: profile.avatarColor,
    ...(includeAvatar && profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {})
  };
}

function versionLineAuthorIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const authorId = objectValue(entry).authorId;
    return typeof authorId === "string" && authorId ? [authorId] : [];
  });
}

function toVersionLines(
  value: unknown,
  profiles: Map<string, ReturnType<typeof toUserProfile>>
): PoemSummary["versionLines"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const lines = value.flatMap((entry) => {
    const row = objectValue(entry);
    const authorId = row.authorId;
    const author = typeof authorId === "string" ? profiles.get(authorId) : undefined;
    if (typeof row.lineNumber !== "number" || typeof row.text !== "string" || !author) {
      return [];
    }
    return [{
      lineNumber: row.lineNumber,
      text: row.text,
      author,
      ...(typeof row.likes === "number" ? { likes: row.likes } : {}),
      ...(typeof row.originalText === "string"
        ? { originalText: row.originalText }
        : {}),
      ...(typeof row.aiChangeNote === "string"
        ? { aiChangeNote: row.aiChangeNote }
        : {}),
      ...(row.aiHarmonized === true ? { aiHarmonized: true } : {})
    }];
  });
  return lines.length ? lines : undefined;
}

function toMedia(
  value: unknown,
  includeThumbnail = false
): PoemDraftMedia | undefined {
  const media = objectValue(value);
  if (
    typeof media.uri !== "string" ||
    !isRemoteAssetUrl(media.uri) ||
    (media.kind !== "image" && media.kind !== "video") ||
    typeof media.name !== "string"
  ) {
    return undefined;
  }
  const thumbnailUri =
    includeThumbnail && media.kind === "image"
      ? toFeedThumbnailUrl(media.uri)
      : undefined;
  return {
    uri: media.uri,
    ...(thumbnailUri && thumbnailUri !== media.uri ? { thumbnailUri } : {}),
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
    templateId !== "travel-postcard" &&
    templateId !== "ink-archive" &&
    templateId !== "field-notes" &&
    templateId !== "soft-margin" &&
    templateId !== "museum-label"
  ) {
    return undefined;
  }
  if (
    typographyId !== "literary-serif" &&
    typographyId !== "handwritten" &&
    typographyId !== "clean-sans" &&
    typographyId !== "songti-editorial" &&
    typographyId !== "humanist-sans" &&
    typographyId !== "rounded-sans" &&
    typographyId !== "mono-notes"
  ) {
    return undefined;
  }
  if (
    backgroundId !== "letter-paper" &&
    backgroundId !== "kraft-paper" &&
    backgroundId !== "postcard" &&
    backgroundId !== "midnight" &&
    backgroundId !== "rice-paper" &&
    backgroundId !== "graph-paper" &&
    backgroundId !== "blush-paper" &&
    backgroundId !== "museum-card"
  ) {
    return undefined;
  }
  const stickerIds = arrayOfStrings(layout.stickerIds).filter(
    (item): item is PoemLayoutConfig["stickerIds"][number] =>
      item === "botanical" ||
      item === "moon" ||
      item === "postmark" ||
      item === "pressed-flower" ||
      item === "paperclip" ||
      item === "asterism" ||
      item === "washi"
  );
  return {
    templateId,
    typographyId,
    backgroundId,
    stickerIds
  };
}
