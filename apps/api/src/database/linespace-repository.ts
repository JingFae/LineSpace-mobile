import type {
  AiAssistRequest,
  AiAssistResponse,
  CreateInboxGroupInput,
  CreateContinuationInput,
  CreatePoemCommentInput,
  CreatePoemDraftInput,
  CreateStorageUploadInput,
  CreateThreadContinuationInput,
  ContentSearchResult,
  DraftOperationInput,
  DeletePoemInput,
  DeletePoemResult,
  FeedQuery,
  InboxActivitySummary,
  InboxActivityKind,
  InviteDraftCollaboratorInput,
  InviteInboxGroupMembersInput,
  LineSpaceApi,
  PoemCollectionKind,
  PoemDesignCatalog,
  PoemEngagementResult,
  PoemSummary,
  PublishPoemDraftInput,
  PublishPoemDraftResult,
  PublishThreadDraftInput,
  PublishThreadDraftResult,
  PublishThreadVersionAsPostInput,
  PublishThreadVersionAsPostResult,
  RespondInboxGroupInviteInput,
  SavePoemDraftInput,
  SendInboxMessageInput,
  SharePoemInput,
  SharePoemResult,
  SharePoemToGroupInput,
  ShareThreadInput,
  ShareThreadToGroupInput,
  ThreadContinuation,
  ThreadDetail,
  ThreadFeedQuery,
  ThreadShareResult,
  ThreadShareTarget,
  TagContentResult,
  UpdateCommentCollectionInput,
  UpdateContinuationLikeInput,
  UpdateInboxGroupInput,
  UpdatePoemCollectionInput,
  UpdatePoemDraftInput,
  UpdateThreadCollectionInput,
  UpdateThreadLikeInput,
  UpdateUserFollowInput,
  UpdateUserProfileInput,
  UserConnectionKind,
  UserConnectionPage,
  UserConnectionQuery,
  UserDraftPage,
  UserPoemCollections,
  UserProfile,
  UserProfileContentPage,
  UserProfileContentQuery,
  UserProfileContentSection,
  UserProfileDetails,
  UserSearchPage,
  UserSearchQuery
} from "@linespace/api-client";
import {
  createProfileRepositoryForRequest,
  type ProfileRepository
} from "./profile-repository.js";
import { createDatabaseClientForRequest, ensureDatabaseResult, getCurrentLinespaceUserId } from "./repository-support.js";
import { PostRepository } from "./post-repository.js";
import { CommentRepository } from "./comment-repository.js";
import { ThreadRepository } from "./thread-repository.js";
import { DraftRepository } from "./draft-repository.js";
import { InboxRepository } from "./inbox-repository.js";

export class SupabaseLineSpaceApi implements LineSpaceApi {
  private readonly posts: PostRepository;
  private readonly comments: CommentRepository;
  private readonly threads: ThreadRepository;
  private readonly drafts: DraftRepository;
  private readonly inbox: InboxRepository;

  constructor(
    private readonly client: NonNullable<ReturnType<typeof createDatabaseClientForRequest>>,
    private readonly profiles: ProfileRepository
  ) {
    this.posts = new PostRepository(client);
    this.comments = new CommentRepository(this.posts);
    this.threads = new ThreadRepository(client);
    this.drafts = new DraftRepository(client, this.posts, this.threads);
    this.inbox = new InboxRepository(client);
  }

  async getPoemDesignCatalog(): Promise<PoemDesignCatalog> {
    return this.drafts.getPoemDesignCatalog();
  }

  createPoemDraft(input: CreatePoemDraftInput) {
    return this.drafts.createPoemDraft(input);
  }

  getPoemDraft(id: string) {
    return this.drafts.getPoemDraft(id);
  }

  updatePoemDraft(input: UpdatePoemDraftInput) {
    return this.drafts.updatePoemDraft(input);
  }

  applyDraftOperation(input: DraftOperationInput) {
    return this.drafts.applyDraftOperation(input);
  }

  listDraftInviteCandidates(userId: string) {
    return this.drafts.listDraftInviteCandidates(userId);
  }

  inviteDraftCollaborator(input: InviteDraftCollaboratorInput) {
    return this.drafts.inviteDraftCollaborator(input);
  }

  publishPoemDraft(input: PublishPoemDraftInput): Promise<PublishPoemDraftResult> {
    return this.drafts.publishPoemDraft(input);
  }

  publishThreadDraft(input: PublishThreadDraftInput): Promise<PublishThreadDraftResult> {
    return this.drafts.publishThreadDraft(input);
  }

  async publishThreadVersionAsPost(
    input: PublishThreadVersionAsPostInput
  ): Promise<PublishThreadVersionAsPostResult> {
    const postId = await this.threads.publishVersionAsPost(input);
    const poem = await this.posts.getPoem(postId);
    if (!poem) throw new Error("published Thread version Post was not found");
    return {
      threadId: input.threadId,
      versionId: input.versionId,
      poem
    };
  }

  savePoemDraft(input: SavePoemDraftInput) {
    return this.drafts.savePoemDraft(input);
  }

  listUserDrafts(userId: string): Promise<UserDraftPage> {
    return this.drafts.listUserDrafts(userId);
  }

  listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    return this.posts.listFeed(query);
  }

  getPoem(id: string, _viewerId?: string) {
    return this.posts.getPoem(id);
  }

  deletePoem(input: DeletePoemInput): Promise<DeletePoemResult> {
    return this.posts.deletePoem(input);
  }

  async searchContent(query: string, _viewerId: string): Promise<ContentSearchResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId) throw new Error("search requires an authenticated user");
    const normalized = query.trim();
    if (!normalized) return { query: "", posts: [], threads: [], users: [] };
    const idsResult = await this.client.rpc("search_content_ids", {
      p_query: normalized,
      p_limit: 40
    });
    ensureDatabaseResult(idsResult.error);
    const rows = (idsResult.data as Array<{
      content_kind: "post" | "thread";
      content_id: string;
    }> | null) ?? [];
    const postIds = rows.filter((row) => row.content_kind === "post").map((row) => row.content_id);
    const threadIds = rows.filter((row) => row.content_kind === "thread").map((row) => row.content_id);
    const [postItems, threadItems, userPage] = await Promise.all([
      Promise.all(postIds.map((id) => this.posts.getPoem(id))),
      Promise.all(threadIds.map((id) => this.threads.getThread(id))),
      this.profiles.searchUsers(actorId, normalized, { limit: 30 })
    ]);
    const users = [
      ...userPage.recent,
      ...userPage.friends,
      ...userPage.results
    ].filter((user, index, items) => items.findIndex((item) => item.id === user.id) === index);
    return {
      query: normalized,
      posts: postItems.filter((item): item is PoemSummary => Boolean(item)),
      threads: threadItems.flatMap((item) => item ? [item.thread] : []),
      users
    };
  }

  async listTagContent(tag: string, _viewerId: string): Promise<TagContentResult> {
    const normalized = tag.trim().replace(/^#+/, "").toLocaleLowerCase();
    if (!normalized) return { tag: "", posts: [], threads: [] };
    const idsResult = await this.client.rpc("list_tag_content_ids", {
      p_tag: normalized,
      p_limit: 100
    });
    ensureDatabaseResult(idsResult.error);
    const rows = (idsResult.data as Array<{
      content_kind: "post" | "thread";
      content_id: string;
    }> | null) ?? [];
    const postIds = rows.filter((row) => row.content_kind === "post").map((row) => row.content_id);
    const threadIds = rows.filter((row) => row.content_kind === "thread").map((row) => row.content_id);
    const [postItems, threadItems] = await Promise.all([
      Promise.all(postIds.map((id) => this.posts.getPoem(id))),
      Promise.all(threadIds.map((id) => this.threads.getThread(id)))
    ]);
    return {
      tag: normalized,
      posts: postItems.filter((item): item is PoemSummary => Boolean(item)),
      threads: threadItems.flatMap((item) => item ? [item.thread] : [])
    };
  }

  setPoemCollection(input: UpdatePoemCollectionInput): Promise<PoemEngagementResult> {
    return this.posts.setPoemCollection(input);
  }

  getUserPoemCollections(userId: string): Promise<UserPoemCollections> {
    return this.posts.getUserPoemCollections(userId);
  }

  async getInboxActivitySummary(userId: string): Promise<InboxActivitySummary> {
    return this.inbox.getInboxActivitySummary(userId);
  }

  markInboxActivityRead(userId: string, kind: InboxActivityKind): Promise<InboxActivitySummary> {
    return this.inbox.markInboxActivityRead(userId, kind);
  }

  getUserProfile(userId: string): Promise<UserProfileDetails | null> {
    return this.profiles.getProfile(userId);
  }

  updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfileDetails> {
    return this.profiles.updateProfile(input.userId, input.userId, {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      avatarColor: input.avatarColor,
      bio: input.bio,
      visibility: input.visibility
    });
  }

  setUserFollow(input: UpdateUserFollowInput) {
    return this.profiles.setUserFollow(input);
  }

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
    const visible = actorId === userId || (
      section === "posts" ? profile.visibility.posts :
      section === "threads" ? profile.visibility.threads :
      section === "comments" ? profile.visibility.comments :
      profile.visibility.saves
    );
    if (!visible) return { userId, section, total: 0, items: [], visible: false };

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
      const source = relation === "started"
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
      const ids = [...new Set(
        ((source.data as Array<{ id?: string; thread_id?: string }> | null) ?? [])
          .map((row) => row.id ?? row.thread_id)
          .filter((id): id is string => Boolean(id))
      )];
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
        id: string; post_id: string; body: string; created_at: string; likes_count: number;
      }> | null) ?? [];
      const postIds = [...new Set(comments.map((comment) => comment.post_id))];
      const postsResult = postIds.length
        ? await this.client.from("posts").select("id,author_user_id,title").in("id", postIds)
        : { data: [], error: null };
      ensureDatabaseResult(postsResult.error);
      const posts = new Map(
        (((postsResult.data as Array<{ id: string; author_user_id: string; title: string }> | null) ?? []))
          .map((post) => [post.id, post] as const)
      );
      const items = comments.flatMap((comment) => {
        const post = posts.get(comment.post_id);
        if (!post || post.author_user_id === userId) return [];
        return [{
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
        }];
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
      const rows = (result.data as Array<{ post_id: string; created_at: string }> | null) ?? [];
      const poems = await this.posts.listPoemsByIds(rows.map((row) => row.post_id));
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
      const rows = (result.data as Array<{ thread_id: string; created_at: string }> | null) ?? [];
      const threads = await this.threads.listThreadsByIds(rows.map((row) => row.thread_id));
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
    const engagements = (engagementResult.data as Array<{ comment_id: string; created_at: string }> | null) ?? [];
    const commentIds = engagements.map((row) => row.comment_id);
    const commentResult = commentIds.length
      ? await this.client
          .from("post_comments")
          .select("id,post_id,body,likes_count")
          .in("id", commentIds)
      : { data: [], error: null };
    ensureDatabaseResult(commentResult.error);
    const comments = new Map(
      (((commentResult.data as Array<{ id: string; post_id: string; body: string; likes_count: number }> | null) ?? []))
        .map((comment) => [comment.id, comment] as const)
    );
    const postIds = [...new Set([...comments.values()].map((comment) => comment.post_id))];
    const postsResult = postIds.length
      ? await this.client.from("posts").select("id,title").in("id", postIds)
      : { data: [], error: null };
    ensureDatabaseResult(postsResult.error);
    const posts = new Map(
      (((postsResult.data as Array<{ id: string; title: string }> | null) ?? []))
        .map((post) => [post.id, post] as const)
    );
    const items = engagements.flatMap((engagement) => {
      const comment = comments.get(engagement.comment_id);
      const post = comment ? posts.get(comment.post_id) : undefined;
      if (!comment || !post) return [];
      return [{
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
      }];
    });
    return { userId, section, total: items.length, items, visible: true };
  }

  listUserConnections(
    userId: string,
    kind: UserConnectionKind,
    query?: UserConnectionQuery
  ): Promise<UserConnectionPage> {
    return getCurrentLinespaceUserId(this.client).then((actorId) =>
      this.profiles.listConnections(actorId ?? userId, userId, kind, query)
    );
  }

  listThreads(query: ThreadFeedQuery = {}) {
    return this.threads.listThreads(query);
  }

  getThread(threadId: string, _viewerId?: string): Promise<ThreadDetail | null> {
    return this.threads.getThread(threadId);
  }

  getContinuationDetail(continuationId: string, _viewerId?: string) {
    return this.threads.getContinuationDetail(continuationId);
  }

  createThreadContinuation(input: CreateThreadContinuationInput) {
    return this.threads.createThreadContinuation(input);
  }

  createContinuation(input: CreateContinuationInput) {
    return this.threads.createContinuation(input);
  }

  setThreadLike(input: UpdateThreadLikeInput) {
    return this.threads.setThreadLike(input);
  }

  setContinuationLike(input: UpdateContinuationLikeInput) {
    return this.threads.setContinuationLike(input);
  }

  setThreadCollection(input: UpdateThreadCollectionInput) {
    return this.threads.setThreadCollection(input);
  }

  recordThreadShare(target: ThreadShareTarget): Promise<ThreadShareResult> {
    return this.threads.recordThreadShare(target);
  }

  shareThread(input: ShareThreadInput): Promise<ThreadShareResult> {
    return this.threads.shareThread(input);
  }

  shareThreadToGroup(input: ShareThreadToGroupInput) {
    return this.inbox.shareThreadToGroup(input);
  }

  async requestAiAssist(_request: AiAssistRequest): Promise<AiAssistResponse> {
    throw new Error("AI service is handled by the API route");
  }

  createPoemComment(input: CreatePoemCommentInput) {
    return this.comments.createComment(input);
  }

  setCommentCollection(input: UpdateCommentCollectionInput) {
    return this.comments.setCollection(input);
  }

  searchUsers(query: string, viewerId: string, options?: UserSearchQuery): Promise<UserSearchPage> {
    return this.profiles.searchUsers(viewerId, query, options);
  }

  sharePoem(input: SharePoemInput): Promise<SharePoemResult> {
    return this.posts.sharePoem(input);
  }

  sharePoemToGroup(input: SharePoemToGroupInput) {
    return this.inbox.sharePoemToGroup(input);
  }

  listInboxMessages(userId: string, contactId: string) {
    return this.inbox.listInboxMessages(userId, contactId);
  }

  sendInboxMessage(input: SendInboxMessageInput) {
    return this.inbox.sendInboxMessage(input);
  }

  listInboxGroups(userId: string) {
    return this.inbox.listInboxGroups(userId);
  }

  listInboxGroupInvites(userId: string) {
    return this.inbox.listInboxGroupInvites(userId);
  }

  getInboxGroup(groupId: string, userId: string) {
    return this.inbox.getInboxGroup(groupId, userId);
  }

  createInboxGroup(input: CreateInboxGroupInput) {
    return this.inbox.createInboxGroup(input);
  }

  updateInboxGroup(input: UpdateInboxGroupInput) {
    return this.inbox.updateInboxGroup(input);
  }

  inviteInboxGroupMembers(input: InviteInboxGroupMembersInput) {
    return this.inbox.inviteInboxGroupMembers(input);
  }

  respondInboxGroupInvite(input: RespondInboxGroupInviteInput) {
    return this.inbox.respondInboxGroupInvite(input);
  }

  listInboxGroupMessages(groupId: string, userId: string) {
    return this.inbox.listInboxGroupMessages(groupId, userId);
  }

  createStorageUpload(input: CreateStorageUploadInput) {
    return this.drafts.createUploadUrl(input);
  }
}

export function createSupabaseLineSpaceApiForRequest(
  authorization?: string
): SupabaseLineSpaceApi | null {
  if (process.env.EXPO_PUBLIC_USE_MOCKS === "true") return null;
  const client = createDatabaseClientForRequest(authorization);
  const profiles = createProfileRepositoryForRequest(authorization);
  if (!client || !profiles) return null;
  return new SupabaseLineSpaceApi(client, profiles);
}
