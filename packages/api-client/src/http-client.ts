import type {
  AiAssistRequest,
  AiAssistResponse,
  FeedQuery,
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
import type { LineSpaceApi } from "./client";

export class HttpLineSpaceApi implements LineSpaceApi {
  constructor(private readonly baseUrl: string) {}

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
