import type {
  AiAssistRequest,
  AiAssistResponse,
  ContinuationDetail,
  CreateContinuationInput,
  CreatePoemDraftInput,
  CreateThreadContinuationInput,
  DraftInvitation,
  DraftOperationInput,
  FeedQuery,
  InboxActivitySummary,
  InviteDraftCollaboratorInput,
  PoemDesignCatalog,
  PoemDraft,
  PoemEngagementResult,
  PoetryThread,
  PoemSummary,
  PublishPoemDraftInput,
  PublishPoemDraftResult,
  ThreadContinuation,
  ThreadDetail,
  ThreadFeedQuery,
  ThreadShareResult,
  ThreadShareTarget,
  UpdatePoemDraftInput,
  UpdatePoemCollectionInput,
  UpdateContinuationLikeInput,
  UpdateThreadLikeInput,
  UserConnectionKind,
  UserConnectionPage,
  UserConnectionQuery,
  UserPoemCollections,
  UserProfileContentPage,
  UserProfileContentSection,
  UserProfileDetails,
  UpdateUserProfileInput
} from "./types";
import type { LineSpaceApi } from "./client";

export class HttpLineSpaceApi implements LineSpaceApi {
  constructor(private readonly baseUrl: string) {}

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

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const params = new URLSearchParams();
    if (query.section) {
      params.set("section", query.section);
    }
    if (query.filter) {
      params.set("filter", query.filter);
    }
    if (query.viewerId) {
      params.set("viewerId", query.viewerId);
    }

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

  async listUserProfileContent(
    userId: string,
    section: UserProfileContentSection
  ): Promise<UserProfileContentPage> {
    return this.getJson<UserProfileContentPage>(
      `/v1/users/${encodeURIComponent(userId)}/profile-content/${section}`
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
    if (query.viewerId) {
      params.set("viewerId", query.viewerId);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";

    return this.getJson<UserConnectionPage>(
      `/v1/users/${encodeURIComponent(userId)}/${kind}${suffix}`
    );
  }

  async listThreads(query: ThreadFeedQuery = {}): Promise<PoetryThread[]> {
    const params = new URLSearchParams();
    if (query.sort) params.set("sort", query.sort);
    if (query.viewerId) params.set("viewerId", query.viewerId);
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

  async requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse> {
    return this.postJson<AiAssistResponse>("/v1/ai/assist", request);
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`LineSpace API GET ${path} failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    return this.sendJson<T>("POST", path, body);
  }

  private async putJson<T>(path: string, body: unknown): Promise<T> {
    return this.sendJson<T>("PUT", path, body);
  }

  private async sendJson<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`LineSpace API ${method} ${path} failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
