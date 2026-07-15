import {
  mockPoems,
  mockPoemDesignCatalog,
  mockThreadContinuations,
  mockThreads,
  mockUserConnections,
  mockUserProfileContent,
  mockUserProfileDetails
} from "./mock-data";
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
  InviteDraftCollaboratorInput,
  PoemCollectionKind,
  PoemCreditPerson,
  PoemDesignCatalog,
  PoemDraft,
  PoemEngagementResult,
  PoetryThread,
  PublishPoemDraftInput,
  PublishPoemDraftResult,
  PoemSummary,
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
  UserProfile,
  UserProfileContentPage,
  UserProfileContentSection,
  UserProfileDetails,
  UpdateUserProfileInput
} from "./types";

export interface LineSpaceApi {
  getPoemDesignCatalog(): Promise<PoemDesignCatalog>;
  createPoemDraft(input: CreatePoemDraftInput): Promise<PoemDraft>;
  getPoemDraft(id: string): Promise<PoemDraft | null>;
  updatePoemDraft(input: UpdatePoemDraftInput): Promise<PoemDraft>;
  applyDraftOperation(input: DraftOperationInput): Promise<PoemDraft>;
  listDraftInviteCandidates(userId: string): Promise<UserConnectionPage["items"]>;
  inviteDraftCollaborator(input: InviteDraftCollaboratorInput): Promise<DraftInvitation>;
  publishPoemDraft(input: PublishPoemDraftInput): Promise<PublishPoemDraftResult>;
  listFeed(query?: FeedQuery): Promise<PoemSummary[]>;
  getPoem(id: string, viewerId?: string): Promise<PoemSummary | null>;
  setPoemCollection(input: UpdatePoemCollectionInput): Promise<PoemEngagementResult>;
  getUserPoemCollections(userId: string): Promise<UserPoemCollections>;
  getUserProfile(userId: string): Promise<UserProfileDetails | null>;
  updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfileDetails>;
  listUserProfileContent(
    userId: string,
    section: UserProfileContentSection
  ): Promise<UserProfileContentPage>;
  listUserConnections(
    userId: string,
    kind: UserConnectionKind,
    query?: UserConnectionQuery
  ): Promise<UserConnectionPage>;
  listThreads(query?: ThreadFeedQuery): Promise<PoetryThread[]>;
  getThread(threadId: string, viewerId?: string): Promise<ThreadDetail | null>;
  getContinuationDetail(
    continuationId: string,
    viewerId?: string
  ): Promise<ContinuationDetail | null>;
  createThreadContinuation(input: CreateThreadContinuationInput): Promise<ThreadContinuation>;
  createContinuation(input: CreateContinuationInput): Promise<ThreadContinuation>;
  setThreadLike(input: UpdateThreadLikeInput): Promise<PoetryThread>;
  setContinuationLike(input: UpdateContinuationLikeInput): Promise<ThreadContinuation>;
  recordThreadShare(target: ThreadShareTarget): Promise<ThreadShareResult>;
  requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse>;
}

type MutableUserCollections = Record<PoemCollectionKind, Set<string>>;

export class MockLineSpaceApi implements LineSpaceApi {
  private readonly poems = mockPoems.map(clonePoem);
  private readonly threads = mockThreads.map(cloneThread);
  private readonly continuations = mockThreadContinuations.map(cloneContinuation);
  private readonly profiles = mockUserProfileDetails.map(cloneUserProfile);
  private readonly drafts = new Map<string, PoemDraft>();
  private readonly invitations: DraftInvitation[] = [];
  private readonly collectionsByUser = new Map<string, MutableUserCollections>();
  private readonly likedThreadsByUser = new Map<string, Set<string>>();
  private readonly likedContinuationsByUser = new Map<string, Set<string>>();
  private draftSequence = 0;
  private continuationSequence = 0;

  async getPoemDesignCatalog(): Promise<PoemDesignCatalog> {
    return cloneDesignCatalog(mockPoemDesignCatalog);
  }

  async createPoemDraft(input: CreatePoemDraftInput): Promise<PoemDraft> {
    const owner = this.profiles.find((profile) => profile.id === input.ownerId);
    if (!owner) {
      throw new Error(`User ${input.ownerId} was not found`);
    }

    const now = new Date().toISOString();
    const draft: PoemDraft = {
      id: `draft-${++this.draftSequence}`,
      ownerId: input.ownerId,
      mode: input.mode,
      status: "editing",
      title: "",
      body: "",
      byline: owner.displayName,
      tags: [],
      settings: {
        declareOriginal: false,
        isPublic: true,
        allowComments: true,
        allowQuotes: true,
        allowSave: true
      },
      layout: cloneLayout(mockPoemDesignCatalog.templates[0]!.layout),
      collaborators: [
        {
          user: profileToUser(owner),
          role: "owner",
          status: "active",
          cursorLine: 1,
          lastSeenAt: now
        }
      ],
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    this.drafts.set(draft.id, draft);
    return cloneDraft(draft);
  }

  async getPoemDraft(id: string): Promise<PoemDraft | null> {
    const draft = this.drafts.get(id);
    return draft ? cloneDraft(draft) : null;
  }

  async updatePoemDraft(input: UpdatePoemDraftInput): Promise<PoemDraft> {
    const draft = this.requireEditableDraft(input.draftId, input.userId);
    if (input.title !== undefined) draft.title = input.title;
    if (input.body !== undefined) draft.body = input.body;
    if (input.byline !== undefined) draft.byline = input.byline;
    if (input.tags !== undefined) draft.tags = [...input.tags];
    if (input.media !== undefined) draft.media = input.media ? { ...input.media } : undefined;
    if (input.settings) draft.settings = { ...draft.settings, ...input.settings };
    if (input.layout) draft.layout = cloneLayout(input.layout);
    draft.status = "editing";
    draft.version += 1;
    draft.updatedAt = new Date().toISOString();
    return cloneDraft(draft);
  }

  async applyDraftOperation(input: DraftOperationInput): Promise<PoemDraft> {
    const draft = this.requireEditableDraft(input.draftId, input.userId);
    draft.title = input.title;
    draft.body = input.body;
    draft.version = Math.max(draft.version, input.baseVersion) + 1;
    draft.updatedAt = new Date().toISOString();
    const collaborator = draft.collaborators.find((item) => item.user.id === input.userId);
    if (collaborator) {
      collaborator.cursorLine = Math.max(1, input.body.split(/\r?\n/).length);
      collaborator.lastSeenAt = draft.updatedAt;
    }
    return cloneDraft(draft);
  }

  async listDraftInviteCandidates(userId: string): Promise<UserConnectionPage["items"]> {
    return this.profiles
      .filter((profile) => profile.id !== userId)
      .map((profile) => ({ ...profileToUser(profile), isFollowing: true }));
  }

  async inviteDraftCollaborator(
    input: InviteDraftCollaboratorInput
  ): Promise<DraftInvitation> {
    const draft = this.requireEditableDraft(input.draftId, input.inviterId);
    const invitee = this.profiles.find((profile) => profile.id === input.inviteeId);
    if (!invitee) {
      throw new Error(`User ${input.inviteeId} was not found`);
    }

    const existing = this.invitations.find(
      (invitation) =>
        invitation.draftId === input.draftId && invitation.inviteeId === input.inviteeId
    );
    if (existing) {
      return { ...existing };
    }

    const invitation: DraftInvitation = {
      id: `invite-${this.invitations.length + 1}`,
      draftId: input.draftId,
      inviterId: input.inviterId,
      inviteeId: input.inviteeId,
      status: "accepted",
      createdAt: new Date().toISOString()
    };
    this.invitations.push(invitation);
    draft.collaborators.push({
      user: profileToUser(invitee),
      role: "editor",
      status: "active",
      cursorLine: 2,
      lastSeenAt: invitation.createdAt
    });
    draft.version += 1;
    draft.updatedAt = invitation.createdAt;
    return { ...invitation };
  }

  async publishPoemDraft(input: PublishPoemDraftInput): Promise<PublishPoemDraftResult> {
    const draft = this.requireEditableDraft(input.draftId, input.userId);
    const owner = this.profiles.find((profile) => profile.id === draft.ownerId)!;
    const now = new Date().toISOString();
    const poem: PoemSummary = {
      id: `poem-${draft.id}`,
      title: draft.title.trim() || "untitled line",
      lines: draft.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      author: profileToUser(owner),
      contributorsCount: draft.collaborators.length,
      tags: [...draft.tags],
      status: "growing",
      startedAt: draft.createdAt,
      metrics: { comments: 0, likes: 0, contributions: 0, saves: 0 },
      viewer: { liked: false, saved: false },
      artworkTone: draft.layout.backgroundId === "midnight" ? "night" : "paper",
      credits: {
        startedBy: profileToUser(owner),
        commentContributors: draft.collaborators
          .slice(1)
          .map((collaborator) => profileToCreditPerson(collaborator.user)),
        quoteContributors: []
      }
    };
    if (poem.lines.length === 0) {
      poem.lines = ["A new line is waiting to be written."];
    }
    draft.status = "published";
    draft.updatedAt = now;
    draft.version += 1;
    this.poems.unshift(poem);
    return { draft: cloneDraft(draft), poem: clonePoem(poem) };
  }

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const { filter, viewerId } = query;
    let poems = this.poems;

    if (filter === "final") {
      poems = poems.filter((poem) => poem.status === "final");
    } else if (filter === "growing") {
      poems = poems.filter((poem) => poem.status === "growing");
    } else if (filter === "most-contributed") {
      poems = [...poems].sort(
        (left, right) => right.metrics.contributions - left.metrics.contributions
      );
    }

    return poems.map((poem) => this.withViewer(poem, viewerId));
  }

  async getPoem(id: string, viewerId?: string): Promise<PoemSummary | null> {
    const poem = this.poems.find((item) => item.id === id);
    return poem ? this.withViewer(poem, viewerId) : null;
  }

  async setPoemCollection(
    input: UpdatePoemCollectionInput
  ): Promise<PoemEngagementResult> {
    const poem = this.poems.find((item) => item.id === input.poemId);
    if (!poem) {
      throw new Error(`Poem ${input.poemId} was not found`);
    }

    const collections = this.getOrCreateCollections(input.userId);
    const collection = collections[input.collection];
    const wasActive = collection.has(input.poemId);

    if (wasActive !== input.isActive) {
      if (input.isActive) {
        collection.add(input.poemId);
      } else {
        collection.delete(input.poemId);
      }

      const metric = input.collection === "liked" ? "likes" : "saves";
      const delta = input.isActive ? 1 : -1;
      poem.metrics[metric] = Math.max(0, poem.metrics[metric] + delta);

      const authorProfile = this.profiles.find((profile) => profile.id === poem.author.id);
      if (authorProfile) {
        authorProfile.stats.likesAndSaves = Math.max(
          0,
          authorProfile.stats.likesAndSaves + delta
        );
      }

      if (input.collection === "saved") {
        const ownerProfile = this.profiles.find((profile) => profile.id === input.userId);
        if (ownerProfile) {
          ownerProfile.contentCounts.saves = Math.max(
            0,
            ownerProfile.contentCounts.saves + delta
          );
        }
      }
    }

    return {
      poem: this.withViewer(poem, input.userId),
      collections: this.snapshotCollections(input.userId, collections)
    };
  }

  async getUserPoemCollections(userId: string): Promise<UserPoemCollections> {
    const collections = this.getOrCreateCollections(userId);
    return this.snapshotCollections(userId, collections);
  }

  async getUserProfile(userId: string): Promise<UserProfileDetails | null> {
    const profile = this.profiles.find((item) => item.id === userId);
    return profile ? cloneUserProfile(profile) : null;
  }

  async updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfileDetails> {
    const profile = this.profiles.find((item) => item.id === input.userId);
    if (!profile) {
      throw new Error(`User ${input.userId} was not found`);
    }

    const displayName = input.displayName?.trim();
    const bio = input.bio?.trim();
    if (input.displayName !== undefined && (!displayName || displayName.length > 120)) {
      throw new Error("displayName must contain 1 to 120 characters");
    }
    if (bio && bio.length > 280) {
      throw new Error("bio cannot exceed 280 characters");
    }
    if (input.avatarUrl !== undefined && input.avatarUrl.trim().length === 0) {
      throw new Error("avatarUrl must not be empty");
    }

    if (displayName !== undefined) {
      profile.displayName = displayName;
    }
    if (input.bio !== undefined) {
      profile.bio = bio ?? "";
    }
    if (input.avatarUrl !== undefined) {
      profile.avatarUrl = input.avatarUrl;
    }

    this.poems.forEach((poem) => {
      if (poem.author.id !== profile.id) {
        return;
      }
      poem.author = {
        ...poem.author,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl
      };
    });
    this.drafts.forEach((draft) => {
      draft.collaborators.forEach((collaborator) => {
        if (collaborator.user.id === profile.id) {
          collaborator.user = profileToUser(profile);
        }
      });
    });

    return cloneUserProfile(profile);
  }

  async listUserProfileContent(
    userId: string,
    section: UserProfileContentSection
  ): Promise<UserProfileContentPage> {
    const profile = this.profiles.find((item) => item.id === userId);
    const items =
      section === "saves"
        ? this.listSavedProfileContent(userId)
        : (mockUserProfileContent[userId]?.[section] ?? []);

    return {
      userId,
      section,
      total: profile?.contentCounts[section] ?? items.length,
      items: items.map((item) => ({ ...item, tags: [...item.tags] }))
    };
  }

  async listUserConnections(
    userId: string,
    kind: UserConnectionKind,
    query: UserConnectionQuery = {}
  ): Promise<UserConnectionPage> {
    const profile = this.profiles.find((item) => item.id === userId);
    const items = mockUserConnections[userId]?.[kind] ?? [];
    const offset = Math.max(0, Number(query.cursor ?? 0) || 0);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    return {
      userId,
      kind,
      total: profile?.stats[kind] ?? items.length,
      items: items
        .slice(offset, offset + limit)
        .map((item) => this.withCurrentProfileSummary(item))
    };
  }

  async listThreads(query: ThreadFeedQuery = {}): Promise<PoetryThread[]> {
    const viewerId = query.viewerId;
    let threads = this.threads;

    if (query.sort === "latest") {
      threads = [...threads].sort(
        (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
      );
    } else if (query.sort === "following") {
      threads = threads.filter((thread) => thread.author.id !== viewerId);
    } else {
      threads = [...threads].sort(
        (left, right) =>
          right.metrics.likes +
          right.metrics.continuations * 2 -
          (left.metrics.likes + left.metrics.continuations * 2)
      );
    }

    return threads.map((thread) => this.withThreadViewer(thread, viewerId));
  }

  async getThread(threadId: string, viewerId?: string): Promise<ThreadDetail | null> {
    const thread = this.threads.find((item) => item.id === threadId);
    if (!thread) return null;
    return {
      thread: this.withThreadViewer(thread, viewerId),
      continuations: this.continuations
        .filter((item) => item.threadId === threadId && !item.parentContinuationId)
        .map((item) => this.withContinuationViewer(item, viewerId))
    };
  }

  async getContinuationDetail(
    continuationId: string,
    viewerId?: string
  ): Promise<ContinuationDetail | null> {
    const current = this.continuations.find((item) => item.id === continuationId);
    if (!current) return null;
    const thread = this.threads.find((item) => item.id === current.threadId);
    if (!thread) return null;

    return {
      thread: this.withThreadViewer(thread, viewerId),
      path: this.getContinuationPath(current).map((item) =>
        this.withContinuationViewer(item, viewerId)
      ),
      current: this.withContinuationViewer(current, viewerId),
      children: this.continuations
        .filter((item) => item.parentContinuationId === continuationId)
        .map((item) => this.withContinuationViewer(item, viewerId))
    };
  }

  async createThreadContinuation(
    input: CreateThreadContinuationInput
  ): Promise<ThreadContinuation> {
    const thread = this.threads.find((item) => item.id === input.threadId);
    const author = this.profiles.find((profile) => profile.id === input.userId);
    const content = input.content.trim();
    if (!thread || !author || content.length === 0) {
      throw new Error("Thread continuation cannot be created");
    }

    const continuation = this.createContinuationRecord({
      threadId: thread.id,
      author: profileToUser(author),
      content
    });
    thread.metrics.continuations += 1;
    return this.withContinuationViewer(continuation, input.userId);
  }

  async createContinuation(input: CreateContinuationInput): Promise<ThreadContinuation> {
    const parent = this.continuations.find((item) => item.id === input.continuationId);
    const author = this.profiles.find((profile) => profile.id === input.userId);
    const content = input.content.trim();
    if (!parent || !author || content.length === 0) {
      throw new Error("Continuation cannot be created");
    }

    const continuation = this.createContinuationRecord({
      threadId: parent.threadId,
      parentContinuationId: parent.id,
      author: profileToUser(author),
      content
    });
    parent.metrics.continuations += 1;
    const thread = this.threads.find((item) => item.id === parent.threadId);
    if (thread) thread.metrics.continuations += 1;
    return this.withContinuationViewer(continuation, input.userId);
  }

  async setThreadLike(input: UpdateThreadLikeInput): Promise<PoetryThread> {
    const thread = this.threads.find((item) => item.id === input.threadId);
    if (!thread) throw new Error(`Thread ${input.threadId} was not found`);
    const liked = this.getLikedThreadSet(input.userId);
    const wasActive = liked.has(input.threadId);
    if (wasActive !== input.isActive) {
      input.isActive ? liked.add(input.threadId) : liked.delete(input.threadId);
      thread.metrics.likes = Math.max(0, thread.metrics.likes + (input.isActive ? 1 : -1));
    }
    return this.withThreadViewer(thread, input.userId);
  }

  async setContinuationLike(
    input: UpdateContinuationLikeInput
  ): Promise<ThreadContinuation> {
    const continuation = this.continuations.find((item) => item.id === input.continuationId);
    if (!continuation) throw new Error(`Continuation ${input.continuationId} was not found`);
    const liked = this.getLikedContinuationSet(input.userId);
    const wasActive = liked.has(input.continuationId);
    if (wasActive !== input.isActive) {
      input.isActive ? liked.add(input.continuationId) : liked.delete(input.continuationId);
      continuation.metrics.likes = Math.max(
        0,
        continuation.metrics.likes + (input.isActive ? 1 : -1)
      );
    }
    return this.withContinuationViewer(continuation, input.userId);
  }

  async recordThreadShare(target: ThreadShareTarget): Promise<ThreadShareResult> {
    if (target.kind === "thread") {
      const thread = this.threads.find((item) => item.id === target.threadId);
      if (!thread) throw new Error(`Thread ${target.threadId} was not found`);
      thread.metrics.shares += 1;
      return { targetId: thread.id, shareCount: thread.metrics.shares };
    }

    const continuation = this.continuations.find(
      (item) => item.id === target.continuationId
    );
    if (!continuation) throw new Error(`Continuation ${target.continuationId} was not found`);
    continuation.metrics.shares += 1;
    return { targetId: continuation.id, shareCount: continuation.metrics.shares };
  }

  async requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse> {
    return {
      id: `mock-ai-${Date.now()}`,
      intent: request.intent,
      suggestions: [
        "Let the next line introduce a concrete image before returning to abstraction.",
        "Consider shortening the second line so the rhythm lands more sharply."
      ],
      usage: {
        inputTokens: 0,
        outputTokens: 0
      }
    };
  }

  private getOrCreateCollections(userId: string): MutableUserCollections {
    const existing = this.collectionsByUser.get(userId);
    if (existing) {
      return existing;
    }

    const created: MutableUserCollections = {
      liked: new Set<string>(),
      saved: new Set(
        (mockUserProfileContent[userId]?.saves ?? [])
          .map((item) => item.poemId)
          .filter((poemId): poemId is string => Boolean(poemId))
      )
    };
    this.collectionsByUser.set(userId, created);
    return created;
  }

  private snapshotCollections(
    userId: string,
    collections: MutableUserCollections
  ): UserPoemCollections {
    return {
      userId,
      likedPoemIds: [...collections.liked],
      savedPoemIds: [...collections.saved]
    };
  }

  private withViewer(poem: PoemSummary, viewerId?: string): PoemSummary {
    const collections = viewerId ? this.getOrCreateCollections(viewerId) : undefined;
    return {
      ...hydratePoem(poem, this.profiles),
      viewer: {
        liked: collections?.liked.has(poem.id) ?? false,
        saved: collections?.saved.has(poem.id) ?? false
      }
    };
  }

  private listSavedProfileContent(userId: string) {
    const savedIds = this.getOrCreateCollections(userId).saved;
    const samples = mockUserProfileContent[userId]?.saves ?? [];
    const samplePoemIds = new Set(samples.map((item) => item.poemId));
    const dynamicItems = this.poems
      .filter((poem) => savedIds.has(poem.id) && !samplePoemIds.has(poem.id))
      .map(profileContentFromPoem);

    return [
      ...samples.filter((item) => item.poemId && savedIds.has(item.poemId)),
      ...dynamicItems
    ];
  }

  private withCurrentProfileSummary(item: UserConnectionPage["items"][number]) {
    const current = this.profiles.find((profile) => profile.id === item.id);
    return current
      ? {
          ...item,
          displayName: current.displayName,
          bio: current.bio,
          avatarColor: current.avatarColor,
          avatarUrl: current.avatarUrl
        }
      : { ...item };
  }

  private requireEditableDraft(draftId: string, userId: string) {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} was not found`);
    }
    if (!draft.collaborators.some((item) => item.user.id === userId)) {
      throw new Error(`User ${userId} cannot edit draft ${draftId}`);
    }
    return draft;
  }

  private createContinuationRecord(input: {
    threadId: string;
    parentContinuationId?: string;
    author: UserProfile;
    content: string;
  }) {
    const continuation: ThreadContinuation = {
      id: `continue-new-${++this.continuationSequence}`,
      threadId: input.threadId,
      parentContinuationId: input.parentContinuationId,
      author: { ...input.author },
      content: input.content,
      createdAt: new Date().toISOString(),
      metrics: { likes: 0, continuations: 0, shares: 0 },
      viewer: { liked: false }
    };
    this.continuations.unshift(continuation);
    return continuation;
  }

  private getContinuationPath(current: ThreadContinuation) {
    const path: ThreadContinuation[] = [];
    let parentId = current.parentContinuationId;
    while (parentId) {
      const parent = this.continuations.find((item) => item.id === parentId);
      if (!parent || path.some((item) => item.id === parent.id)) break;
      path.unshift(parent);
      parentId = parent.parentContinuationId;
    }
    return path;
  }

  private getLikedThreadSet(userId: string) {
    const existing = this.likedThreadsByUser.get(userId);
    if (existing) return existing;
    const created = new Set(
      this.threads.filter((thread) => thread.viewer.liked).map((thread) => thread.id)
    );
    this.likedThreadsByUser.set(userId, created);
    return created;
  }

  private getLikedContinuationSet(userId: string) {
    const existing = this.likedContinuationsByUser.get(userId);
    if (existing) return existing;
    const created = new Set(
      this.continuations
        .filter((continuation) => continuation.viewer.liked)
        .map((continuation) => continuation.id)
    );
    this.likedContinuationsByUser.set(userId, created);
    return created;
  }

  private withThreadViewer(thread: PoetryThread, viewerId?: string): PoetryThread {
    const liked = viewerId ? this.getLikedThreadSet(viewerId).has(thread.id) : false;
    return {
      ...cloneThread(thread),
      author: profileToUser(findProfile(this.profiles, thread.author)),
      viewer: { liked }
    };
  }

  private withContinuationViewer(
    continuation: ThreadContinuation,
    viewerId?: string
  ): ThreadContinuation {
    const liked = viewerId
      ? this.getLikedContinuationSet(viewerId).has(continuation.id)
      : false;
    return {
      ...cloneContinuation(continuation),
      author: profileToUser(findProfile(this.profiles, continuation.author)),
      viewer: { liked }
    };
  }
}

function cloneThread(thread: PoetryThread): PoetryThread {
  return {
    ...thread,
    author: { ...thread.author },
    cover: thread.cover ? { ...thread.cover } : undefined,
    metrics: { ...thread.metrics },
    viewer: { ...thread.viewer }
  };
}

function cloneContinuation(continuation: ThreadContinuation): ThreadContinuation {
  return {
    ...continuation,
    author: { ...continuation.author },
    metrics: { ...continuation.metrics },
    viewer: { ...continuation.viewer }
  };
}

function clonePoem(poem: PoemSummary): PoemSummary {
  return {
    ...poem,
    author: { ...poem.author },
    metrics: { ...poem.metrics },
    viewer: { ...poem.viewer },
    credits: poem.credits
      ? {
          startedBy: { ...poem.credits.startedBy },
          commentContributors: poem.credits.commentContributors.map((person) => ({ ...person })),
          quoteContributors: poem.credits.quoteContributors.map((person) => ({ ...person }))
        }
      : undefined,
    comments: poem.comments?.map((comment) => ({
      ...comment,
      author: { ...comment.author }
    }))
  };
}

function hydratePoem(poem: PoemSummary, profiles: UserProfileDetails[]) {
  const hydrated = clonePoem(poem);
  hydrated.author = profileToUser(findProfile(profiles, poem.author));
  hydrated.comments = hydrated.comments?.map((comment) => ({
    ...comment,
    author: profileToUser(findProfile(profiles, comment.author))
  }));
  if (hydrated.credits) {
    hydrated.credits = {
      startedBy: hydrateCreditPerson(hydrated.credits.startedBy, profiles),
      commentContributors: hydrated.credits.commentContributors.map((person) =>
        hydrateCreditPerson(person, profiles)
      ),
      quoteContributors: hydrated.credits.quoteContributors.map((person) =>
        hydrateCreditPerson(person, profiles)
      )
    };
  }
  return hydrated;
}

function findProfile(profiles: UserProfileDetails[], user: UserProfile) {
  return profiles.find((profile) => profile.id === user.id) ?? user;
}

function hydrateCreditPerson(person: PoemCreditPerson, profiles: UserProfileDetails[]) {
  const profile = profiles.find(
    (candidate) => candidate.handle.toLowerCase() === person.handle.toLowerCase()
  );
  return profile ? profileToCreditPerson(profile) : { ...person };
}

function cloneUserProfile(profile: UserProfileDetails): UserProfileDetails {
  return {
    ...profile,
    badges: profile.badges.map((badge) => ({ ...badge })),
    stats: { ...profile.stats },
    contentCounts: { ...profile.contentCounts }
  };
}

function profileContentFromPoem(poem: PoemSummary) {
  return {
    id: `saved-${poem.id}`,
    poemId: poem.id,
    title: poem.title,
    excerpt: poem.lines[0] ?? "",
    tags: [...poem.tags],
    finishedAt: poem.startedAt,
    highlightCount: poem.metrics.likes
  };
}

function profileToUser(profile: UserProfileDetails | UserProfile) {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarColor: profile.avatarColor,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio
  };
}

function profileToCreditPerson(profile: UserProfileDetails | UserProfile): PoemCreditPerson {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    avatarColor: profile.avatarColor,
    avatarUrl: profile.avatarUrl
  };
}

function cloneLayout(layout: PoemDraft["layout"]): PoemDraft["layout"] {
  return { ...layout, stickerIds: [...layout.stickerIds] };
}

function cloneDraft(draft: PoemDraft): PoemDraft {
  return {
    ...draft,
    tags: [...draft.tags],
    media: draft.media ? { ...draft.media } : undefined,
    settings: { ...draft.settings },
    layout: cloneLayout(draft.layout),
    collaborators: draft.collaborators.map((item) => ({
      ...item,
      user: { ...item.user }
    }))
  };
}

function cloneDesignCatalog(catalog: PoemDesignCatalog): PoemDesignCatalog {
  return {
    templates: catalog.templates.map((item) => ({
      ...item,
      layout: cloneLayout(item.layout)
    })),
    typography: catalog.typography.map((item) => ({ ...item })),
    backgrounds: catalog.backgrounds.map((item) => ({ ...item })),
    stickers: catalog.stickers.map((item) => ({ ...item }))
  };
}

export function createMockLineSpaceApi(): LineSpaceApi {
  return new MockLineSpaceApi();
}
