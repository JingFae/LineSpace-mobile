import {
  mockPoems,
  mockInboxActivitySummaries,
  mockPoemDesignCatalog,
  mockThreadContinuations,
  mockThreads,
  mockUsers,
  mockUserConnections,
  mockUserProfileContent,
  mockUserProfileDetails
} from "./mock-data";
import type {
  AiAssistRequest,
  AiAssistResponse,
  CreatePoemCommentInput,
  ContinuationDetail,
  CreateContinuationInput,
  CreatePoemDraftInput,
  CreateThreadContinuationInput,
  DraftInvitation,
  DraftOperationInput,
  FeedQuery,
  InboxActivitySummary,
  InviteDraftCollaboratorInput,
  PoemCollectionKind,
  PoemComment,
  PoemCreditPerson,
  PoemDesignCatalog,
  PoemDraft,
  PoemEngagementResult,
  PoemCommentEngagementResult,
  PoetryThread,
  PublishPoemDraftInput,
  PublishPoemDraftResult,
  PublishThreadDraftInput,
  PublishThreadDraftResult,
  SharePoemInput,
  SharePoemResult,
  SavePoemDraftInput,
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
  UserProfileContentQuery,
  UserProfileContentSection,
  UserProfileDetails,
  UserSearchQuery,
  UserSearchPage,
  InboxConversationMessage,
  UpdateCommentCollectionInput,
  UserDraftPage,
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
  publishThreadDraft(input: PublishThreadDraftInput): Promise<PublishThreadDraftResult>;
  savePoemDraft(input: SavePoemDraftInput): Promise<PoemDraft>;
  listUserDrafts(userId: string): Promise<UserDraftPage>;
  listFeed(query?: FeedQuery): Promise<PoemSummary[]>;
  getPoem(id: string, viewerId?: string): Promise<PoemSummary | null>;
  setPoemCollection(input: UpdatePoemCollectionInput): Promise<PoemEngagementResult>;
  getUserPoemCollections(userId: string): Promise<UserPoemCollections>;
  getInboxActivitySummary(userId: string): Promise<InboxActivitySummary>;
  getUserProfile(userId: string): Promise<UserProfileDetails | null>;
  updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfileDetails>;
  listUserProfileContent(
    userId: string,
    section: UserProfileContentSection,
    query?: UserProfileContentQuery
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
  createPoemComment(input: CreatePoemCommentInput): Promise<PoemComment>;
  setCommentCollection(input: UpdateCommentCollectionInput): Promise<PoemCommentEngagementResult>;
  searchUsers(query: string, viewerId: string, options?: UserSearchQuery): Promise<UserSearchPage>;
  sharePoem(input: SharePoemInput): Promise<SharePoemResult>;
  listInboxMessages(userId: string, contactId: string): Promise<InboxConversationMessage[]>;
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
  private readonly commentLikesByUser = new Map<string, Set<string>>();
  private readonly commentSavesByUser = new Map<string, Set<string>>();
  private readonly inboxMessages: InboxConversationMessage[] = [];
  private draftSequence = 0;
  private continuationSequence = 0;
  private shareSequence = 0;
  private threadSequence = 0;

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
      mentions: [],
      settings: {
        declareOriginal: false,
        isPublic: true,
        visibility: "public",
        audienceUserIds: [],
        allowComments: true,
        allowQuotes: true,
        allowSharing: true,
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
    if (input.mentions !== undefined) draft.mentions = [...input.mentions];
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
    if (draft.mode === "relay") throw new Error("Relay drafts must be published as threads");
    const owner = this.profiles.find((profile) => profile.id === draft.ownerId)!;
    const now = new Date().toISOString();
    const poem: PoemSummary = {
      id: `poem-${draft.id}`,
      title: draft.title.trim() || "untitled line",
      lines: draft.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      author: profileToUser(owner),
      contributorsCount: draft.collaborators.length,
      tags: [...draft.tags],
      mentions: [...draft.mentions],
      visibility: draft.settings.visibility,
      audienceUserIds: [...draft.settings.audienceUserIds],
      declareOriginal: draft.settings.declareOriginal,
      allowComments: draft.settings.allowComments,
      allowSharing: draft.settings.allowSharing,
      status: "growing",
      startedAt: draft.createdAt,
      editedAt: now,
      metrics: { comments: 0, likes: 0, shares: 0, contributions: 0, saves: 0 },
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
    const profileContent = mockUserProfileContent[owner.id];
    if (profileContent) {
      profileContent.posts.unshift({
        id: `profile-${poem.id}`,
        kind: "post",
        poemId: poem.id,
        title: poem.title,
        excerpt: poem.lines[0] ?? "",
        tags: [...poem.tags],
        finishedAt: now,
        highlightCount: 0
      });
      owner.contentCounts.posts += 1;
    }
    return { draft: cloneDraft(draft), poem: clonePoem(poem) };
  }

  async publishThreadDraft(input: PublishThreadDraftInput): Promise<PublishThreadDraftResult> {
    const draft = this.requireEditableDraft(input.draftId, input.userId);
    if (draft.mode !== "relay") throw new Error("Post drafts must be published as posts");
    const owner = this.profiles.find((profile) => profile.id === draft.ownerId);
    if (!owner) throw new Error("Thread owner was not found");
    const now = new Date().toISOString();
    const thread: PoetryThread = {
      id: `thread-draft-${++this.threadSequence}`,
      author: profileToUser(owner),
      title: draft.title.trim() || undefined,
      content: draft.body.trim() || "A new poem relay is waiting for its first line.",
      rules: draft.body.trim() || undefined,
      tags: [...draft.tags],
      mentions: [...draft.mentions],
      visibility: draft.settings.visibility,
      audienceUserIds: [...draft.settings.audienceUserIds],
      createdAt: now,
      topic: draft.tags[0],
      status: "open",
      cover: { tone: draft.layout.backgroundId === "midnight" ? "night" : "paper" },
      metrics: { likes: 0, continuations: 0, shares: 0 },
      viewer: { liked: false }
    };
    draft.status = "published";
    draft.updatedAt = now;
    draft.version += 1;
    this.threads.unshift(thread);
    const profileContent = mockUserProfileContent[owner.id];
    if (profileContent) {
      profileContent.threads.unshift({
        id: `profile-${thread.id}`,
        kind: "thread",
        threadId: thread.id,
        title: thread.title ?? "Untitled poem relay",
        excerpt: thread.content,
        tags: [...thread.tags ?? []],
        finishedAt: now,
        highlightCount: 0,
        threadRelation: "started"
      });
      owner.contentCounts.threads += 1;
    }
    return { draft: cloneDraft(draft), thread: cloneThread(thread) };
  }

  async savePoemDraft(input: SavePoemDraftInput): Promise<PoemDraft> {
    const draft = this.requireEditableDraft(input.draftId, input.userId);
    if (draft.status === "published") {
      throw new Error("A published draft cannot be saved again");
    }
    draft.status = "ready";
    draft.updatedAt = new Date().toISOString();
    draft.version += 1;
    return cloneDraft(draft);
  }

  async listUserDrafts(userId: string): Promise<UserDraftPage> {
    const items = [...this.drafts.values()]
      .filter(
        (draft) =>
          draft.ownerId === userId &&
          draft.status !== "published" &&
          draft.collaborators.some((collaborator) => collaborator.user.id === userId)
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map(cloneDraft);
    return { userId, total: items.length, items };
  }

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const { filter, viewerId } = query;
    let poems = this.poems.filter((poem) => canViewContent(poem.visibility, poem.audienceUserIds, poem.author.id, viewerId));

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
    return poem && canViewContent(poem.visibility, poem.audienceUserIds, poem.author.id, viewerId) ? this.withViewer(poem, viewerId) : null;
  }

  async createPoemComment(input: CreatePoemCommentInput): Promise<PoemComment> {
    const poem = this.poems.find((item) => item.id === input.poemId);
    const author = this.findAnyProfile(input.userId);
    const body = input.body.trim();
    if (!poem || !author || !body) throw new Error("Comment cannot be created");
    const now = new Date().toISOString();
    const comment: PoemComment = {
      id: `comment-${input.poemId}-${Date.now()}`,
      author: profileToUser(author),
      dateLabel: "just now",
      createdAt: now,
      body,
      level: author.level,
      likes: 0,
      viewer: { liked: false, saved: false },
      parentCommentId: input.parentCommentId
    };
    poem.comments = [...(poem.comments ?? []), comment];
    poem.metrics.comments += 1;
    const profile = this.profiles.find((item) => item.id === input.userId);
    if (profile) profile.contentCounts.comments += 1;
    return cloneComment(comment);
  }

  async setCommentCollection(input: UpdateCommentCollectionInput): Promise<PoemCommentEngagementResult> {
    const poem = this.poems.find((item) => item.id === input.poemId);
    const comment = poem?.comments?.find((item) => item.id === input.commentId);
    if (!poem || !comment) throw new Error(`Comment ${input.commentId} was not found`);
    const store = input.collection === "liked" ? this.commentLikesByUser : this.commentSavesByUser;
    const current = store.get(input.userId) ?? new Set<string>();
    const key = `${input.poemId}:${input.commentId}`;
    const wasActive = current.has(key);
    if (wasActive !== input.isActive) {
      input.isActive ? current.add(key) : current.delete(key);
      store.set(input.userId, current);
      if (input.collection === "liked") comment.likes = Math.max(0, (comment.likes ?? 0) + (input.isActive ? 1 : -1));
      if (input.collection === "saved") {
        const profile = this.profiles.find((item) => item.id === input.userId);
        if (profile) profile.contentCounts.saves = Math.max(0, profile.contentCounts.saves + (input.isActive ? 1 : -1));
      }
    }
    comment.viewer = {
      liked: this.commentLikesByUser.get(input.userId)?.has(key) ?? false,
      saved: this.commentSavesByUser.get(input.userId)?.has(key) ?? false
    };
    return { poem: this.withViewer(poem, input.userId), comment: cloneComment(comment) };
  }

  async searchUsers(query: string, viewerId: string, options: UserSearchQuery = {}): Promise<UserSearchPage> {
    const normalized = query.trim().toLowerCase();
    const limit = clampSearchLimit(options.limit);
    const offset = parseSearchCursor(options.cursor);
    const all = this.getAllProfiles()
      .filter((profile) => profile.id !== viewerId)
      .map((profile) => ({
        ...profileToUser(profile),
        isFriend: profile.id === "user-ray" || profile.id === "user-lili",
        hasRecentChat: this.inboxMessages.some((message) =>
          (message.sender.id === viewerId && message.recipient.id === profile.id) ||
          (message.recipient.id === viewerId && message.sender.id === profile.id)
        )
      }))
      .filter((profile) => !normalized || `${profile.displayName} ${profile.handle}`.toLowerCase().includes(normalized));
    const results = normalized ? all : [];
    const page = results.slice(offset, offset + limit);
    return {
      query,
      recent: all.filter((profile) => profile.hasRecentChat).slice(0, 8),
      friends: all.filter((profile) => profile.isFriend).slice(0, 8),
      results: page,
      nextCursor: offset + page.length < results.length ? String(offset + page.length) : null
    };
  }

  async sharePoem(input: SharePoemInput): Promise<SharePoemResult> {
    const poem = this.poems.find((item) => item.id === input.poemId);
    const sender = this.findAnyProfile(input.senderId);
    const recipients = [...new Set(input.recipientIds)].map((id) => this.findAnyProfile(id)).filter((profile): profile is UserProfileDetails => Boolean(profile));
    if (!poem || !sender || recipients.length === 0) throw new Error("A post and at least one recipient are required");
    poem.metrics.shares = (poem.metrics.shares ?? 0) + recipients.length;
    const messages = recipients.map((recipient) => {
      const message: InboxConversationMessage = {
        id: `shared-${++this.shareSequence}`,
        sender: profileToUser(sender),
        recipient: profileToUser(recipient),
        createdAt: new Date().toISOString(),
        kind: "shared-post",
        text: input.note?.trim() || undefined,
        sharedPost: {
          id: poem.id,
          title: poem.title,
          excerpt: poem.lines[0] ?? "",
          tags: [...poem.tags],
          author: profileToUser(this.findAnyProfile(poem.author.id) ?? poem.author),
          artworkUrl: poem.artworkUrl
        }
      };
      this.inboxMessages.unshift(message);
      return cloneInboxMessage(message);
    });
    return { poemId: poem.id, recipientIds: recipients.map((recipient) => recipient.id), messages };
  }

  async listInboxMessages(userId: string, contactId: string): Promise<InboxConversationMessage[]> {
    return this.inboxMessages
      .filter((message) =>
        (message.sender.id === userId && message.recipient.id === contactId) ||
        (message.recipient.id === userId && message.sender.id === contactId)
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .map(cloneInboxMessage);
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

  async getInboxActivitySummary(userId: string): Promise<InboxActivitySummary> {
    const profile = this.profiles.find((item) => item.id === userId);
    const explicit = mockInboxActivitySummaries[userId];
    const totals = explicit?.totals ?? this.deriveInboxTotals(userId);
    const unread = explicit?.unread ?? totals;

    return {
      userId: profile?.id ?? userId,
      unread: { ...unread },
      totals: { ...totals },
      recent: explicit
        ? {
            comments: explicit.recent.comments.map((item) => ({ ...item, actor: { ...item.actor }, target: { ...item.target } })),
            likes: explicit.recent.likes.map((item) => ({ ...item, actor: { ...item.actor }, target: { ...item.target } })),
            thread: explicit.recent.thread.map((item) => ({ ...item, actor: { ...item.actor }, target: { ...item.target } }))
          }
        : { comments: [], likes: [], thread: [] }
    };
  }

  async getUserProfile(userId: string): Promise<UserProfileDetails | null> {
    const profile = this.profiles.find((item) => item.id === userId);
    if (profile) return cloneUserProfile(profile);
    const identity = [
      ...this.threads.map((thread) => thread.author),
      ...this.continuations.map((continuation) => continuation.author)
    ].find((user) => user.id === userId);
    if (!identity) return null;
    return {
      ...identity,
      linespaceId: `guest_${identity.id.replace(/[^a-z0-9]/gi, "").slice(-8)}`,
      level: 1,
      badges: [],
      stats: { followers: 0, following: 0, likesAndSaves: 0 },
      contentCounts: { posts: 0, threads: 0, comments: 0, saves: 0 },
      visibility: { posts: true, threads: true, comments: true, saves: true }
    };
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
    if (input.visibility) {
      profile.visibility = { ...profile.visibility, ...input.visibility };
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
    section: UserProfileContentSection,
    query: UserProfileContentQuery = {}
  ): Promise<UserProfileContentPage> {
    const profile = this.profiles.find((item) => item.id === userId);
    const visible = profile?.visibility[section] ?? true;
    const isOwner = !query.viewerId || query.viewerId === userId;
    if (!isOwner && !visible) {
      return { userId, section, total: 0, items: [], visible: false };
    }
    let items = mockUserProfileContent[userId]?.[section] ?? [];
    if (section === "threads") {
      const dynamicThreads = this.threads
        .filter((thread) => thread.author.id === userId)
        .map((thread) => profileContentFromThread(thread, "started"));
      const dynamicParticipations = this.continuations
        .filter((continuation) => continuation.author.id === userId)
        .map((continuation) => profileContentFromThread(this.threads.find((thread) => thread.id === continuation.threadId), "participated", continuation.content));
      items = [...items, ...dynamicThreads, ...dynamicParticipations];
    }
    if (section === "saves") {
      items = this.listSavedProfileContent(userId, query.collection, query.contentKind);
    }
    if (section === "threads" && query.threadRelation) {
      items = items.filter((item) => item.threadRelation === query.threadRelation);
    }
    if (section === "saves" && query.collection) {
      items = items.filter((item) => item.collection === query.collection);
    }
    if (section === "saves" && query.contentKind) {
      items = items.filter((item) => item.kind === query.contentKind);
    }

    return {
      userId,
      section,
      total: profile?.contentCounts[section] ?? items.length,
      items: items.map((item) => ({ ...item, tags: [...item.tags], reference: item.reference ? { ...item.reference } : undefined })),
      visible: true
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
    let threads = this.threads.filter((thread) => canViewContent(thread.visibility, thread.audienceUserIds, thread.author.id, viewerId));

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
    if (!thread || !canViewContent(thread.visibility, thread.audienceUserIds, thread.author.id, viewerId)) return null;
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
    if (!thread || !canViewContent(thread.visibility, thread.audienceUserIds, thread.author.id, viewerId)) return null;

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
    if (!thread || !author || !canViewContent(thread.visibility, thread.audienceUserIds, thread.author.id, input.userId) || content.length === 0) {
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
          .filter((item) => item.collection !== "liked")
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
    const hydrated = hydratePoem(poem, this.profiles);
    hydrated.comments = hydrated.comments?.map((comment) => {
      const key = `${poem.id}:${comment.id}`;
      return {
        ...comment,
        viewer: {
          liked: viewerId ? this.commentLikesByUser.get(viewerId)?.has(key) ?? false : false,
          saved: viewerId ? this.commentSavesByUser.get(viewerId)?.has(key) ?? false : false
        }
      };
    });
    return {
      ...hydrated,
      viewer: {
        liked: collections?.liked.has(poem.id) ?? false,
        saved: collections?.saved.has(poem.id) ?? false
      }
    };
  }

  private listSavedProfileContent(
    userId: string,
    collection?: "liked" | "saved",
    contentKind?: "post" | "thread" | "comment"
  ) {
    const savedIds = this.getOrCreateCollections(userId).saved;
    const samples = mockUserProfileContent[userId]?.saves ?? [];
    const samplePoemIds = new Set(samples.map((item) => item.poemId));
    const dynamicItems = this.poems
      .filter((poem) => savedIds.has(poem.id) && !samplePoemIds.has(poem.id))
      .map(profileContentFromPoem);
    const commentKeys = collection === "liked"
      ? this.commentLikesByUser.get(userId) ?? new Set<string>()
      : this.commentSavesByUser.get(userId) ?? new Set<string>();
    const dynamicComments = [...commentKeys].flatMap((key) => {
      const separator = key.indexOf(":");
      const poemId = key.slice(0, separator);
      const commentId = key.slice(separator + 1);
      const poem = this.poems.find((item) => item.id === poemId);
      const comment = poem?.comments?.find((item) => item.id === commentId);
      if (!poem || !comment) return [];
      return [{
        id: `${collection ?? "saved"}-${comment.id}`,
        kind: "comment" as const,
        poemId,
        commentId,
        title: `comment · ${poem.title}`,
        excerpt: comment.body,
        tags: [...poem.tags],
        finishedAt: comment.createdAt ?? poem.startedAt,
        highlightCount: comment.likes ?? 0,
        collection: (collection ?? "saved") as "liked" | "saved",
        reference: { kind: "post" as const, text: poem.title }
      }];
    });

    const items = [
      ...samples.filter((item) =>
        collection === "liked"
          ? item.collection === "liked"
          : item.poemId && savedIds.has(item.poemId)
      ),
      ...dynamicItems,
      ...dynamicComments
    ];
    return items.filter((item) => {
      if (collection && item.collection !== collection) return false;
      if (contentKind && item.kind !== contentKind) return false;
      return true;
    });
  }

  private deriveInboxTotals(userId: string): InboxActivitySummary["totals"] {
    const profile = this.profiles.find((item) => item.id === userId);
    const authoredPoems = this.poems.filter((poem) => poem.author.id === userId);
    const comments = authoredPoems.reduce(
      (total, poem) => total + (poem.metrics.comments ?? poem.comments?.length ?? 0),
      profile?.contentCounts.comments ?? 0
    );
    const likes = authoredPoems.reduce(
      (total, poem) => total + poem.metrics.likes,
      profile?.stats.likesAndSaves ?? 0
    );
    const thread = authoredPoems.reduce(
      (total, poem) => total + (poem.metrics.commentThreads ?? 0),
      0
    );

    return { comments, likes, thread };
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

  private getAllProfiles(): UserProfileDetails[] {
    const identities: UserProfile[] = [
      ...mockUsers,
      ...this.poems.flatMap((poem) => [poem.author, ...(poem.comments ?? []).map((comment) => comment.author)]),
      ...this.threads.map((thread) => thread.author),
      ...this.continuations.map((continuation) => continuation.author)
    ];
    const result = [...this.profiles];
    for (const identity of identities) {
      if (result.some((profile) => profile.id === identity.id)) continue;
      result.push({
        ...identity,
        linespaceId: `guest_${identity.id.replace(/[^a-z0-9]/gi, "").slice(-8)}`,
        level: 1,
        badges: [],
        stats: { followers: 0, following: 0, likesAndSaves: 0 },
        contentCounts: { posts: 0, threads: 0, comments: 0, saves: 0 },
        visibility: { posts: true, threads: true, comments: true, saves: true }
      });
    }
    return result;
  }

  private findAnyProfile(userId: string) {
    return this.getAllProfiles().find((profile) => profile.id === userId);
  }
}

function cloneThread(thread: PoetryThread): PoetryThread {
  return {
    ...thread,
    author: { ...thread.author },
    tags: thread.tags ? [...thread.tags] : undefined,
    mentions: thread.mentions ? [...thread.mentions] : undefined,
    audienceUserIds: thread.audienceUserIds ? [...thread.audienceUserIds] : undefined,
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

function cloneComment(comment: PoemComment): PoemComment {
  return {
    ...comment,
    author: { ...comment.author },
    viewer: comment.viewer ? { ...comment.viewer } : undefined
  };
}

function cloneInboxMessage(message: InboxConversationMessage): InboxConversationMessage {
  return {
    ...message,
    sender: { ...message.sender },
    recipient: { ...message.recipient },
    sharedPost: message.sharedPost
      ? {
          ...message.sharedPost,
          author: { ...message.sharedPost.author },
          tags: [...message.sharedPost.tags]
        }
      : undefined
  };
}

function clonePoem(poem: PoemSummary): PoemSummary {
  return {
    ...poem,
    author: { ...poem.author },
    tags: [...poem.tags],
    mentions: poem.mentions ? [...poem.mentions] : undefined,
    audienceUserIds: poem.audienceUserIds ? [...poem.audienceUserIds] : undefined,
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
  hydrated.editedAt = hydrated.editedAt ?? hydrated.startedAt;
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
    contentCounts: { ...profile.contentCounts },
    visibility: { ...profile.visibility }
  };
}

function profileContentFromPoem(poem: PoemSummary) {
  return {
    id: `saved-${poem.id}`,
    kind: "post" as const,
    poemId: poem.id,
    title: poem.title,
    excerpt: poem.lines[0] ?? "",
    tags: [...poem.tags],
    finishedAt: poem.startedAt,
    highlightCount: poem.metrics.likes,
    collection: "saved" as const
  };
}

function profileContentFromThread(
  thread: PoetryThread | undefined,
  relation: "started" | "participated",
  excerpt?: string
) {
  return {
    id: `profile-${relation}-${thread?.id ?? "thread"}-${excerpt ? excerpt.slice(0, 8) : "root"}`,
    kind: "thread" as const,
    threadId: thread?.id,
    title: thread?.content.slice(0, 52) ?? "Untitled thread",
    excerpt: excerpt ?? thread?.content ?? "",
    tags: thread?.topic ? [thread.topic] : [],
    finishedAt: thread?.createdAt ?? new Date().toISOString(),
    highlightCount: thread?.metrics.likes ?? 0,
    threadRelation: relation
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

function canViewContent(visibility: PoemSummary["visibility"], audienceUserIds: string[] | undefined, ownerId: string, viewerId: string | undefined) {
  if (!visibility || visibility === "public") return true;
  if (viewerId === ownerId) return true;
  const selected = audienceUserIds ?? [];
  return visibility === "include" ? Boolean(viewerId && selected.includes(viewerId)) : Boolean(!viewerId || !selected.includes(viewerId));
}

function clampSearchLimit(value: number | undefined) {
  return Number.isInteger(value) ? Math.min(50, Math.max(1, value as number)) : 20;
}

function parseSearchCursor(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function cloneDraft(draft: PoemDraft): PoemDraft {
  return {
    ...draft,
    tags: [...draft.tags],
    mentions: [...draft.mentions],
    media: draft.media ? { ...draft.media } : undefined,
    settings: { ...draft.settings, audienceUserIds: [...draft.settings.audienceUserIds] },
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
