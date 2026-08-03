import type { CommunitySparkResponse } from "@linespace/api-client";
import {
  createServiceRoleDatabaseClient,
  type DatabaseClient
} from "../database/core/client.js";

export type SparkFeature = "creative_spark" | "community_spark";
export type SparkSourceSurface = "compose_new" | "compose_edit" | "post_detail";

type SparkRequestInput = {
  userId: string;
  feature: SparkFeature;
  sourceSurface: SparkSourceSurface;
  postId?: string;
  provider: string;
  model: string;
};

export type SparkRequestTracker = {
  succeeded(response: CommunitySparkResponse): Promise<void>;
  failed(errorCode: string): Promise<void>;
};

let analyticsClient: DatabaseClient | null = null;

export async function beginSparkRequest(
  input: SparkRequestInput
): Promise<SparkRequestTracker> {
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  const client = getAnalyticsClient();
  if (!client) return noOpTracker;

  try {
    const result = await client.from("ai_spark_requests").insert({
      id,
      user_id: input.userId,
      feature: input.feature,
      source_surface: input.sourceSurface,
      post_id: input.postId ?? null,
      status: "pending",
      provider: input.provider,
      model: input.model
    });
    if (result.error) {
      logAnalyticsFailure("insert", result.error.message);
      return noOpTracker;
    }
  } catch (error) {
    logAnalyticsFailure("insert", errorMessage(error));
    return noOpTracker;
  }

  return {
    succeeded: (response) =>
      completeSparkRequest(client, id, startedAt, {
        status: "succeeded",
        provider_request_id: response.id.slice(0, 500),
        suggestions_count: response.suggestions.length,
        input_tokens: response.usage?.inputTokens ?? 0,
        output_tokens: response.usage?.outputTokens ?? 0,
        error_code: null
      }),
    failed: (errorCode) =>
      completeSparkRequest(client, id, startedAt, {
        status: "failed",
        provider_request_id: null,
        suggestions_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        error_code: normalizeErrorCode(errorCode)
      })
  };
}

async function completeSparkRequest(
  client: DatabaseClient,
  id: string,
  startedAt: number,
  result: {
    status: "succeeded" | "failed";
    provider_request_id: string | null;
    suggestions_count: number;
    input_tokens: number;
    output_tokens: number;
    error_code: string | null;
  }
) {
  try {
    const update = await client
      .from("ai_spark_requests")
      .update({
        ...result,
        duration_ms: Math.max(0, Date.now() - startedAt),
        completed_at: new Date().toISOString()
      })
      .eq("id", id);
    if (update.error) logAnalyticsFailure("update", update.error.message);
  } catch (error) {
    logAnalyticsFailure("update", errorMessage(error));
  }
}

function getAnalyticsClient() {
  if (analyticsClient) return analyticsClient;
  try {
    analyticsClient = createServiceRoleDatabaseClient();
  } catch (error) {
    logAnalyticsFailure("client", errorMessage(error));
  }
  return analyticsClient;
}

const noOpTracker: SparkRequestTracker = {
  async succeeded() {},
  async failed() {}
};

function normalizeErrorCode(value: string) {
  const normalized = value.trim() || "LLM_REQUEST_FAILED";
  return normalized.slice(0, 100);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown analytics error";
}

function logAnalyticsFailure(operation: string, message: string) {
  console.error("Spark analytics write failed", { operation, message });
}
