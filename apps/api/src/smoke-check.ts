import {
  AuthClientError,
  createMockLineSpaceApi,
  HttpAuthClient,
  HttpLineSpaceApi,
  type AuthUser
} from "@linespace/api-client";
import { ApiAuthError, type AuthService } from "./auth";
import { handleApiRequest } from "./routes";

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

    const feed = await httpApi.listFeed({ section: "latest", filter: "all", viewerId: profile.id });
    assert(feed.some((poem) => poem.id === published.poem.id), "Published poem was missing from feed.");

    await httpApi.setPoemCollection({
      userId: profile.id,
      poemId: published.poem.id,
      collection: "saved",
      isActive: true
    });
    const collections = await httpApi.getUserPoemCollections(profile.id);
    assert(collections.savedPoemIds.includes(published.poem.id), "Saved collection was not updated.");

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

    await verifyRefreshSingleFlight();
    await verifyAuthClientContract();

    process.stdout.write(
      "API smoke check passed: health, Auth, Inbox privacy, Mock mode, HTTP contract, bearer headers, single-flight refresh, drafts, feed, poem, profile, collections, collaboration, and AI boundary.\n"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
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
