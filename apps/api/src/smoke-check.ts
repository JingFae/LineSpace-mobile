import { createMockLineSpaceApi, HttpLineSpaceApi } from "@linespace/api-client";
import { handleApiRequest } from "./routes";

const baseUrl = "http://linespace.local";
const originalFetch = globalThis.fetch;

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
  const result = await handleApiRequest(method, url.pathname, url.searchParams, body);

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

  globalThis.fetch = routeAdapter;
  const httpApi = new HttpLineSpaceApi(baseUrl);

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

    process.stdout.write(
      "API smoke check passed: health, Mock mode, HTTP contract, drafts, feed, poem, profile, collections, collaboration, and AI boundary.\n"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await main();
