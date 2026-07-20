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
  CreateInboxGroupInput,
  ContinuationDetail,
  CreateContinuationInput,
  CreatePoemDraftInput,
  CreateStorageUploadInput,
  CreateThreadContinuationInput,
  ContentSearchResult,
  DraftInvitation,
  DraftOperationInput,
  FeedQuery,
  InboxActivitySummary,
  InboxGroup,
  InviteDraftCollaboratorInput,
  InviteInboxGroupMembersInput,
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
  PublishThreadVersionAsPostInput,
  PublishThreadVersionAsPostResult,
  SharePoemInput,
  SharePoemResult,
  SharePoemToGroupInput,
  SendInboxMessageInput,
  StorageUploadTarget,
  SavePoemDraftInput,
  PoemSummary,
  ThreadContinuation,
  ThreadDetail,
  ThreadFeedQuery,
  ThreadShareResult,
  ThreadShareTarget,
  TagContentResult,
  ShareThreadInput,
  ShareThreadToGroupInput,
  UpdateThreadCollectionInput,
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
  UserProfile,
  UserProfileContentPage,
  UserProfileContentQuery,
  UserProfileContentSection,
  UserProfileDetails,
  UserFollowResult,
  UserSearchQuery,
  UserSearchPage,
  InboxConversationMessage,
  RespondInboxGroupInviteInput,
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
  publishThreadVersionAsPost(
    input: PublishThreadVersionAsPostInput
  ): Promise<PublishThreadVersionAsPostResult>;
  savePoemDraft(input: SavePoemDraftInput): Promise<PoemDraft>;
  listUserDrafts(userId: string): Promise<UserDraftPage>;
  createStorageUpload(input: CreateStorageUploadInput): Promise<StorageUploadTarget>;
  listFeed(query?: FeedQuery): Promise<PoemSummary[]>;
  searchContent(query: string, viewerId: string): Promise<ContentSearchResult>;
  listTagContent(tag: string, viewerId: string): Promise<TagContentResult>;
  getPoem(id: string, viewerId?: string): Promise<PoemSummary | null>;
  setPoemCollection(input: UpdatePoemCollectionInput): Promise<PoemEngagementResult>;
  getUserPoemCollections(userId: string): Promise<UserPoemCollections>;
  getInboxActivitySummary(userId: string): Promise<InboxActivitySummary>;
  getUserProfile(userId: string): Promise<UserProfileDetails | null>;
  updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfileDetails>;
  setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult>;
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
  setThreadCollection(input: UpdateThreadCollectionInput): Promise<PoetryThread>;
  recordThreadShare(target: ThreadShareTarget): Promise<ThreadShareResult>;
  shareThread(input: ShareThreadInput): Promise<ThreadShareResult>;
  shareThreadToGroup(input: ShareThreadToGroupInput): Promise<InboxConversationMessage>;
  requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse>;
  createPoemComment(input: CreatePoemCommentInput): Promise<PoemComment>;
  setCommentCollection(input: UpdateCommentCollectionInput): Promise<PoemCommentEngagementResult>;
  searchUsers(query: string, viewerId: string, options?: UserSearchQuery): Promise<UserSearchPage>;
  sharePoem(input: SharePoemInput): Promise<SharePoemResult>;
  sharePoemToGroup(input: SharePoemToGroupInput): Promise<InboxConversationMessage>;
  listInboxMessages(userId: string, contactId: string): Promise<InboxConversationMessage[]>;
  sendInboxMessage(input: SendInboxMessageInput): Promise<InboxConversationMessage>;
  listInboxGroups(userId: string): Promise<InboxGroup[]>;
  listInboxGroupInvites(userId: string): Promise<InboxGroup[]>;
  getInboxGroup(groupId: string, userId: string): Promise<InboxGroup | null>;
  createInboxGroup(input: CreateInboxGroupInput): Promise<InboxGroup>;
  updateInboxGroup(input: UpdateInboxGroupInput): Promise<InboxGroup>;
  inviteInboxGroupMembers(input: InviteInboxGroupMembersInput): Promise<InboxGroup>;
  respondInboxGroupInvite(input: RespondInboxGroupInviteInput): Promise<InboxGroup>;
  listInboxGroupMessages(groupId: string, userId: string): Promise<InboxConversationMessage[]>;
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
  private readonly savedThreadsByUser = new Map<string, Set<string>>();
  private readonly likedContinuationsByUser = new Map<string, Set<string>>();
  private readonly commentLikesByUser = new Map<string, Set<string>>();
  private readonly commentSavesByUser = new Map<string, Set<string>>();
  private readonly inboxMessages: InboxConversationMessage[] = [];
  private readonly inboxGroups = new Map<string, InboxGroup>();
  private readonly inboxGroupMessages: InboxConversationMessage[] = [];
  private readonly experienceEvents = new Set<string>();
  private readonly followingByUser = new Map<string, Set<string>>();
  private draftSequence = 0;
  private continuationSequence = 0;
  private shareSequence = 0;
  private inboxMessageSequence = 0;
  private inboxGroupSequence = 0;
  private threadSequence = 0;

  constructor() {
    this.seedInbox();
  }

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
    if (input.versionLines !== undefined) {
      draft.versionLines = input.versionLines.map((line) => ({
        ...line,
        author: { ...line.author }
      }));
    }
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
      .map((profile) => ({
        ...profileToUser(profile),
        isFollowing: true,
        followsYou: false,
        isFriend: false
      }));
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
      media: draft.media ? { ...draft.media } : undefined,
      layout: cloneLayout(draft.layout),
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
    this.awardExperience(owner.id, "creator", 5, `publish-post:${poem.id}`);
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
    this.awardExperience(owner.id, "creator", 5, `publish-thread:${thread.id}`);
    return { draft: cloneDraft(draft), thread: cloneThread(thread) };
  }

  async publishThreadVersionAsPost(
    input: PublishThreadVersionAsPostInput
  ): Promise<PublishThreadVersionAsPostResult> {
    const thread = this.threads.find((item) => item.id === input.threadId);
    if (!thread || thread.author.id !== input.userId) {
      throw new Error("Only the Thread author can publish this version");
    }
    const postId = `post-from-version-${input.versionId}`;
    const existing = this.poems.find((item) => item.id === postId);
    if (existing) {
      return {
        threadId: thread.id,
        versionId: input.versionId,
        poem: clonePoem(existing)
      };
    }
    const continuationLines = this.continuations
      .filter((item) => item.threadId === thread.id)
      .sort(
        (left, right) =>
          (left.lineNumber ?? 0) - (right.lineNumber ?? 0) ||
          Date.parse(left.createdAt) - Date.parse(right.createdAt)
      );
    const now = new Date().toISOString();
    const poem: PoemSummary = {
      id: postId,
      title: thread.title ?? "Thread version",
      lines: [thread.content, ...continuationLines.map((item) => item.content)],
      author: { ...thread.author },
      contributorsCount: new Set([
        thread.author.id,
        ...continuationLines.map((item) => item.author.id)
      ]).size,
      tags: [...(thread.tags ?? [])],
      mentions: [...(thread.mentions ?? [])],
      visibility: thread.visibility ?? "public",
      audienceUserIds: [],
      declareOriginal: false,
      allowComments: true,
      allowSharing: true,
      status: "final",
      startedAt: now,
      editedAt: now,
      ...(thread.media ? { media: { ...thread.media } } : {}),
      metrics: {
        comments: 0,
        likes: 0,
        shares: 0,
        contributions: continuationLines.length + 1,
        saves: 0
      },
      viewer: { liked: false, saved: false },
      artworkTone: "water"
    };
    this.poems.unshift(poem);
    return {
      threadId: thread.id,
      versionId: input.versionId,
      poem: clonePoem(poem)
    };
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

  async createStorageUpload(
    input: CreateStorageUploadInput
  ): Promise<StorageUploadTarget> {
    return {
      bucket: input.bucket,
      path: input.path,
      token: "mock-upload-token",
      signedUrl: `mock-upload://${input.bucket}/${input.path}`
    };
  }

  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const { filter, viewerId, section } = query;
    let poems = this.poems.filter((poem) => canViewContent(poem.visibility, poem.audienceUserIds, poem.author.id, viewerId));

    if (section === "following" && viewerId) {
      const followingIds = this.getFollowingIds(viewerId);
      poems = poems
        .filter((poem) => followingIds.has(poem.author.id))
        .sort(
          (left, right) =>
            Date.parse(right.editedAt ?? right.startedAt) -
            Date.parse(left.editedAt ?? left.startedAt)
        );
    } else if (section === "popular") {
      poems = [...poems].sort(
        (left, right) => right.metrics.likes - left.metrics.likes
      );
    } else {
      poems = [...poems].sort(
        (left, right) =>
          Date.parse(right.editedAt ?? right.startedAt) -
          Date.parse(left.editedAt ?? left.startedAt)
      );
    }

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

  async searchContent(query: string, viewerId: string): Promise<ContentSearchResult> {
    const normalized = normalizeDiscoveryText(query);
    if (!normalized) return { query: "", posts: [], threads: [], users: [] };
    const [visiblePosts, visibleThreads] = await Promise.all([
      this.listFeed({ section: "latest", viewerId }),
      this.listThreads({ sort: "latest", viewerId })
    ]);
    const posts = visiblePosts.filter((poem) =>
      discoveryIncludes([poem.title, ...poem.lines, ...poem.tags], normalized)
    );
    const threads = visibleThreads.filter((thread) => {
      const continuationText = this.continuations
        .filter((item) => item.threadId === thread.id)
        .map((item) => item.content);
      return discoveryIncludes(
        [thread.title, thread.content, thread.startingContent, thread.rules, ...(thread.tags ?? []), ...continuationText],
        normalized
      );
    });
    const users = this.profiles
      .filter((profile) => discoveryIncludes([profile.handle, profile.displayName], normalized))
      .sort((left, right) => left.handle.localeCompare(right.handle))
      .slice(0, 30)
      .map(profileToUser);
    return { query: query.trim(), posts, threads, users };
  }

  async listTagContent(tag: string, viewerId: string): Promise<TagContentResult> {
    const normalized = normalizeContentTag(tag);
    const [posts, threads] = await Promise.all([
      this.listFeed({ section: "latest", viewerId }),
      this.listThreads({ sort: "latest", viewerId })
    ]);
    return {
      tag: normalized,
      posts: posts.filter((poem) => poem.tags.some((item) => normalizeContentTag(item) === normalized)),
      threads: threads.filter((thread) => (thread.tags ?? []).some((item) => normalizeContentTag(item) === normalized))
    };
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
    if (poem.author.id !== input.userId) {
      this.awardExperience(input.userId, "reviewer", 5, `comment:${comment.id}`);
    }
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
      if (input.isActive && comment.author.id !== input.userId) {
        this.awardExperience(
          comment.author.id,
          "reviewer",
          2,
          `comment-${input.collection}:${input.userId}:${input.commentId}`
        );
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
        isFriend: this.isMutualConnection(viewerId, profile.id),
        hasRecentChat: this.inboxMessages.some((message) =>
          (message.sender.id === viewerId && message.recipient?.id === profile.id) ||
          (message.recipient?.id === viewerId && message.sender.id === profile.id)
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

  async sharePoemToGroup(
    input: SharePoemToGroupInput
  ): Promise<InboxConversationMessage> {
    const poem = this.poems.find((item) => item.id === input.poemId);
    const sender = this.findAnyProfile(input.senderId);
    const group = this.requireInboxGroup(input.groupId);
    this.requireActiveGroupMember(group, input.senderId);
    if (!poem || !sender) throw new Error("A post and sender are required");

    const now = new Date().toISOString();
    const message: InboxConversationMessage = {
      id: `group-shared-post-${++this.shareSequence}`,
      sender: profileToUser(sender),
      groupId: group.id,
      createdAt: now,
      kind: "shared-post",
      ...(input.note?.trim() ? { text: input.note.trim() } : {}),
      sharedPost: {
        id: poem.id,
        title: poem.title,
        excerpt: poem.lines.join(" ").slice(0, 160),
        tags: [...poem.tags],
        author: { ...poem.author },
        ...(poem.artworkUrl ? { artworkUrl: poem.artworkUrl } : {})
      }
    };
    poem.metrics.shares = (poem.metrics.shares ?? 0) + 1;
    group.updatedAt = now;
    group.lastMessage = cloneInboxMessage(message);
    this.inboxGroupMessages.push(message);
    return cloneInboxMessage(message);
  }

  async listInboxMessages(userId: string, contactId: string): Promise<InboxConversationMessage[]> {
    return this.inboxMessages
      .filter((message) =>
        (message.sender.id === userId && message.recipient?.id === contactId) ||
        (message.recipient?.id === userId && message.sender.id === contactId)
      )
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
      .map(cloneInboxMessage);
  }

  async sendInboxMessage(input: SendInboxMessageInput): Promise<InboxConversationMessage> {
    const text = input.text.trim();
    const sender = this.findAnyProfile(input.senderId);
    if (!sender || !text) throw new Error("A sender and message body are required");

    if (input.groupId) {
      const group = this.requireInboxGroup(input.groupId);
      this.requireActiveGroupMember(group, input.senderId);
      const now = new Date().toISOString();
      const message: InboxConversationMessage = {
        id: `group-message-${++this.inboxMessageSequence}`,
        sender: profileToUser(sender),
        groupId: group.id,
        createdAt: now,
        kind: "text",
        text
      };
      group.updatedAt = now;
      group.lastMessage = cloneInboxMessage(message);
      this.inboxGroupMessages.push(message);
      return cloneInboxMessage(message);
    }

    const recipient = input.recipientId
      ? this.findAnyProfile(input.recipientId)
      : undefined;
    if (!recipient) throw new Error("A recipient is required");
    const message: InboxConversationMessage = {
      id: `message-${++this.inboxMessageSequence}`,
      sender: profileToUser(sender),
      recipient: profileToUser(recipient),
      createdAt: new Date().toISOString(),
      kind: "text",
      text
    };
    this.inboxMessages.push(message);
    return cloneInboxMessage(message);
  }

  async listInboxGroups(userId: string): Promise<InboxGroup[]> {
    return [...this.inboxGroups.values()]
      .filter((group) =>
        group.members.some(
          (member) => member.user.id === userId && member.status === "active"
        )
      )
      .sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      )
      .map(cloneInboxGroup);
  }

  async listInboxGroupInvites(userId: string): Promise<InboxGroup[]> {
    return [...this.inboxGroups.values()]
      .filter((group) =>
        group.members.some(
          (member) => member.user.id === userId && member.status === "invited"
        )
      )
      .sort(
        (left, right) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      )
      .map(cloneInboxGroup);
  }

  async getInboxGroup(groupId: string, userId: string): Promise<InboxGroup | null> {
    const group = this.inboxGroups.get(groupId);
    if (
      !group ||
      !group.members.some(
        (member) => member.user.id === userId && member.status === "active"
      )
    ) {
      return null;
    }
    return cloneInboxGroup(group);
  }

  async createInboxGroup(input: CreateInboxGroupInput): Promise<InboxGroup> {
    const owner = this.findAnyProfile(input.ownerId);
    const name = input.name.trim();
    if (!owner || !name) throw new Error("A group owner and name are required");

    const now = new Date().toISOString();
    const invitees = [...new Set(input.inviteeIds)]
      .filter(
        (userId) =>
          userId !== input.ownerId &&
          this.isMutualConnection(input.ownerId, userId)
      )
      .map((userId) => this.findAnyProfile(userId))
      .filter((profile): profile is UserProfileDetails => Boolean(profile));
    if (invitees.length === 0) {
      throw new Error("Invite at least one mutual connection");
    }

    const group: InboxGroup = {
      id: `group-${++this.inboxGroupSequence}`,
      name: name.slice(0, 80),
      ownerId: input.ownerId,
      members: [
        {
          user: profileToUser(owner),
          role: "owner",
          status: "active",
          invitedAt: now,
          joinedAt: now
        },
        ...invitees.map((invitee) => ({
          user: profileToUser(invitee),
          role: "member" as const,
          status: "invited" as const,
          invitedBy: profileToUser(owner),
          invitedAt: now
        }))
      ],
      createdAt: now,
      updatedAt: now
    };
    this.inboxGroups.set(group.id, group);
    return cloneInboxGroup(group);
  }

  async updateInboxGroup(input: UpdateInboxGroupInput): Promise<InboxGroup> {
    const group = this.requireInboxGroup(input.groupId);
    const actor = group.members.find(
      (member) =>
        member.user.id === input.userId &&
        member.status === "active" &&
        member.role === "owner"
    );
    const name = input.name.trim();
    if (!actor || !name) throw new Error("Only the group owner can rename it");
    group.name = name.slice(0, 80);
    group.updatedAt = new Date().toISOString();
    return cloneInboxGroup(group);
  }

  async inviteInboxGroupMembers(
    input: InviteInboxGroupMembersInput
  ): Promise<InboxGroup> {
    const group = this.requireInboxGroup(input.groupId);
    const inviter = this.requireActiveGroupMember(group, input.inviterId).user;
    const existingIds = new Set(group.members.map((member) => member.user.id));
    const now = new Date().toISOString();

    for (const userId of [...new Set(input.inviteeIds)]) {
      if (
        existingIds.has(userId) ||
        !this.isMutualConnection(input.inviterId, userId)
      ) {
        continue;
      }
      const invitee = this.findAnyProfile(userId);
      if (!invitee) continue;
      group.members.push({
        user: profileToUser(invitee),
        role: "member",
        status: "invited",
        invitedBy: { ...inviter },
        invitedAt: now
      });
    }

    group.updatedAt = now;
    return cloneInboxGroup(group);
  }

  async respondInboxGroupInvite(
    input: RespondInboxGroupInviteInput
  ): Promise<InboxGroup> {
    const group = this.requireInboxGroup(input.groupId);
    const member = group.members.find(
      (item) => item.user.id === input.userId && item.status === "invited"
    );
    if (!member) throw new Error("A pending invitation was not found");
    const now = new Date().toISOString();
    member.status = input.accept ? "active" : "declined";
    member.joinedAt = input.accept ? now : undefined;
    group.updatedAt = now;
    return cloneInboxGroup(group);
  }

  async listInboxGroupMessages(
    groupId: string,
    userId: string
  ): Promise<InboxConversationMessage[]> {
    const group = this.requireInboxGroup(groupId);
    this.requireActiveGroupMember(group, userId);
    return this.inboxGroupMessages
      .filter((message) => message.groupId === groupId)
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
      if (input.isActive && poem.author.id !== input.userId) {
        this.awardExperience(
          poem.author.id,
          "creator",
          2,
          `poem-${input.collection}:${input.userId}:${input.poemId}`
        );
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
      experience: emptyExperience(),
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
    if (input.avatarColor !== undefined) {
      profile.avatarColor = input.avatarColor;
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
      items: items.map((item) => {
        const poem = item.poemId ? this.poems.find((candidate) => candidate.id === item.poemId) : undefined;
        return {
          ...item,
          ...(poem
            ? {
                artworkUrl: item.artworkUrl ?? poem.artworkUrl,
                media: poem.media ? { ...poem.media } : item.media,
                layout: poem.layout ? cloneLayout(poem.layout) : item.layout,
                artworkTone: poem.artworkTone
              }
            : {}),
          tags: [...item.tags],
          reference: item.reference ? { ...item.reference } : undefined
        };
      }),
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

  async setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult> {
    if (input.userId === input.targetUserId) {
      throw new Error("You cannot follow yourself.");
    }

    const following = this.getFollowingIds(input.userId);
    if (input.isActive) {
      following.add(input.targetUserId);
    } else {
      following.delete(input.targetUserId);
    }
    this.followingByUser.set(input.userId, following);

    const reverse = this.getFollowingIds(input.targetUserId).has(input.userId);
    return {
      targetUserId: input.targetUserId,
      isFollowing: following.has(input.targetUserId),
      followsYou: reverse,
      isFriend: following.has(input.targetUserId) && reverse,
      followers: this.countFollowers(input.targetUserId),
      following: following.size
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
      const followingIds = viewerId ? this.getFollowingIds(viewerId) : new Set<string>();
      threads = threads
        .filter((thread) => followingIds.has(thread.author.id))
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    } else {
      threads = [...threads].sort(
        (left, right) => right.metrics.likes - left.metrics.likes
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
    if (thread.author.id !== input.userId) {
      this.awardExperience(input.userId, "creator", 5, `participate-thread:${continuation.id}`);
    }
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
    if (thread?.author.id !== input.userId) {
      this.awardExperience(input.userId, "creator", 5, `participate-thread:${continuation.id}`);
    }
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
      if (input.isActive && thread.author.id !== input.userId) {
        this.awardExperience(
          thread.author.id,
          "creator",
          2,
          `thread-liked:${input.userId}:${thread.id}`
        );
      }
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
      if (input.isActive && continuation.author.id !== input.userId) {
        this.awardExperience(
          continuation.author.id,
          "creator",
          2,
          `continuation-liked:${input.userId}:${continuation.id}`
        );
      }
    }
    return this.withContinuationViewer(continuation, input.userId);
  }

  async setThreadCollection(input: UpdateThreadCollectionInput): Promise<PoetryThread> {
    const thread = this.threads.find((item) => item.id === input.threadId);
    if (!thread) throw new Error(`Thread ${input.threadId} was not found`);
    const saved = this.getSavedThreadSet(input.userId);
    const wasActive = saved.has(input.threadId);
    if (wasActive !== input.isActive) {
      input.isActive ? saved.add(input.threadId) : saved.delete(input.threadId);
      thread.metrics.saves = Math.max(0, (thread.metrics.saves ?? 0) + (input.isActive ? 1 : -1));
      const profile = this.profiles.find((item) => item.id === input.userId);
      if (profile) {
        profile.contentCounts.saves = Math.max(
          0,
          profile.contentCounts.saves + (input.isActive ? 1 : -1)
        );
      }
    }
    return this.withThreadViewer(thread, input.userId);
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

  async shareThread(input: ShareThreadInput): Promise<ThreadShareResult> {
    const targetThread = input.threadId
      ? this.threads.find((item) => item.id === input.threadId)
      : undefined;
    const targetContinuation = input.continuationId
      ? this.continuations.find((item) => item.id === input.continuationId)
      : undefined;
    const thread = targetThread ?? (targetContinuation
      ? this.threads.find((item) => item.id === targetContinuation.threadId)
      : undefined);
    const sender = this.findAnyProfile(input.senderId) ?? createTransientProfile(input.senderId);
    const recipients = [...new Set(input.recipientIds)]
      .map((id) => this.findAnyProfile(id) ?? createTransientProfile(id));
    if (!thread || !sender || recipients.length === 0) {
      throw new Error("A thread and at least one recipient are required");
    }

    const targetId = targetContinuation?.id ?? thread.id;
    const excerpt = targetContinuation?.content ?? thread.content;
    const lineNumber = targetContinuation
      ? targetContinuation.lineNumber ?? this.getContinuationPath(targetContinuation).length + 2
      : undefined;
    thread.metrics.shares += recipients.length;
    if (targetContinuation) targetContinuation.metrics.shares += recipients.length;

    const messages = recipients.map((recipient) => {
      const message: InboxConversationMessage = {
        id: `shared-thread-${++this.shareSequence}`,
        sender: profileToUser(sender),
        recipient: profileToUser(recipient),
        createdAt: new Date().toISOString(),
        kind: targetContinuation ? "shared-continuation" : "shared-thread",
        text: input.note?.trim() || undefined,
        sharedThread: {
          threadId: thread.id,
          continuationId: targetContinuation?.id,
          title: thread.title || "Untitled thread",
          excerpt,
          lineNumber,
          author: profileToUser(thread.author)
        }
      };
      this.inboxMessages.unshift(message);
      return cloneInboxMessage(message);
    });
    return {
      targetId,
      shareCount: targetContinuation?.metrics.shares ?? thread.metrics.shares,
      recipientIds: recipients.map((recipient) => recipient.id),
      messages
    };
  }

  async shareThreadToGroup(
    input: ShareThreadToGroupInput
  ): Promise<InboxConversationMessage> {
    const targetContinuation = input.continuationId
      ? this.continuations.find((item) => item.id === input.continuationId)
      : undefined;
    const thread = this.threads.find((item) => item.id === input.threadId);
    const sender = this.findAnyProfile(input.senderId);
    const group = this.requireInboxGroup(input.groupId);
    this.requireActiveGroupMember(group, input.senderId);
    if (!sender || !thread) throw new Error("A thread and sender are required");
    if (input.kind === "continuation" && !targetContinuation) {
      throw new Error("A continuation is required");
    }
    if (targetContinuation && targetContinuation.threadId !== thread.id) {
      throw new Error("The continuation does not belong to the thread");
    }

    const now = new Date().toISOString();
    const message: InboxConversationMessage = {
      id: `group-shared-thread-${++this.shareSequence}`,
      sender: profileToUser(sender),
      groupId: group.id,
      createdAt: now,
      kind: targetContinuation ? "shared-continuation" : "shared-thread",
      ...(input.note?.trim() ? { text: input.note.trim() } : {}),
      sharedThread: {
        threadId: thread.id,
        ...(targetContinuation ? { continuationId: targetContinuation.id } : {}),
        title: thread.title || "Untitled thread",
        excerpt: targetContinuation?.content ?? thread.content,
        ...(targetContinuation?.lineNumber
          ? { lineNumber: targetContinuation.lineNumber }
          : {}),
        author: { ...thread.author },
        ...(thread.media?.uri ? { artworkUrl: thread.media.uri } : {})
      }
    };
    thread.metrics.shares += 1;
    if (targetContinuation) targetContinuation.metrics.shares += 1;
    group.updatedAt = now;
    group.lastMessage = cloneInboxMessage(message);
    this.inboxGroupMessages.push(message);
    return cloneInboxMessage(message);
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
    const dynamicThreads = [...(this.savedThreadsByUser.get(userId) ?? new Set<string>())]
      .map((threadId) => this.threads.find((thread) => thread.id === threadId))
      .filter((thread): thread is PoetryThread => Boolean(thread))
      .map((thread) => ({
        ...profileContentFromThread(thread, "started"),
        id: `saved-thread-${thread.id}`,
        collection: "saved" as const,
        threadRelation: undefined
      }));
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
      ...dynamicThreads,
      ...dynamicComments
    ];
    return items.filter((item) => {
      if (collection && item.collection !== collection) return false;
      if (contentKind && item.kind !== contentKind) return false;
      return true;
    });
  }

  private seedInbox() {
    const lili = this.findAnyProfile("user-lili");
    const ray = this.findAnyProfile("user-ray");
    const jinghe = this.findAnyProfile("user-jinghe");
    if (!lili || !ray || !jinghe) return;

    this.inboxMessages.push({
      id: "message-ray-lili-rain",
      sender: profileToUser(ray),
      recipient: profileToUser(lili),
      createdAt: "2026-07-18T06:28:00.000Z",
      kind: "text",
      text: "I loved the line about rain becoming a window."
    });

    const activeCreatedAt = "2026-07-17T10:00:00.000Z";
    const activeMessage: InboxConversationMessage = {
      id: "group-message-weekend-1",
      sender: profileToUser(ray),
      groupId: "group-weekend-lines",
      createdAt: "2026-07-18T05:42:00.000Z",
      kind: "text",
      text: "I added two lines to the shared draft."
    };
    this.inboxGroups.set("group-weekend-lines", {
      id: "group-weekend-lines",
      name: "Weekend Line Workshop",
      ownerId: lili.id,
      members: [
        {
          user: profileToUser(lili),
          role: "owner",
          status: "active",
          invitedAt: activeCreatedAt,
          joinedAt: activeCreatedAt
        },
        {
          user: profileToUser(ray),
          role: "member",
          status: "active",
          invitedBy: profileToUser(lili),
          invitedAt: activeCreatedAt,
          joinedAt: activeCreatedAt
        }
      ],
      createdAt: activeCreatedAt,
      updatedAt: activeMessage.createdAt,
      lastMessage: cloneInboxMessage(activeMessage),
      unreadCount: 2
    });
    this.inboxGroupMessages.push(activeMessage);

    const inviteCreatedAt = "2026-07-18T04:15:00.000Z";
    this.inboxGroups.set("group-midnight-draft", {
      id: "group-midnight-draft",
      name: "Midnight Draft Club",
      ownerId: ray.id,
      members: [
        {
          user: profileToUser(ray),
          role: "owner",
          status: "active",
          invitedAt: inviteCreatedAt,
          joinedAt: inviteCreatedAt
        },
        {
          user: profileToUser(jinghe),
          role: "member",
          status: "active",
          invitedBy: profileToUser(ray),
          invitedAt: inviteCreatedAt,
          joinedAt: inviteCreatedAt
        },
        {
          user: profileToUser(lili),
          role: "member",
          status: "invited",
          invitedBy: profileToUser(ray),
          invitedAt: inviteCreatedAt
        }
      ],
      createdAt: inviteCreatedAt,
      updatedAt: inviteCreatedAt
    });
  }

  private isMutualConnection(userId: string, targetUserId: string) {
    const connections = mockUserConnections[userId];
    if (connections) {
      const followerIds = new Set(
        connections.followers.map((profile) => profile.id)
      );
      const followingIds = this.getFollowingIds(userId);
      return followerIds.has(targetUserId) && followingIds.has(targetUserId);
    }
    return (
      this.getFollowingIds(userId).has(targetUserId) &&
      this.getFollowingIds(targetUserId).has(userId)
    );
  }

  private requireInboxGroup(groupId: string) {
    const group = this.inboxGroups.get(groupId);
    if (!group) throw new Error(`Inbox group ${groupId} was not found`);
    return group;
  }

  private requireActiveGroupMember(group: InboxGroup, userId: string) {
    const member = group.members.find(
      (item) => item.user.id === userId && item.status === "active"
    );
    if (!member) throw new Error("Active group membership is required");
    return member;
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

  private getFollowingIds(userId: string) {
    const existing = this.followingByUser.get(userId);
    if (existing) return existing;
    const seeded = new Set(
      (mockUserConnections[userId]?.following ?? []).map((item) => item.id)
    );
    this.followingByUser.set(userId, seeded);
    return seeded;
  }

  private countFollowers(userId: string) {
    return this.getAllProfiles().filter((profile) =>
      this.getFollowingIds(profile.id).has(userId)
    ).length;
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
    const parent = input.parentContinuationId
      ? this.continuations.find((item) => item.id === input.parentContinuationId)
      : undefined;
    const lineNumber = parent
      ? parent.lineNumber ?? this.getContinuationPath(parent).length + 2
      : 1;
    const continuation: ThreadContinuation = {
      id: `continue-new-${++this.continuationSequence}`,
      threadId: input.threadId,
      parentContinuationId: input.parentContinuationId,
      lineNumber: lineNumber + 1,
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

  private getSavedThreadSet(userId: string) {
    const existing = this.savedThreadsByUser.get(userId);
    if (existing) return existing;
    const created = new Set<string>();
    this.savedThreadsByUser.set(userId, created);
    return created;
  }

  private withThreadViewer(thread: PoetryThread, viewerId?: string): PoetryThread {
    const liked = viewerId ? this.getLikedThreadSet(viewerId).has(thread.id) : false;
    const saved = viewerId ? this.getSavedThreadSet(viewerId).has(thread.id) : false;
    return {
      ...cloneThread(thread),
      author: profileToUser(findProfile(this.profiles, thread.author)),
      viewer: { liked, saved }
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
        experience: emptyExperience(),
        badges: [],
        stats: { followers: 0, following: 0, likesAndSaves: 0 },
        contentCounts: { posts: 0, threads: 0, comments: 0, saves: 0 },
        visibility: { posts: true, threads: true, comments: true, saves: true }
      });
    }
    return result;
  }

  private awardExperience(
    userId: string,
    category: "creator" | "reviewer",
    points: number,
    eventKey: string
  ) {
    if (points <= 0 || this.experienceEvents.has(eventKey)) return;
    const profile = this.profiles.find((item) => item.id === userId);
    if (!profile) return;
    this.experienceEvents.add(eventKey);
    profile.experience[category] += points;
    const total = profile.experience.creator + profile.experience.reviewer;
    const level = Math.min(10, Math.floor(total / 10));
    profile.experience = {
      creator: profile.experience.creator,
      reviewer: profile.experience.reviewer,
      total,
      level,
      levelProgress: total >= 100 ? 1 : (total % 10) / 10,
      nextLevelAt: total >= 100 ? null : (level + 1) * 10
    };
    profile.level = level;
    const badges = profile.badges.filter((badge) => badge.id !== "badge-ink-weaver" && badge.id !== "badge-soul-echo");
    if (profile.experience.creator >= 20) {
      badges.push({
        id: "badge-ink-weaver",
        label: "Ink Weaver · 织墨者",
        symbol: "✒",
        tone: "warm",
        category: "creator"
      });
    }
    if (profile.experience.reviewer >= 20) {
      badges.push({
        id: "badge-soul-echo",
        label: "Soul Echo · 共鸣者",
        symbol: "♧",
        tone: "neutral",
        category: "reviewer"
      });
    }
    profile.badges = badges;
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
    media: thread.media ? { ...thread.media } : undefined,
    metrics: { ...thread.metrics },
    viewer: { ...thread.viewer }
  };
}

function createTransientProfile(userId: string): UserProfileDetails {
  const shortId = userId.replace(/[^a-z0-9]/gi, "").slice(-8) || "member";
  return {
    id: userId,
    handle: `member_${shortId}`,
    displayName: "LineSpace member",
    avatarColor: "#B8B0A4",
    linespaceId: `member_${shortId}`,
    level: 1,
    experience: emptyExperience(),
    badges: [],
    stats: { followers: 0, following: 0, likesAndSaves: 0 },
    contentCounts: { posts: 0, threads: 0, comments: 0, saves: 0 },
    visibility: { posts: true, threads: true, comments: true, saves: true }
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
    recipient: message.recipient ? { ...message.recipient } : undefined,
    sharedPost: message.sharedPost
      ? {
          ...message.sharedPost,
          author: { ...message.sharedPost.author },
          tags: [...message.sharedPost.tags]
        }
      : undefined
    ,
    sharedThread: message.sharedThread
      ? {
          ...message.sharedThread,
          author: { ...message.sharedThread.author }
        }
      : undefined
  };
}

function cloneInboxGroup(group: InboxGroup): InboxGroup {
  return {
    ...group,
    members: group.members.map((member) => ({
      ...member,
      user: { ...member.user },
      invitedBy: member.invitedBy ? { ...member.invitedBy } : undefined
    })),
    lastMessage: group.lastMessage
      ? cloneInboxMessage(group.lastMessage)
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
    media: poem.media ? { ...poem.media } : undefined,
    layout: poem.layout ? cloneLayout(poem.layout) : undefined,
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
    experience: { ...profile.experience },
    badges: profile.badges.map((badge) => ({ ...badge })),
    stats: { ...profile.stats },
    contentCounts: { ...profile.contentCounts },
    visibility: { ...profile.visibility }
  };
}

function emptyExperience() {
  return {
    creator: 0,
    reviewer: 0,
    total: 0,
    level: 0,
    levelProgress: 0,
    nextLevelAt: 10
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
    artworkUrl: poem.artworkUrl,
    media: poem.media ? { ...poem.media } : undefined,
    layout: poem.layout ? cloneLayout(poem.layout) : undefined,
    artworkTone: poem.artworkTone,
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

function normalizeDiscoveryText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function normalizeContentTag(value: string) {
  return value.trim().replace(/^#+/, "").toLocaleLowerCase();
}

function discoveryIncludes(values: Array<string | undefined>, query: string) {
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
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
    versionLines: draft.versionLines?.map((line) => ({
      ...line,
      author: { ...line.author }
    })),
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
