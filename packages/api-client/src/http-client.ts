import type {
  AiAssistRequest,
  AiAssistResponse,
  FeedQuery,
  PoemSummary
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

    return this.getJson<PoemSummary[]>(`/v1/feed?${params.toString()}`);
  }

  async getPoem(id: string): Promise<PoemSummary | null> {
    return this.getJson<PoemSummary | null>(`/v1/poems/${encodeURIComponent(id)}`);
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
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`LineSpace API POST ${path} failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
