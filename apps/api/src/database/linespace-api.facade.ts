import type {
  ApplyCommunitySparkInput,
  ApplyCommunitySparkResult,
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
  DeleteThreadInput,
  DeleteThreadResult,
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
  UpdateThreadInput,
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
import { getCurrentLinespaceUserId } from "./core/auth-context.js";
import { createDatabaseClientForRequest } from "./core/client.js";
import { ContentDiscoveryQuery } from "./discovery/content-discovery.query.js";
import { ProfileContentQuery } from "./discovery/profile-content.query.js";
import { DraftRepository } from "./draft/draft.repository.js";
import { InboxRepository } from "./inbox/inbox.repository.js";
import { PostRepository } from "./post/post.repository.js";
import type { ProfileRepository } from "./profile/profile.repository.js";
import { createSupabaseProfileRepository } from "./profile/supabase-profile.repository.js";
import { ThreadRepository } from "./thread/thread.repository.js";

export class SupabaseLineSpaceApi implements LineSpaceApi {
  private readonly posts: PostRepository;
  private readonly threads: ThreadRepository;
  private readonly drafts: DraftRepository;
  private readonly inbox: InboxRepository;
  private readonly contentDiscovery: ContentDiscoveryQuery;
  private readonly profileContent: ProfileContentQuery;

  constructor(
    private readonly client: NonNullable<ReturnType<typeof createDatabaseClientForRequest>>,
    private readonly profiles: ProfileRepository
  ) {
    this.posts = new PostRepository(client);
    this.threads = new ThreadRepository(client);
    this.drafts = new DraftRepository(client, this.posts, this.threads);
    this.inbox = new InboxRepository(client);
    this.contentDiscovery = new ContentDiscoveryQuery(
      client,
      profiles,
      this.posts,
      this.threads
    );
    this.profileContent = new ProfileContentQuery(
      client,
      profiles,
      this.posts,
      this.threads
    );
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
    return this.contentDiscovery.searchContent(query, _viewerId);
  }

  async listTagContent(tag: string, _viewerId: string): Promise<TagContentResult> {
    return this.contentDiscovery.listTagContent(tag, _viewerId);
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
    return this.profileContent.listUserProfileContent(userId, section, query);
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

  updateThread(input: UpdateThreadInput) {
    return this.threads.updateThread(input);
  }

  deleteThread(input: DeleteThreadInput): Promise<DeleteThreadResult> {
    return this.threads.deleteThread(input);
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

  applyCommunitySpark(
    input: ApplyCommunitySparkInput
  ): Promise<ApplyCommunitySparkResult> {
    return this.posts.applyCommunitySpark(input);
  }

  async requestCommunitySpark(): Promise<never> {
    throw new Error("Community Spark generation is handled by the API route");
  }

  createPoemComment(input: CreatePoemCommentInput) {
    return this.posts.createPoemComment(input);
  }

  setCommentCollection(input: UpdateCommentCollectionInput) {
    return this.posts.setCommentCollection(input);
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
  if (!client) return null;
  const profiles = createSupabaseProfileRepository(client);
  return new SupabaseLineSpaceApi(client, profiles);
}
