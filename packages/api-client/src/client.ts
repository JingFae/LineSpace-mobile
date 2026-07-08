import { mockPoems } from "./mock-data";
import type {
  AiAssistRequest,
  AiAssistResponse,
  FeedQuery,
  PoemSummary
} from "./types";

export interface LineSpaceApi {
  listFeed(query?: FeedQuery): Promise<PoemSummary[]>;
  getPoem(id: string): Promise<PoemSummary | null>;
  requestAiAssist(request: AiAssistRequest): Promise<AiAssistResponse>;
}

export class MockLineSpaceApi implements LineSpaceApi {
  async listFeed(query: FeedQuery = {}): Promise<PoemSummary[]> {
    const { filter } = query;

    if (filter === "final") {
      return mockPoems.filter((poem) => poem.status === "final");
    }

    if (filter === "growing") {
      return mockPoems.filter((poem) => poem.status === "growing");
    }

    if (filter === "most-contributed") {
      return [...mockPoems].sort(
        (left, right) => right.metrics.contributions - left.metrics.contributions
      );
    }

    return mockPoems;
  }

  async getPoem(id: string): Promise<PoemSummary | null> {
    return mockPoems.find((poem) => poem.id === id) ?? null;
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
}

export function createMockLineSpaceApi(): LineSpaceApi {
  return new MockLineSpaceApi();
}
