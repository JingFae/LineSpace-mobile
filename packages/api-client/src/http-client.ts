import type {
  ApplyCommunitySparkInput,
  ApplyCommunitySparkResult,
  AiAssistRequest,
  AiAssistResponse,
  CommunitySparkRequest,
  CommunitySparkResponse,
  CreatePoemCommentInput,
  CreateInboxGroupInput,
  ContinuationDetail,
  CreateContinuationInput,
  CreatePoemDraftInput,
  CreateStorageUploadInput,
  CreateThreadContinuationInput,
  ContentSearchResult,
  DraftInvitation,
  DraftOperationInput,
  DeleteThreadInput,
  DeleteThreadResult,
  DeletePoemInput,
  DeletePoemResult,
  FeedQuery,
  InboxActivitySummary,
  InboxActivityKind,
  InboxGroup,
  InviteDraftCollaboratorInput,
  InviteInboxGroupMembersInput,
  PoemDesignCatalog,
  PoemDraft,
  PoemEngagementResult,
  PoemComment,
  PoemCommentEngagementResult,
  PoetryThread,
  PoemSummary,
  PublishPoemDraftInput,
  PublishPoemDraftResult,
  PublishThreadDraftInput,
  PublishThreadDraftResult,
  PublishThreadVersionAsPostInput,
  PublishThreadVersionAsPostResult,
  SharePoemInput,
  SharePoemResult,
  SharePoemToGroupInput,
  SendInboxMessageInput,
  StorageUploadTarget,
  SavePoemDraftInput,
  ThreadContinuation,
  ThreadDetail,
  ThreadFeedQuery,
  ThreadShareResult,
  ThreadShareTarget,
  TagContentResult,
  ShareThreadInput,
  ShareThreadToGroupInput,
  UpdateThreadCollectionInput,
  UpdateThreadInput,
  UpdatePoemDraftInput,
  UpdateInboxGroupInput,
  UpdatePoemCollectionInput,
  UpdateContinuationLikeInput,
  UpdateUserFollowInput,
  UpdateThreadLikeInput,
  UserConnectionKind,
  UserConnectionPage,
  UserConnectionQuery,
  UserPoemCollections,
  UserProfileContentPage,
  UserProfileContentQuery,
  UserProfileContentSection,
  UserProfileDetails,
  UserFollowResult,
  UserSearchPage,
  UserSearchQuery,
  InboxConversationMessage,
  RespondInboxGroupInviteInput,
  UpdateCommentCollectionInput,
  UserDraftPage,
  UpdateUserProfileInput
} from "./types";
import type { LineSpaceApi } from "./client";

export type HttpLineSpaceApiOptions = {
  getAccessToken?: () => Promise<string | null | undefined> | string | null | undefined;
  /** Refreshes the current session when a protected request receives one 401. */
  refreshAccessToken?: () => Promise<string | null | undefined>;
  onRefreshFailure?: () => Promise<void> | void;
};

export class HttpLineSpaceApiError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly code?: string,
    responseMessage?: string
  ) {
    super(responseMessage || `LineSpace API request failed with ${status}.`);
    this.name = "HttpLineSpaceApiError";
  }
}

export class HttpLineSpaceApi implements LineSpaceApi {
  constructor(
    private readonly baseUrl: string,
    private readonly options: HttpLineSpaceApiOptions = {}
  ) {}

  private refreshPromise?: Promise<string | null | undefined>;

  async getPoemDesignCatalog(): Promise<PoemDesignCatalog> {
    return this.getJson<PoemDesignCatalog>("/v1/compose/design-catalog");
  }

  async createPoemDraft(input: CreatePoemDraftInput): Promise<PoemDraft> {
    return this.postJson<PoemDraft>("/v1/drafts", input);
  }

  async getPoemDraft(id: string): Promise<PoemDraft | null> {
    return this.getJson<PoemDraft | null>(`/v1/drafts/${encodeURIComponent(id)}`);
  }

  async updatePoemDraft(input: UpdatePoemDraftInput): Promise<PoemDraft> {
    const { draftId, ...changes } = input;
    return this.putJson<PoemDraft>(`/v1/drafts/${encodeURIComponent(draftId)}`, changes);
  }

  async applyDraftOperation(input: DraftOperationInput): Promise<PoemDraft> {
    const { draftId, ...operation } = input;
    return this.postJson<PoemDraft>(
      `/v1/drafts/${encodeURIComponent(draftId)}/operations`,
      operation
    );
  }

  async listDraftInviteCandidates(userId: string) {
    return this.getJson<Awaited<ReturnType<LineSpaceApi["listDraftInviteCandidates"]>>>(
      `/v1/users/${encodeURIComponent(userId)}/invite-candidates`
    );
  }

  async inviteDraftCollaborator(
    input: InviteDraftCollaboratorInput
  ): Promise<DraftInvitation> {
    const { draftId, ...invitation } = input;
    return this.postJson<DraftInvitation>(
      `/v1/drafts/${encodeURIComponent(draftId)}/invitations`,
      invitation
    );
  }

  async publishPoemDraft(input: PublishPoemDraftInput): Promise<PublishPoemDraftResult> {
    const { draftId, ...request } = input;
    return this.postJson<PublishPoemDraftResult>(
      `/v1/drafts/${encodeURIComponent(draftId)}/publish`,
      request
    );
  }

  async publishThreadDraft(input: PublishThreadDraftInput): Promise<PublishThreadDraftResult> {
    const { draftId, ...request } = input;
    return this.postJson<PublishThreadDraftResult>(
      `/v1/drafts/${encodeURIComponent(draftId)}/thread-publish`,
      request
    );
  }

  async publishThreadVersionAsPost(
    input: PublishThreadVersionAsPostInput
  ): Promise<PublishThreadVersionAsPostResult> {
    return this.postJson<PublishThreadVersionAsPostResult>(
      `/v1/threads/${encodeURIComponent(input.threadId)}/versions/${encodeURIComponent(input.versionId)}/publish`,
      input.title !== undefined ? { title: input.title } : {}
    );
  }

  async savePoemDraft(input: SavePoemDraftInput): Promise<PoemDraft> {
    const { draftId, ...request } = input;
    return this.postJson<PoemDraft>(
      `/v1/drafts/${encodeURIComponent(draftId)}/save`,
      request
    );
  }

  async listUserDrafts(userId: string): Promise<UserDraftPage> {
    return this.getJson<UserDraftPage>(
      `/v1/users/${encodeURIComponent(userId)}/drafts`
    );
  }

  async createStorageUpload(
    input: CreateStorageUploadInput
  ): Promise<StorageUploadTarget> {
    return this.postJson<StorageUploadTarget>("/v1/storage/upload-url", input);
  }

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const params = new URLSearchParams();
    if (query.section) {
      params.set("section", query.section);
    }
    if (query.filter) {
      params.set("filter", query.filter);
    }
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit !== undefined) params.set("limit", String(query.limit));

    return this.getJson<PoemSummary[]>(`/v1/feed?${params.toString()}`);
  }

  async getPoem(id: string, viewerId?: string): Promise<PoemSummary | null> {
    const params = new URLSearchParams();
    if (viewerId) {
      params.set("viewerId", viewerId);
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return this.getJson<PoemSummary | null>(
      `/v1/poems/${encodeURIComponent(id)}${query}`
    );
  }

  async deletePoem(input: DeletePoemInput): Promise<DeletePoemResult> {
    return this.deleteJson<DeletePoemResult>(
      `/v1/poems/${encodeURIComponent(input.poemId)}`
    );
  }

  async searchContent(query: string, viewerId: string): Promise<ContentSearchResult> {
    const params = new URLSearchParams({ query, viewerId });
    return this.getJson<ContentSearchResult>(`/v1/search?${params.toString()}`);
  }

  async listTagContent(tag: string, viewerId: string): Promise<TagContentResult> {
    const params = new URLSearchParams({ viewerId });
    return this.getJson<TagContentResult>(
      `/v1/tags/${encodeURIComponent(tag)}?${params.toString()}`
    );
  }

  async createPoemComment(input: CreatePoemCommentInput): Promise<PoemComment> {
    const { poemId, ...request } = input;
    return this.postJson<PoemComment>(`/v1/poems/${encodeURIComponent(poemId)}/comments`, request);
  }

  async setCommentCollection(input: UpdateCommentCollectionInput): Promise<PoemCommentEngagementResult> {
    return this.putJson<PoemCommentEngagementResult>(
      `/v1/poems/${encodeURIComponent(input.poemId)}/comments/${encodeURIComponent(input.commentId)}/collections/${input.collection}`,
      { userId: input.userId, isActive: input.isActive }
    );
  }

  async searchUsers(query: string, _viewerId: string, options: UserSearchQuery = {}): Promise<UserSearchPage> {
    // The server derives the viewer from the bearer JWT. Keep the legacy
    // method parameter for LineSpaceApi compatibility, but never send it as
    // an identity claim over HTTP.
    const params = new URLSearchParams({ query });
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    return this.getJson<UserSearchPage>(`/v1/users/search?${params.toString()}`);
  }

  async sharePoem(input: SharePoemInput): Promise<SharePoemResult> {
    const { poemId, ...request } = input;
    return this.postJson<SharePoemResult>(`/v1/poems/${encodeURIComponent(poemId)}/share`, request);
  }

  async sharePoemToGroup(
    input: SharePoemToGroupInput
  ): Promise<InboxConversationMessage> {
    return this.postJson<InboxConversationMessage>(
      `/v1/inbox/groups/${encodeURIComponent(input.groupId)}/share/post`,
      { postId: input.poemId, note: input.note }
    );
  }

  async listInboxMessages(userId: string, contactId: string): Promise<InboxConversationMessage[]> {
    const params = new URLSearchParams({ contactId });
    return this.getJson<InboxConversationMessage[]>(
      `/v1/users/${encodeURIComponent(userId)}/inbox/messages?${params.toString()}`
    );
  }

  async sendInboxMessage(input: SendInboxMessageInput): Promise<InboxConversationMessage> {
    if (input.groupId) {
      return this.postJson<InboxConversationMessage>(
        `/v1/inbox/groups/${encodeURIComponent(input.groupId)}/messages`,
        { text: input.text }
      );
    }
    return this.postJson<InboxConversationMessage>(
      `/v1/users/${encodeURIComponent(input.senderId)}/inbox/messages`,
      { recipientId: input.recipientId, text: input.text }
    );
  }

  async listInboxGroups(_userId: string): Promise<InboxGroup[]> {
    return this.getJson<InboxGroup[]>("/v1/inbox/groups");
  }

  async listInboxGroupInvites(_userId: string): Promise<InboxGroup[]> {
    return this.getJson<InboxGroup[]>("/v1/inbox/group-invites");
  }

  async getInboxGroup(groupId: string, _userId: string): Promise<InboxGroup | null> {
    return this.getJson<InboxGroup | null>(
      `/v1/inbox/groups/${encodeURIComponent(groupId)}`
    );
  }

  async createInboxGroup(input: CreateInboxGroupInput): Promise<InboxGroup> {
    return this.postJson<InboxGroup>("/v1/inbox/groups", {
      name: input.name,
      inviteeIds: input.inviteeIds
    });
  }

  async updateInboxGroup(input: UpdateInboxGroupInput): Promise<InboxGroup> {
    return this.putJson<InboxGroup>(
      `/v1/inbox/groups/${encodeURIComponent(input.groupId)}`,
      { name: input.name }
    );
  }

  async inviteInboxGroupMembers(
    input: InviteInboxGroupMembersInput
  ): Promise<InboxGroup> {
    return this.postJson<InboxGroup>(
      `/v1/inbox/groups/${encodeURIComponent(input.groupId)}/invitations`,
      { inviteeIds: input.inviteeIds }
    );
  }

  async respondInboxGroupInvite(
    input: RespondInboxGroupInviteInput
  ): Promise<InboxGroup> {
    return this.putJson<InboxGroup>(
      `/v1/inbox/groups/${encodeURIComponent(input.groupId)}/invitations/respond`,
      { accept: input.accept }
    );
  }

  async listInboxGroupMessages(
    groupId: string,
    _userId: string
  ): Promise<InboxConversationMessage[]> {
    return this.getJson<InboxConversationMessage[]>(
      `/v1/inbox/groups/${encodeURIComponent(groupId)}/messages`
    );
  }

  async setPoemCollection(
    input: UpdatePoemCollectionInput
  ): Promise<PoemEngagementResult> {
    const path = [
      "/v1/users",
      encodeURIComponent(input.userId),
      "poem-collections",
      input.collection,
      encodeURIComponent(input.poemId)
    ].join("/");

    return this.putJson<PoemEngagementResult>(path, { isActive: input.isActive });
  }

  async getUserPoemCollections(userId: string): Promise<UserPoemCollections> {
    return this.getJson<UserPoemCollections>(
      `/v1/users/${encodeURIComponent(userId)}/poem-collections`
    );
  }

  async getInboxActivitySummary(userId: string): Promise<InboxActivitySummary> {
    return this.getJson<InboxActivitySummary>(
      `/v1/users/${encodeURIComponent(userId)}/inbox-summary`
    );
  }

  async markInboxActivityRead(
    userId: string,
    kind: InboxActivityKind
  ): Promise<InboxActivitySummary> {
    return this.putJson<InboxActivitySummary>(
      `/v1/users/${encodeURIComponent(userId)}/inbox-summary/${encodeURIComponent(kind)}/read`,
      {}
    );
  }

  async getUserProfile(userId: string): Promise<UserProfileDetails | null> {
    return this.getJson<UserProfileDetails | null>(
      `/v1/users/${encodeURIComponent(userId)}/profile`
    );
  }

  async updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfileDetails> {
    const { userId, ...changes } = input;
    return this.putJson<UserProfileDetails>(
      `/v1/users/${encodeURIComponent(userId)}/profile`,
      changes
    );
  }

  async setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult> {
    return input.isActive
      ? this.putJson<UserFollowResult>(
          `/v1/users/${encodeURIComponent(input.targetUserId)}/follow`,
          {}
        )
      : this.deleteJson<UserFollowResult>(
          `/v1/users/${encodeURIComponent(input.targetUserId)}/follow`
        );
  }

  async listUserProfileContent(
    userId: string,
    section: UserProfileContentSection,
    query: UserProfileContentQuery = {}
  ): Promise<UserProfileContentPage> {
    const params = new URLSearchParams();
    if (query.threadRelation) params.set("threadRelation", query.threadRelation);
    if (query.collection) params.set("collection", query.collection);
    if (query.contentKind) params.set("contentKind", query.contentKind);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.getJson<UserProfileContentPage>(
      `/v1/users/${encodeURIComponent(userId)}/profile-content/${section}${suffix}`
    );
  }

  async listUserConnections(
    userId: string,
    kind: UserConnectionKind,
    query: UserConnectionQuery = {}
  ): Promise<UserConnectionPage> {
    const params = new URLSearchParams();
    if (query.cursor) {
      params.set("cursor", query.cursor);
    }
    if (query.limit) {
      params.set("limit", `${query.limit}`);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";

    return this.getJson<UserConnectionPage>(
      `/v1/users/${encodeURIComponent(userId)}/${kind}${suffix}`
    );
  }

  async listThreads(query: ThreadFeedQuery = {}): Promise<PoetryThread[]> {
    const params = new URLSearchParams();
    if (query.sort) params.set("sort", query.sort);
    if (query.cursor) params.set("cursor", query.cursor);
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.getJson<PoetryThread[]>(`/v1/threads${suffix}`);
  }

  async getThread(threadId: string, viewerId?: string): Promise<ThreadDetail | null> {
    const params = new URLSearchParams();
    if (viewerId) params.set("viewerId", viewerId);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.getJson<ThreadDetail | null>(
      `/v1/threads/${encodeURIComponent(threadId)}${suffix}`
    );
  }

  async updateThread(input: UpdateThreadInput): Promise<PoetryThread> {
    const { threadId, ...request } = input;
    return this.putJson<PoetryThread>(`/v1/threads/${encodeURIComponent(threadId)}`, request);
  }

  async deleteThread(input: DeleteThreadInput): Promise<DeleteThreadResult> {
    return this.deleteJson<DeleteThreadResult>(
      `/v1/threads/${encodeURIComponent(input.threadId)}`
    );
  }

  async getContinuationDetail(
    continuationId: string,
    viewerId?: string
  ): Promise<ContinuationDetail | null> {
    const params = new URLSearchParams();
    if (viewerId) params.set("viewerId", viewerId);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.getJson<ContinuationDetail | null>(
      `/v1/continuations/${encodeURIComponent(continuationId)}${suffix}`
    );
  }

  async createThreadContinuation(
    input: CreateThreadContinuationInput
  ): Promise<ThreadContinuation> {
    const { threadId, ...request } = input;
    return this.postJson<ThreadContinuation>(
      `/v1/threads/${encodeURIComponent(threadId)}/continuations`,
      request
    );
  }

  async createContinuation(input: CreateContinuationInput): Promise<ThreadContinuation> {
    const { continuationId, ...request } = input;
    return this.postJson<ThreadContinuation>(
      `/v1/continuations/${encodeURIComponent(continuationId)}/continuations`,
      request
    );
  }

  async setThreadLike(input: UpdateThreadLikeInput): Promise<PoetryThread> {
    return this.putJson<PoetryThread>(
      `/v1/threads/${encodeURIComponent(input.threadId)}/like`,
      { userId: input.userId, isActive: input.isActive }
    );
  }

  async setContinuationLike(
    input: UpdateContinuationLikeInput
  ): Promise<ThreadContinuation> {
    return this.putJson<ThreadContinuation>(
      `/v1/continuations/${encodeURIComponent(input.continuationId)}/like`,
      { userId: input.userId, isActive: input.isActive }
    );
  }

  async setThreadCollection(input: UpdateThreadCollectionInput): Promise<PoetryThread> {
    return this.putJson<PoetryThread>(
      `/v1/threads/${encodeURIComponent(input.threadId)}/save`,
      { userId: input.userId, isActive: input.isActive }
    );
  }

  async recordThreadShare(target: ThreadShareTarget): Promise<ThreadShareResult> {
    if (target.kind === "thread") {
      return this.postJson<ThreadShareResult>(
        `/v1/threads/${encodeURIComponent(target.threadId)}/share`,
        { userId: target.userId }
      );
    }
    return this.postJson<ThreadShareResult>(
      `/v1/continuations/${encodeURIComponent(target.continuationId)}/share`,
      { userId: target.userId }
    );
  }

  async shareThread(input: ShareThreadInput): Promise<ThreadShareResult> {
    const resource = input.kind === "thread"
      ? `/v1/threads/${encodeURIComponent(input.threadId ?? "")}/share-recipients`
      : `/v1/continuations/${encodeURIComponent(input.continuationId ?? "")}/share-recipients`;
    return this.postJson<ThreadShareResult>(resource, {
      senderId: input.senderId,
      recipientIds: input.recipientIds,
      note: input.note
    });
  }

  async shareThreadToGroup(
    input: ShareThreadToGroupInput
  ): Promise<InboxConversationMessage> {
    return this.postJson<InboxConversationMessage>(
      `/v1/inbox/groups/${encodeURIComponent(input.groupId)}/share/thread`,
      {
        kind: input.kind,
        threadId: input.threadId,
        continuationId: input.continuationId,
        note: input.note
      }
    );
  }

  async requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse> {
    return this.postJson<AiAssistResponse>("/v1/ai/assist", request);
  }

  async requestCommunitySpark(
    request: CommunitySparkRequest
  ): Promise<CommunitySparkResponse> {
    const { poemId, ...body } = request;
    return this.postJson<CommunitySparkResponse>(
      `/v1/poems/${encodeURIComponent(poemId)}/community-spark`,
      body
    );
  }

  async applyCommunitySpark(
    input: ApplyCommunitySparkInput
  ): Promise<ApplyCommunitySparkResult> {
    const { poemId, ...body } = input;
    return this.postJson<ApplyCommunitySparkResult>(
      `/v1/poems/${encodeURIComponent(poemId)}/community-spark/apply`,
      body
    );
  }

  private async getJson<T>(path: string): Promise<T> {
    return this.requestJson<T>("GET", path);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    return this.sendJson<T>("POST", path, body);
  }

  private async putJson<T>(path: string, body: unknown): Promise<T> {
    return this.sendJson<T>("PUT", path, body);
  }

  private async deleteJson<T>(path: string): Promise<T> {
    return this.requestJson<T>("DELETE", path);
  }

  private async sendJson<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
    return this.requestJson<T>(method, path, body);
  }

  private async requestJson<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    let response = await this.performRequest(method, path, body);
    if (response.status === 401 && this.options.refreshAccessToken) {
      const refreshedToken = await this.refreshAccessTokenOnce();
      if (refreshedToken) {
        response = await this.performRequest(method, path, body, refreshedToken);
      } else {
        await this.options.onRefreshFailure?.();
      }
    }

    if (!response.ok) {
      const payload = await readApiErrorPayload(response);
      throw new HttpLineSpaceApiError(
        method,
        path,
        response.status,
        payload.code,
        payload.message
      );
    }
    return (await response.json()) as T;
  }

  private async performRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    accessTokenOverride?: string
  ) {
    const accessToken = accessTokenOverride ?? (await this.options.getAccessToken?.());
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: await this.requestHeaders(body !== undefined, accessToken),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  private async refreshAccessTokenOnce() {
    if (!this.options.refreshAccessToken) return null;
    if (!this.refreshPromise) {
      this.refreshPromise = this.options.refreshAccessToken().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  private async requestHeaders(
    hasJsonBody = false,
    accessToken?: string | null
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (hasJsonBody) {
      headers["content-type"] = "application/json";
    }

    const token = accessToken ?? (await this.options.getAccessToken?.());
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    return headers;
  }
}

async function readApiErrorPayload(response: Response): Promise<{
  code?: string;
  message?: string;
}> {
  try {
    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") return {};
    const record = payload as Record<string, unknown>;
    return {
      ...(typeof record.code === "string" ? { code: record.code } : {}),
      ...(typeof record.message === "string" ? { message: record.message } : {})
    };
  } catch {
    return {};
  }
}
