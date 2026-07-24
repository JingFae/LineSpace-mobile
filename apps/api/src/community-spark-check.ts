import { mockPoems } from "@linespace/api-client";
import {
  communitySparkModel,
  communitySparkProvider,
  communitySparkKeySource,
  isCommunitySparkConfigured,
  requestCreativeSpark,
  requestCommunitySpark
} from "./ai/community-spark.js";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY,
  deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL,
  deepSeekModel: process.env.DEEPSEEK_COMMUNITY_SPARK_MODEL,
  legacyApiKey: process.env.OPENAI_API_KEY,
  legacyModel: process.env.OPENAI_COMMUNITY_SPARK_MODEL
};

let capturedUrl = "";
let capturedRequest: RequestInit | undefined;

try {
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example/";
  process.env.DEEPSEEK_COMMUNITY_SPARK_MODEL = "DeepSeek-V4-Flash";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_COMMUNITY_SPARK_MODEL;

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedRequest = init;
    return new Response(
      JSON.stringify({
        id: "deepseek-response-1",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                summary: "Three gentle directions shaped by reader feedback.",
                suggestions: [
                  {
                    kind: "revise",
                    suggestion: "You could let the quiet arrive one beat earlier.",
                    preview: "Morning arrived quietly, already exhausted.",
                    proposedLines: [
                      "Yesterday kept borrowing tomorrow's light.",
                      "Morning arrived quietly, already exhausted.",
                      "Nobody questioned the clock."
                    ],
                    sourceCommentId: "comment-ray-loneliness"
                  },
                  {
                    kind: "continue",
                    suggestion: "Perhaps the clock could leave one final image.",
                    preview: "Only its shadow kept moving.",
                    proposedLines: [
                      "Yesterday kept borrowing tomorrow's light.",
                      "Morning arrived already exhausted.",
                      "Nobody questioned the clock.",
                      "Only its shadow kept moving."
                    ],
                    sourceCommentId: null
                  },
                  {
                    kind: "revise",
                    suggestion: "If you like, the last line could feel more suspended.",
                    preview: "The clock waited between its answers.",
                    proposedLines: [
                      "Yesterday kept borrowing tomorrow's light.",
                      "Morning arrived already exhausted.",
                      "The clock waited between its answers."
                    ],
                    sourceCommentId: "comment-jinghe-floors"
                  }
                ]
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 321,
          completion_tokens: 123
        }
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  };

  const poem = mockPoems[0];
  assert(poem, "Community Spark check poem is missing.");
  const result = await requestCommunitySpark({ poem });
  const requestBody = JSON.parse(String(capturedRequest?.body)) as {
    model?: string;
    messages?: Array<{ role?: string; content?: string }>;
    response_format?: { type?: string };
    max_tokens?: number;
  };

  assert(
    capturedUrl === "https://api.deepseek.example/chat/completions",
    "Community Spark did not use the configured DeepSeek endpoint."
  );
  assert(
    new Headers(capturedRequest?.headers).get("authorization") ===
      "Bearer test-deepseek-key",
    "Community Spark did not send the DeepSeek server key."
  );
  assert(
    requestBody.model === "deepseek-v4-flash" &&
      requestBody.messages?.[0]?.role === "system" &&
      requestBody.messages?.[1]?.role === "user" &&
      requestBody.response_format?.type === "json_object" &&
      requestBody.max_tokens === 3_000,
    "Community Spark did not send the DeepSeek Chat Completions contract."
  );
  assert(
    result.id === "deepseek-response-1" &&
      result.suggestions.length === 3 &&
      result.suggestions[0]?.source?.commentId ===
        "comment-ray-loneliness" &&
      result.usage?.inputTokens === 321 &&
      result.usage.outputTokens === 123,
    "Community Spark did not normalize the DeepSeek response."
  );
  const draftResult = await requestCreativeSpark({
    userId: poem.author.id,
    workingCopy: {
      title: "A draft in progress",
      lines: ["A small light waits by the window."],
      tags: ["draft"]
    }
  });
  assert(
    draftResult.poemId === `creative-draft-${poem.author.id}` &&
      draftResult.suggestions.length === 3,
    "Creative Spark did not generate a draft-only suggestion batch."
  );
  assert(
    communitySparkProvider() === "deepseek" &&
      communitySparkModel() === "deepseek-v4-flash" &&
      communitySparkKeySource() === "DEEPSEEK_API_KEY" &&
      isCommunitySparkConfigured(),
    "Community Spark did not expose its DeepSeek readiness configuration."
  );
} finally {
  globalThis.fetch = originalFetch;
  restoreEnvironment(
    "DEEPSEEK_API_KEY",
    originalEnvironment.deepSeekApiKey
  );
  restoreEnvironment(
    "DEEPSEEK_BASE_URL",
    originalEnvironment.deepSeekBaseUrl
  );
  restoreEnvironment(
    "DEEPSEEK_COMMUNITY_SPARK_MODEL",
    originalEnvironment.deepSeekModel
  );
  restoreEnvironment("OPENAI_API_KEY", originalEnvironment.legacyApiKey);
  restoreEnvironment(
    "OPENAI_COMMUNITY_SPARK_MODEL",
    originalEnvironment.legacyModel
  );
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
