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
  FeedQuery,
  InboxActivitySummary,
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
    _query?: UserProfileContentQuery
  ): Promise<UserProfileContentPage> {
    const profile = await this.profiles.getProfile(userId);
    if (!profile) {
      return { userId, section, total: 0, items: [], visible: false };
    }
    if (section === "posts" || section === "saves") {
      const poems =
        section === "posts"
          ? await this.posts.listProfilePosts(userId)
          : await Promise.all(
              (await this.posts.getUserPoemCollections(userId)).savedPoemIds.map((id) =>
                this.posts.getPoem(id)
              )
            ).then((items) => items.filter((item): item is PoemSummary => Boolean(item)));
      return {
        userId,
        section,
        total: poems.length,
        visible: section === "posts" ? profile.visibility.posts : profile.visibility.saves,
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
          artworkTone: poem.artworkTone,
          ...(section === "saves" ? { collection: "saved" as const } : {})
        }))
      };
    }
    const threads = (await this.threads.listThreads()).filter(
      (thread) => thread.author.id === userId
    );
    return {
      userId,
      section,
      total: threads.length,
      visible: section === "threads" ? profile.visibility.threads : profile.visibility.comments,
      items: threads.map((thread) => ({
        id: `profile-thread-${thread.id}`,
        kind: "thread" as const,
        threadId: thread.id,
        title: thread.title ?? thread.content.slice(0, 52),
        excerpt: thread.content,
        tags: thread.tags ?? [],
        finishedAt: thread.createdAt,
        highlightCount: thread.metrics.likes,
        threadRelation: "started" as const
      }))
    };
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
