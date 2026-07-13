import { mockPoems } from "./mock-data";
import type {
  AiAssistRequest,
  AiAssistResponse,
  FeedQuery,
  PoemCollectionKind,
  PoemEngagementResult,
  PoemSummary,
  UpdatePoemCollectionInput,
  UserPoemCollections
} from "./types";

export interface LineSpaceApi {
  listFeed(query?: FeedQuery): Promise<PoemSummary[]>;
  getPoem(id: string, viewerId?: string): Promise<PoemSummary | null>;
  setPoemCollection(input: UpdatePoemCollectionInput): Promise<PoemEngagementResult>;
  getUserPoemCollections(userId: string): Promise<UserPoemCollections>;
  requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse>;
}

type MutableUserCollections = Record<PoemCollectionKind, Set<string>>;

export class MockLineSpaceApi implements LineSpaceApi {
  private readonly poems = mockPoems.map(clonePoem);
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
      saved: new Set<string>()
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
}

function clonePoem(poem: PoemSummary): PoemSummary {
  return {
    ...poem,
    metrics: { ...poem.metrics },
    viewer: { ...poem.viewer }
  };
}

export function createMockLineSpaceApi(): LineSpaceApi {
  return new MockLineSpaceApi();
}
