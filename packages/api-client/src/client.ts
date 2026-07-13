import {
  mockPoems,
  mockUserConnections,
  mockUserProfileContent,
  mockUserProfileDetails
} from "./mock-data";
import type {
  AiAssistRequest,
  AiAssistResponse,
  FeedQuery,
  PoemCollectionKind,
  PoemEngagementResult,
  PoemSummary,
  UpdatePoemCollectionInput,
  UserConnectionKind,
  UserConnectionPage,
  UserConnectionQuery,
  UserPoemCollections,
  UserProfileContentPage,
  UserProfileContentSection,
  UserProfileDetails,
  UpdateUserProfileInput
} from "./types";

export interface LineSpaceApi {
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
  requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse>;
}

type MutableUserCollections = Record<PoemCollectionKind, Set<string>>;

export class MockLineSpaceApi implements LineSpaceApi {
  private readonly poems = mockPoems.map(clonePoem);
  private readonly profiles = mockUserProfileDetails.map(cloneUserProfile);
  private readonly collectionsByUser = new Map<string, MutableUserCollections>();

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
      ...clonePoem(poem),
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
}

function clonePoem(poem: PoemSummary): PoemSummary {
  return {
    ...poem,
    metrics: { ...poem.metrics },
    viewer: { ...poem.viewer }
  };
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

export function createMockLineSpaceApi(): LineSpaceApi {
  return new MockLineSpaceApi();
}
