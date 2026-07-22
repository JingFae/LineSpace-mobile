import {
  AuthClientError,
  createMockLineSpaceApi,
  HttpAuthClient,
  HttpLineSpaceApi,
  type AuthUser,
  type UserProfileDetails
} from "@linespace/api-client";
import { ApiAuthError, type AuthService } from "./auth/index.js";
import type {
  UserConnectionPage,
  UserSearchPage,
  UpdateUserFollowInput,
  UserFollowResult
} from "@linespace/api-client";
import type { ProfileRepository as ApiProfileRepository } from "./database/profile/profile.repository.js";
import { handleApiRequest } from "./routes.js";

const baseUrl = "http://linespace.local";
const originalFetch = globalThis.fetch;
const smokeUser: AuthUser = {
  id: "user-lili",
  authUserId: "11111111-1111-4111-8111-111111111111",
  username: "lili",
  email: "lili@example.com",
  displayName: "Lili",
  emailConfirmed: true,
  createdAt: "2026-01-01T00:00:00.000Z"
};
const smokeAuthService: AuthService = {
  async authenticate(accessToken) {
    if (accessToken !== "smoke-token") {
      throw new ApiAuthError("INVALID_TOKEN", 401, "A valid access token is required.");
    }
    return smokeUser;
  },
  async register() {
    throw new Error("Not used by the HTTP contract smoke check.");
  },
  async login() {
    throw new Error("Not used by the HTTP contract smoke check.");
  },
  async refresh() {
    throw new Error("Not used by the HTTP contract smoke check.");
  },
  async logout() {
    throw new Error("Not used by the HTTP contract smoke check.");
  }
};

const routeAdapter: typeof fetch = async (input, init) => {
  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const request = input instanceof Request ? input : undefined;
  const url = new URL(requestUrl, baseUrl);
  const method = init?.method ?? request?.method ?? "GET";
  const rawBody = init?.body;
  const body = typeof rawBody === "string" && rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
  const headers = new Headers(init?.headers ?? request?.headers);
  const result = await handleApiRequest(method, url.pathname, url.searchParams, body, {
    authService: smokeAuthService,
    authorization: headers.get("authorization") ?? undefined
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" }
  });
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const mockApi = createMockLineSpaceApi();
  const mockFeed = await mockApi.listFeed({ viewerId: "user-lili" });
  assert(mockFeed.length > 0, "Mock mode returned an empty feed.");
  const taggedPoem = mockFeed.find((poem) => poem.tags.length > 0);
  assert(taggedPoem, "Mock feed has no tagged content for discovery checks.");
  const tagResult = await mockApi.listTagContent(taggedPoem.tags[0]!, "user-lili");
  assert(
    tagResult.posts.some((poem) => poem.id === taggedPoem.id),
    "Tag discovery did not return the tagged Post."
  );
  const searchResult = await mockApi.searchContent(taggedPoem.title, "user-lili");
  assert(
    searchResult.posts.some((poem) => poem.id === taggedPoem.id),
    "Unified search did not match the complete Post title."
  );
  const popularPosts = await mockApi.listFeed({ section: "popular", viewerId: "user-lili" });
  assert(
    popularPosts.every((poem, index) => index === 0 || popularPosts[index - 1]!.metrics.likes >= poem.metrics.likes),
    "Popular Posts are not sorted by likes."
  );
  const popularThreads = await mockApi.listThreads({ sort: "top", viewerId: "user-lili" });
  assert(
    popularThreads.every((thread, index) => index === 0 || popularThreads[index - 1]!.metrics.likes >= thread.metrics.likes),
    "Popular Threads are not sorted by likes."
  );
  const firstFeedPage = await mockApi.listFeed({
    section: "latest",
    viewerId: "user-lili",
    limit: 3
  });
  const secondFeedPage = await mockApi.listFeed({
    section: "latest",
    viewerId: "user-lili",
    cursor: firstFeedPage.at(-1)?.id,
    limit: 3
  });
  assert(firstFeedPage.length <= 3, "Feed pagination returned more than three records.");
  assert(
    secondFeedPage.every((item) => !firstFeedPage.some((first) => first.id === item.id)),
    "Feed cursor pagination returned duplicate records."
  );
  const mockGroup = await mockApi.createInboxGroup({
    ownerId: "user-lili",
    name: "Smoke Lines",
    inviteeIds: ["user-ray"]
  });
  assert(
    mockGroup.members.some((member) => member.user.id === "user-ray" && member.status === "invited"),
    "Mock group creation did not create a pending invitation."
  );
  const emptyMemberGroup = await mockApi.createInboxGroup({
    ownerId: "user-lili",
    name: "Private writing room",
    inviteeIds: []
  });
  assert(
    emptyMemberGroup.members.length === 1 && emptyMemberGroup.members[0]?.user.id === "user-lili",
    "A new user must be able to create an owner-only group."
  );
  await mockApi.respondInboxGroupInvite({
    groupId: mockGroup.id,
    userId: "user-ray",
    accept: true
  });
  await mockApi.sendInboxMessage({
    senderId: "user-ray",
    groupId: mockGroup.id,
    text: "Group message contract"
  });
  assert(
    (await mockApi.listInboxGroupMessages(mockGroup.id, "user-lili")).some(
      (message) => message.text === "Group message contract"
    ),
    "Mock group messages did not round-trip."
  );
  const beforeExperience = await mockApi.getUserProfile("user-ray");
  await mockApi.setPoemCollection({
    userId: "user-ray",
    poemId: "poem-orbit",
    collection: "liked",
    isActive: true
  });
  const comment = await mockApi.createPoemComment({
    userId: "user-ray",
    poemId: "poem-orbit",
    body: "The light is still moving."
  });
  const afterExperience = await mockApi.getUserProfile("user-ray");
  assert(
    beforeExperience &&
      afterExperience &&
      afterExperience.experience.creator === beforeExperience.experience.creator &&
      afterExperience.experience.reviewer === beforeExperience.experience.reviewer + 5,
    "Experience should reward comments while keeping the creator total scoped to the recipient."
  );
  assert(comment.author.id === "user-ray", "Comment experience smoke setup failed.");

  const health = await handleApiRequest("GET", "/health", new URLSearchParams());
  assert(health.status === 200, "The API health handler did not return 200.");

  const unauthenticatedInbox = await handleApiRequest(
    "GET",
    "/v1/users/user-lili/inbox-summary",
    new URLSearchParams(),
    undefined,
    { authService: smokeAuthService }
  );
  assert(unauthenticatedInbox.status === 401, "Inbox summary must require authentication.");

  const forbiddenInbox = await handleApiRequest(
    "GET",
    "/v1/users/user-ray/inbox-summary",
    new URLSearchParams(),
    undefined,
    { authService: smokeAuthService, authorization: "Bearer smoke-token" }
  );
  assert(forbiddenInbox.status === 403, "Users must not be able to read another user's inbox.");

  globalThis.fetch = routeAdapter;
  const httpApi = new HttpLineSpaceApi(baseUrl, {
    getAccessToken: () => "smoke-token"
  });

  try {
    const catalog = await httpApi.getPoemDesignCatalog();
    assert(catalog.templates.length > 0, "The design catalog has no templates.");

    const profile = await httpApi.getUserProfile("user-lili");
    assert(profile, "The current mock user profile was not found over HTTP.");
    const inboxSummary = await httpApi.getInboxActivitySummary(profile.id);
    assert(
      inboxSummary.unread.comments > 0 && inboxSummary.unread.likes > 0,
      "Inbox summary did not return unread activity counts."
    );
    const readInboxSummary = await httpApi.markInboxActivityRead(profile.id, "comments");
    assert(
      readInboxSummary.unread.comments === 0 &&
        readInboxSummary.recent.comments.every((item) => !item.unread),
      "Opening an Inbox activity category did not clear its unread state."
    );
    const httpGroup = await httpApi.createInboxGroup({
      ownerId: profile.id,
      name: "HTTP Lines",
      inviteeIds: ["user-ray"]
    });
    assert(httpGroup.name === "HTTP Lines", "Group creation did not reach the HTTP route.");
    const httpGroupInList = (await httpApi.listInboxGroups("user-lili")).find(
      (group) => group.id === httpGroup.id
    );
    assert(httpGroupInList, "HTTP group was not returned for its owner.");
    const groupPostShare = await httpApi.sharePoemToGroup({
      poemId: "poem-light",
      senderId: profile.id,
      groupId: httpGroup.id,
      note: "Open the shared Post"
    });
    assert(
      groupPostShare.groupId === httpGroup.id &&
        groupPostShare.sharedPost?.id === "poem-light",
      "Group Post sharing did not preserve its Inbox click target."
    );
    const groupThreadShare = await httpApi.shareThreadToGroup({
      kind: "thread",
      threadId: "thread-rain-without-rain",
      senderId: profile.id,
      groupId: httpGroup.id,
      note: "Open the shared Thread"
    });
    assert(
      groupThreadShare.groupId === httpGroup.id &&
        groupThreadShare.sharedThread?.threadId === "thread-rain-without-rain",
      "Group Thread sharing did not preserve its Inbox click target."
    );
    const groupMessages = await httpApi.listInboxGroupMessages(
      httpGroup.id,
      profile.id
    );
    assert(
      groupMessages.some((message) => message.sharedPost?.id === "poem-light") &&
        groupMessages.some(
          (message) => message.sharedThread?.threadId === "thread-rain-without-rain"
        ),
      "Group content shares were not returned by the Inbox message contract."
    );
    const versionPost = await httpApi.publishThreadVersionAsPost({
      threadId: "thread-city-edge",
      versionId: "smoke-version",
      userId: profile.id
    });
    assert(
      versionPost.threadId === "thread-city-edge" &&
        versionPost.versionId === "smoke-version" &&
        versionPost.poem.author.id === profile.id,
      "Thread Version to Post did not preserve the HTTP actor and source IDs."
    );

    const draft = await httpApi.createPoemDraft({ ownerId: profile.id, mode: "draft" });
    const loadedDraft = await httpApi.getPoemDraft(draft.id);
    assert(loadedDraft?.id === draft.id, "The created draft could not be loaded.");

    const updatedDraft = await httpApi.updatePoemDraft({
      draftId: draft.id,
      userId: profile.id,
      title: "Contract check",
      body: "A line crosses the boundary."
    });
    assert(updatedDraft.title === "Contract check", "Draft update did not reach the API route.");

    const operatedDraft = await httpApi.applyDraftOperation({
      draftId: draft.id,
      userId: profile.id,
      title: updatedDraft.title,
      body: `${updatedDraft.body}\nAnd returns intact.`,
      baseVersion: updatedDraft.version
    });
    assert(operatedDraft.version > updatedDraft.version, "Draft operation did not advance version.");

    const candidates = await httpApi.listDraftInviteCandidates(profile.id);
    const candidate = candidates.find((item) => item.id !== profile.id);
    assert(candidate, "No collaborator candidate was returned.");
    await httpApi.inviteDraftCollaborator({
      draftId: draft.id,
      inviterId: profile.id,
      inviteeId: candidate.id
    });

    const published = await httpApi.publishPoemDraft({ draftId: draft.id, userId: profile.id });
    const loadedPoem = await httpApi.getPoem(published.poem.id, profile.id);
    assert(loadedPoem?.id === published.poem.id, "Published poem was not available over HTTP.");

    const relayDraft = await httpApi.createPoemDraft({ ownerId: profile.id, mode: "relay" });
    const updatedRelayDraft = await httpApi.updatePoemDraft({
      draftId: relayDraft.id,
      userId: profile.id,
      title: "",
      body: "The first cloud remembers my name.",
      relayFirstLine: "The first cloud remembers my name.",
      relayRules: "Continue with one image from the sky."
    });
    assert(
      updatedRelayDraft.relayFirstLine === "The first cloud remembers my name." &&
        updatedRelayDraft.relayRules === "Continue with one image from the sky.",
      "Relay first-line and rules fields did not cross the HTTP draft boundary."
    );
    const publishedRelay = await httpApi.publishThreadDraft({
      draftId: relayDraft.id,
      userId: profile.id
    });
    assert(
      publishedRelay.thread.title === "poem relay" &&
        publishedRelay.thread.startingContent === "The first cloud remembers my name." &&
        publishedRelay.thread.content === "Continue with one image from the sky." &&
        publishedRelay.thread.rules === "Continue with one image from the sky.",
      "Relay publication did not preserve the default title, first line, and rules."
    );

    const feed = await httpApi.listFeed({
      section: "latest",
      filter: "all",
      viewerId: profile.id,
      limit: 50
    });
    assert(feed.some((poem) => poem.id === published.poem.id), "Published poem was missing from feed.");
    const discovery = await httpApi.searchContent("Contract check", profile.id);
    assert(
      discovery.posts.some((poem) => poem.id === published.poem.id),
      "Unified HTTP search did not return the newly published Post."
    );

    await httpApi.setPoemCollection({
      userId: profile.id,
      poemId: published.poem.id,
      collection: "saved",
      isActive: true
    });
    const collections = await httpApi.getUserPoemCollections(profile.id);
    assert(collections.savedPoemIds.includes(published.poem.id), "Saved collection was not updated.");

    const savedPosts = await httpApi.listUserProfileContent(profile.id, "saves", {
      collection: "saved",
      contentKind: "post"
    });
    assert(
      savedPosts.items.some((item) => item.poemId === published.poem.id),
      "Profile Saves did not reflect a saved Post."
    );

    const threadBeforeSave = await httpApi.getThread("thread-city-edge", profile.id);
    assert(threadBeforeSave, "Thread save smoke target was not found.");
    const savedThread = await httpApi.setThreadCollection({
      userId: profile.id,
      threadId: threadBeforeSave.thread.id,
      isActive: true
    });
    assert(
      savedThread.viewer.saved &&
        (savedThread.metrics.saves ?? 0) >= (threadBeforeSave.thread.metrics.saves ?? 0),
      "Thread save state and count did not update together."
    );
    const savedThreads = await httpApi.listUserProfileContent(profile.id, "saves", {
      collection: "saved",
      contentKind: "thread"
    });
    assert(
      savedThreads.items.some((item) => item.threadId === savedThread.id),
      "Profile Saves did not reflect a saved Thread."
    );

    const content = await httpApi.listUserProfileContent(profile.id, "posts");
    assert(content.userId === profile.id, "Profile content route returned the wrong user.");
    const connections = await httpApi.listUserConnections(profile.id, "following", {
      limit: 5,
      viewerId: profile.id
    });
    assert(connections.userId === profile.id, "Connection route returned the wrong user.");
    const searchPage = await httpApi.searchUsers("l", profile.id, { limit: 1 });
    assert(searchPage.results.length <= 1, "User search did not enforce its page size.");
    assert(
      searchPage.results.every((result) => !Object.prototype.hasOwnProperty.call(result, "email")),
      "User search returned a sensitive email field."
    );
    const avatarUrl = "https://linespace.local/avatars/user-lili.png";
    const updatedProfile = await httpApi.updateUserProfile({
      userId: profile.id,
      displayName: profile.displayName,
      avatarUrl
    });
    assert(updatedProfile.id === profile.id, "Profile update route returned the wrong user.");
    assert(updatedProfile.avatarUrl === avatarUrl, "Profile avatar update was not persisted.");

    const refreshedPoem = await httpApi.getPoem(published.poem.id, profile.id);
    assert(
      refreshedPoem?.author.avatarUrl === avatarUrl,
      "Published poem author avatar was not refreshed from the profile."
    );
    const commentedPoem = await httpApi.getPoem("poem-light", profile.id);
    assert(
      commentedPoem?.comments?.some(
        (comment) => comment.author.id === profile.id && comment.author.avatarUrl === avatarUrl
      ),
      "Comment avatar was not refreshed from the profile."
    );
    const foreignPost = feed.find((poem) => poem.author.id !== profile.id);
    if (foreignPost) {
      const profileComment = await httpApi.createPoemComment({
        poemId: foreignPost.id,
        userId: profile.id,
        body: "A comment that belongs in Profile."
      });
      const likedComment = await httpApi.setCommentCollection({
        poemId: foreignPost.id,
        commentId: profileComment.id,
        userId: profile.id,
        collection: "liked",
        isActive: true
      });
      assert(
        likedComment.comment.viewer?.liked && (likedComment.comment.likes ?? 0) > 0,
        "Comment like state and count did not update together."
      );
      const profileComments = await httpApi.listUserProfileContent(profile.id, "comments");
      assert(
        profileComments.items.some((item) => item.commentId === profileComment.id),
        "Profile Comments did not reflect a comment on another user's Post."
      );
      const likedComments = await httpApi.listUserProfileContent(profile.id, "saves", {
        collection: "liked",
        contentKind: "comment"
      });
      assert(
        likedComments.items.some((item) => item.commentId === profileComment.id),
        "Profile Saves did not reflect a liked Comment."
      );
    }

    const replacementDraft = await httpApi.createPoemDraft({ ownerId: profile.id, mode: "draft" });
    await httpApi.updatePoemDraft({
      draftId: replacementDraft.id,
      userId: profile.id,
      title: "Contract check edited",
      body: "The same Post now carries a new line."
    });
    const replaced = await httpApi.publishPoemDraft({
      draftId: replacementDraft.id,
      userId: profile.id,
      replacePostId: published.poem.id
    });
    assert(
      replaced.poem.id === published.poem.id &&
        replaced.poem.title === "Contract check edited" &&
        replaced.poem.metrics.saves === 1,
      "Editing a Post did not preserve its identity and engagement."
    );
    assert(
      !(await httpApi.listUserDrafts(profile.id)).items.some((item) => item.id === replacementDraft.id),
      "A published edit remained visible in Drafts."
    );
    const deleted = await httpApi.deletePoem({ userId: profile.id, poemId: published.poem.id });
    assert(
      deleted.deleted && !(await httpApi.getPoem(published.poem.id, profile.id)),
      "An owner could not delete their published Post."
    );
    const inviteCandidates = await httpApi.listDraftInviteCandidates("user-ray");
    assert(
      inviteCandidates.some(
        (candidate) => candidate.id === profile.id && candidate.avatarUrl === avatarUrl
      ),
      "Invite candidate avatar was not refreshed from the profile."
    );

    let aiBoundaryRejected = false;
    try {
      await httpApi.requestAiAssist({ intent: "title-suggestion", text: "A line" });
    } catch {
      aiBoundaryRejected = true;
    }
    assert(aiBoundaryRejected, "The unconfigured AI boundary should reject HTTP requests.");

    await verifyUserDomainHttpIdentity();
    await verifyRefreshSingleFlight();
    await verifyAuthClientContract();
    await verifyInjectedUserDomainRepository();

    process.stdout.write(
      "API smoke check passed: health, Auth, Inbox privacy, Mock mode, HTTP contract, bearer headers, single-flight refresh, drafts, feed, poem, profile, collections, collaboration, and AI boundary.\n"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function verifyUserDomainHttpIdentity() {
  const requestUrls: string[] = [];
  let sawAuthorization = false;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requestUrls.push(url);
    sawAuthorization =
      new Headers(init?.headers).get("authorization") === "Bearer smoke-token";
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/following")) {
      return jsonResponse({
        userId: smokeUser.id,
        kind: "following",
        total: 0,
        items: []
      });
    }
    if (pathname.endsWith("/feed") || pathname.endsWith("/threads")) {
      return jsonResponse([]);
    }
    return jsonResponse({
      query: "ray",
      recent: [],
      friends: [],
      results: [],
      nextCursor: null
    });
  };

  const httpApi = new HttpLineSpaceApi(baseUrl, {
    getAccessToken: () => "smoke-token"
  });
  await httpApi.listUserConnections(smokeUser.id, "following", {
    limit: 10,
    viewerId: "untrusted-environment-user"
  });
  await httpApi.searchUsers("ray", "untrusted-environment-user", { limit: 10 });
  await httpApi.listFeed({
    section: "latest",
    viewerId: "untrusted-environment-user",
    cursor: "post-cursor",
    limit: 3
  });
  await httpApi.listThreads({
    sort: "latest",
    viewerId: "untrusted-environment-user",
    cursor: "thread-cursor",
    limit: 3
  });
  await httpApi.listUserProfileContent(smokeUser.id, "saves", {
    viewerId: "untrusted-environment-user",
    collection: "liked",
    contentKind: "post"
  });

  assert(sawAuthorization, "User-domain HTTP requests did not carry the Access Token.");
  assert(
    requestUrls.every((url) => !new URL(url).searchParams.has("viewerId")),
    "HTTP user, Feed, and Thread requests must not send viewerId."
  );
  const contentPageUrls = requestUrls.filter((url) => {
    const pathname = new URL(url).pathname;
    return pathname.endsWith("/feed") || pathname.endsWith("/threads");
  });
  assert(
    contentPageUrls.length === 2 &&
      contentPageUrls.every((url) => new URL(url).searchParams.get("limit") === "3"),
    "HTTP Feed and Thread requests must preserve the three-item page size."
  );
  globalThis.fetch = routeAdapter;
}

async function verifyInjectedUserDomainRepository() {
  const calls: string[] = [];
  const profile: UserProfileDetails = {
    id: smokeUser.id,
    linespaceId: "ls-smoke",
    handle: smokeUser.username,
    displayName: smokeUser.displayName,
    avatarColor: "#DCD8D3",
    level: 2,
    experience: {
      creator: 6,
      reviewer: 4,
      total: 10,
      level: 2,
      levelProgress: 0,
      nextLevelAt: 20
    },
    badges: [],
    stats: { followers: 0, following: 0, likesAndSaves: 0 },
    contentCounts: { posts: 0, threads: 0, comments: 0, saves: 0 },
    visibility: { posts: true, threads: true, comments: true, saves: true }
  };
  const repository: ApiProfileRepository = {
    async getProfile(userId) {
      calls.push(`profile:${userId}`);
      return userId === smokeUser.id ? profile : null;
    },
    async updateProfile(actorUserId, targetUserId, changes) {
      calls.push(`update:${actorUserId}:${targetUserId}:${Object.keys(changes).join(",")}`);
      return profile;
    },
    async searchUsers(actorUserId, query, options) {
      calls.push(`search:${actorUserId}:${query}:${options?.limit ?? 20}`);
      const result = {
        id: "user-ray",
        handle: "ray",
        displayName: "Ray",
        avatarColor: "#DCD8D3",
        isFollowing: true,
        isFriend: true,
        hasRecentChat: false
      };
      return {
        query,
        recent: [],
        friends: [result],
        results: [result],
        nextCursor: null
      } satisfies UserSearchPage;
    },
    async listConnections(actorUserId, targetUserId, kind) {
      calls.push(`connections:${actorUserId}:${targetUserId}:${kind}`);
      return {
        userId: targetUserId,
        kind,
        total: 0,
        items: []
      } satisfies UserConnectionPage;
    },
    async listRecentContacts() {
      return [];
    },
    async setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult> {
      calls.push(`follow:${input.userId}:${input.targetUserId}:${input.isActive}`);
      return {
        targetUserId: input.targetUserId,
        isFollowing: input.isActive,
        followsYou: false,
        isFriend: false,
        followers: 0,
        following: input.isActive ? 1 : 0
      };
    }
  };

  const search = await handleApiRequest(
    "GET",
    "/v1/users/search",
    new URLSearchParams({ query: "ray", limit: "1" }),
    undefined,
    {
      authService: smokeAuthService,
      authorization: "Bearer smoke-token",
      profileRepository: repository
    }
  );
  assert(search.status === 200, "Injected profile repository search did not return 200.");
  assert(calls.includes("search:user-lili:ray:1"), "Search actor was not derived from JWT.");

  const follow = await handleApiRequest(
    "PUT",
    "/v1/users/user-ray/follow",
    new URLSearchParams(),
    {},
    {
      authService: smokeAuthService,
      authorization: "Bearer smoke-token",
      profileRepository: repository
    }
  );
  assert(follow.status === 200, "Injected follow repository did not return 200.");
  assert(
    calls.includes("follow:user-lili:user-ray:true"),
    "Follow route did not pass JWT actor and URL target to the repository."
  );

  const connections = await handleApiRequest(
    "GET",
    "/v1/users/user-lili/connections",
    new URLSearchParams({ kind: "following", limit: "5" }),
    undefined,
    {
      authService: smokeAuthService,
      authorization: "Bearer smoke-token",
      profileRepository: repository
    }
  );
  assert(connections.status === 200, "Connections compatibility route did not return 200.");
  assert(
    calls.includes("connections:user-lili:user-lili:following"),
    "Connections route did not use the JWT actor."
  );

  const forbiddenUpdate = await handleApiRequest(
    "PUT",
    "/v1/users/user-ray/profile",
    new URLSearchParams(),
    { displayName: "Not allowed" },
    {
      authService: smokeAuthService,
      authorization: "Bearer smoke-token",
      profileRepository: repository
    }
  );
  assert(forbiddenUpdate.status === 403, "Profile update allowed a mismatched URL user.");

  const unknownFieldUpdate = await handleApiRequest(
    "PUT",
    "/v1/users/user-lili/profile",
    new URLSearchParams(),
    { level: 99 },
    {
      authService: smokeAuthService,
      authorization: "Bearer smoke-token",
      profileRepository: repository
    }
  );
  assert(
    unknownFieldUpdate.status === 400,
    "Profile update accepted a protected or unknown field."
  );
}

async function verifyRefreshSingleFlight() {
  let accessToken = "expired-token";
  let refreshCalls = 0;
  let sawRefreshedAuthorization = false;

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization");
    if (authorization === "Bearer smoke-token") {
      sawRefreshedAuthorization = true;
      return routeAdapter(input, init);
    }
    return new Response(JSON.stringify({ code: "INVALID_TOKEN" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  };

  const refreshingApi = new HttpLineSpaceApi(baseUrl, {
    getAccessToken: () => accessToken,
    refreshAccessToken: async () => {
      refreshCalls += 1;
      await Promise.resolve();
      accessToken = "smoke-token";
      return accessToken;
    }
  });

  await Promise.all([
    refreshingApi.getInboxActivitySummary(smokeUser.id),
    refreshingApi.getUserPoemCollections(smokeUser.id)
  ]);
  assert(refreshCalls === 1, "Concurrent 401 responses must share one refresh request.");
  assert(
    sawRefreshedAuthorization,
    "The refreshed Access Token was not attached to the retried request."
  );
}

async function verifyAuthClientContract() {
  const requests: Array<{ path: string; method: string; authorization?: string }> = [];
  const client = new HttpAuthClient(baseUrl, {
    fetch: async (input, init) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(requestUrl);
      const headers = new Headers(init?.headers);
      requests.push({
        path: url.pathname,
        method: init?.method ?? "GET",
        authorization: headers.get("authorization") ?? undefined
      });
      if (url.pathname === "/v1/auth/logout") return new Response(null, { status: 204 });
      if (url.pathname === "/v1/auth/me") return jsonResponse(smokeUser);
      if (url.pathname === "/v1/auth/refresh") return jsonResponse(sessionResultBody());
      if (url.pathname === "/v1/auth/login") return jsonResponse(sessionResultBody());
      return jsonResponse(
        {
          user: smokeUser,
          session: sessionResultBody().session,
          emailConfirmationRequired: false
        },
        201
      );
    }
  });

  const registered = await client.register({
    username: "new-poet",
    email: "new-poet@example.com",
    password: "ValidPass123",
    confirmPassword: "ValidPass123"
  });
  assert(registered.user.id === smokeUser.id, "Auth client did not decode registration data.");
  await client.login({ username: "lili", password: "ValidPass123" });
  await client.refresh("refresh-token");
  await client.me("access-token");
  await client.logout("access-token");
  assert(
    requests.map((request) => request.path).join(",") ===
      "/v1/auth/register,/v1/auth/login,/v1/auth/refresh,/v1/auth/me,/v1/auth/logout",
    "Auth client called an unexpected endpoint sequence."
  );
  assert(requests.at(-1)?.authorization === "Bearer access-token", "Logout did not use Bearer auth.");

  const invalidClient = new HttpAuthClient(baseUrl, {
    fetch: async () => jsonResponse({ code: "INVALID_CREDENTIALS", message: "server detail" }, 401)
  });
  let safeError: unknown;
  try {
    await invalidClient.login({ username: "lili", password: "NeverLogThis123" });
  } catch (error) {
    safeError = error;
  }
  assert(safeError instanceof AuthClientError, "Auth client did not return a typed error.");
  assert(
    (safeError as Error).message === "Invalid username or password." &&
      !(safeError as Error).message.includes("NeverLogThis123"),
    "Auth client exposed unsafe login details."
  );
}

function sessionResultBody() {
  return {
    user: smokeUser,
    session: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 1_900_000_000,
      expiresIn: 3600,
      tokenType: "bearer"
    }
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

await main();
