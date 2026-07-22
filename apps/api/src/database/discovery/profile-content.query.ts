import type {
  UserProfileContentPage,
  UserProfileContentQuery,
  UserProfileContentSection
} from "@linespace/api-client";
import { getCurrentLinespaceUserId } from "../core/auth-context.js";
import type { DatabaseClient } from "../core/client.js";
import { ensureDatabaseResult } from "../core/errors.js";
import type { ProfileRepository } from "../profile/profile.repository.js";
import { PostRepository } from "../post/post.repository.js";
import { ThreadRepository } from "../thread/thread.repository.js";

export class ProfileContentQuery {
  constructor(
    private readonly client: DatabaseClient,
    private readonly profiles: ProfileRepository,
    private readonly posts: PostRepository,
    private readonly threads: ThreadRepository
  ) {}

  async listUserProfileContent(
    userId: string,
    section: UserProfileContentSection,
    query: UserProfileContentQuery = {}
  ): Promise<UserProfileContentPage> {
    const profile = await this.profiles.getProfile(userId);
    if (!profile) {
      return { userId, section, total: 0, items: [], visible: false };
    }
    const actorId = await getCurrentLinespaceUserId(this.client);
    const visible =
      actorId === userId ||
      (section === "posts"
        ? profile.visibility.posts
        : section === "threads"
          ? profile.visibility.threads
          : section === "comments"
            ? profile.visibility.comments
            : profile.visibility.saves);
    if (!visible) {
      return { userId, section, total: 0, items: [], visible: false };
    }

    if (section === "posts") {
      const poems = await this.posts.listProfilePosts(userId);
      return {
        userId,
        section,
        total: poems.length,
        visible: true,
        items: poems.map((poem) => ({
          id: `profile-${poem.id}`,
          kind: "post" as const,
          poemId: poem.id,
          title: poem.title,
          excerpt: poem.lines[0] ?? "",
          tags: poem.tags,
          finishedAt: poem.startedAt,
          highlightCount: poem.metrics.likes,
          ...(poem.artworkUrl ? { artworkUrl: poem.artworkUrl } : {}),
          ...(poem.media ? { media: poem.media } : {}),
          ...(poem.layout ? { layout: poem.layout } : {}),
          artworkTone: poem.artworkTone
        }))
      };
    }

    if (section === "threads") {
      const relation = query.threadRelation ?? "started";
      const source =
        relation === "started"
          ? await this.client
              .from("poetry_threads")
              .select("id,created_at")
              .eq("author_user_id", userId)
              .order("created_at", { ascending: false })
              .limit(100)
          : await this.client
              .from("thread_continuations")
              .select("thread_id,created_at")
              .eq("author_user_id", userId)
              .order("created_at", { ascending: false })
              .limit(200);
      ensureDatabaseResult(source.error);
      const ids = [
        ...new Set(
          ((source.data as Array<{ id?: string; thread_id?: string }> | null) ?? [])
            .map((row) => row.id ?? row.thread_id)
            .filter((id): id is string => Boolean(id))
        )
      ];
      const threads = await this.threads.listThreadsByIds(ids);
      return {
        userId,
        section,
        total: threads.length,
        visible: true,
        items: threads.map((thread) => ({
          id: `profile-thread-${relation}-${thread.id}`,
          kind: "thread" as const,
          threadId: thread.id,
          title: thread.title ?? thread.content.slice(0, 52),
          excerpt: thread.content,
          tags: thread.tags ?? [],
          finishedAt: thread.createdAt,
          highlightCount: thread.metrics.likes,
          threadRelation: relation
        }))
      };
    }

    if (section === "comments") {
      const commentsResult = await this.client
        .from("post_comments")
        .select("id,post_id,body,created_at,likes_count")
        .eq("author_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      ensureDatabaseResult(commentsResult.error);
      const comments = (commentsResult.data as Array<{
        id: string;
        post_id: string;
        body: string;
        created_at: string;
        likes_count: number;
      }> | null) ?? [];
      const postIds = [...new Set(comments.map((comment) => comment.post_id))];
      const postsResult = postIds.length
        ? await this.client
            .from("posts")
            .select("id,author_user_id,title")
            .in("id", postIds)
        : { data: [], error: null };
      ensureDatabaseResult(postsResult.error);
      const posts = new Map(
        ((postsResult.data as Array<{
          id: string;
          author_user_id: string;
          title: string;
        }> | null) ?? []).map((post) => [post.id, post] as const)
      );
      const items = comments.flatMap((comment) => {
        const post = posts.get(comment.post_id);
        if (!post || post.author_user_id === userId) return [];
        return [
          {
            id: `profile-comment-${comment.id}`,
            kind: "comment" as const,
            poemId: comment.post_id,
            commentId: comment.id,
            title: post.title,
            excerpt: comment.body,
            tags: [],
            finishedAt: comment.created_at,
            highlightCount: Number(comment.likes_count) || 0,
            reference: { kind: "post" as const, text: post.title }
          }
        ];
      });
      return { userId, section, total: items.length, items, visible: true };
    }

    const collection = query.collection ?? "liked";
    const contentKind = query.contentKind ?? "post";
    if (contentKind === "post") {
      const table = collection === "liked" ? "post_likes" : "post_saves";
      const result = await this.client
        .from(table)
        .select("post_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      ensureDatabaseResult(result.error);
      const rows = (result.data as Array<{
        post_id: string;
        created_at: string;
      }> | null) ?? [];
      const poems = await this.posts.listPoemsByIds(
        rows.map((row) => row.post_id)
      );
      const items = poems.map((poem, index) => ({
        id: `profile-${collection}-post-${poem.id}`,
        kind: "post" as const,
        poemId: poem.id,
        title: poem.title,
        excerpt: poem.lines[0] ?? "",
        tags: poem.tags,
        finishedAt: rows[index]?.created_at ?? poem.editedAt ?? poem.startedAt,
        highlightCount: poem.metrics.likes,
        ...(poem.artworkUrl ? { artworkUrl: poem.artworkUrl } : {}),
        ...(poem.media ? { media: poem.media } : {}),
        ...(poem.layout ? { layout: poem.layout } : {}),
        artworkTone: poem.artworkTone,
        collection
      }));
      return { userId, section, total: items.length, items, visible: true };
    }
    if (contentKind === "thread") {
      const table = collection === "liked" ? "thread_likes" : "thread_saves";
      const result = await this.client
        .from(table)
        .select("thread_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      ensureDatabaseResult(result.error);
      const rows = (result.data as Array<{
        thread_id: string;
        created_at: string;
      }> | null) ?? [];
      const threads = await this.threads.listThreadsByIds(
        rows.map((row) => row.thread_id)
      );
      const items = threads.map((thread, index) => ({
        id: `profile-${collection}-thread-${thread.id}`,
        kind: "thread" as const,
        threadId: thread.id,
        title: thread.title ?? thread.content.slice(0, 52),
        excerpt: thread.content,
        tags: thread.tags ?? [],
        finishedAt: rows[index]?.created_at ?? thread.createdAt,
        highlightCount: thread.metrics.likes,
        collection
      }));
      return { userId, section, total: items.length, items, visible: true };
    }

    const engagementResult = await this.client
      .from("post_comment_engagements")
      .select("comment_id,created_at")
      .eq("user_id", userId)
      .eq("kind", collection)
      .order("created_at", { ascending: false })
      .limit(100);
    ensureDatabaseResult(engagementResult.error);
    const engagements = (engagementResult.data as Array<{
      comment_id: string;
      created_at: string;
    }> | null) ?? [];
    const commentIds = engagements.map((row) => row.comment_id);
    const commentResult = commentIds.length
      ? await this.client
          .from("post_comments")
          .select("id,post_id,body,likes_count")
          .in("id", commentIds)
      : { data: [], error: null };
    ensureDatabaseResult(commentResult.error);
    const comments = new Map(
      ((commentResult.data as Array<{
        id: string;
        post_id: string;
        body: string;
        likes_count: number;
      }> | null) ?? []).map((comment) => [comment.id, comment] as const)
    );
    const postIds = [
      ...new Set([...comments.values()].map((comment) => comment.post_id))
    ];
    const postsResult = postIds.length
      ? await this.client.from("posts").select("id,title").in("id", postIds)
      : { data: [], error: null };
    ensureDatabaseResult(postsResult.error);
    const posts = new Map(
      ((postsResult.data as Array<{ id: string; title: string }> | null) ?? []).map(
        (post) => [post.id, post] as const
      )
    );
    const items = engagements.flatMap((engagement) => {
      const comment = comments.get(engagement.comment_id);
      const post = comment ? posts.get(comment.post_id) : undefined;
      if (!comment || !post) return [];
      return [
        {
          id: `profile-${collection}-comment-${comment.id}`,
          kind: "comment" as const,
          poemId: comment.post_id,
          commentId: comment.id,
          title: post.title,
          excerpt: comment.body,
          tags: [],
          finishedAt: engagement.created_at,
          highlightCount: Number(comment.likes_count) || 0,
          collection,
          reference: { kind: "post" as const, text: post.title }
        }
      ];
    });
    return { userId, section, total: items.length, items, visible: true };
  }
}
