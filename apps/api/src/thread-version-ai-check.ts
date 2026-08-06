import {
  requestThreadVersionRecommendation,
  THREAD_VERSION_AI_PROMPT_VERSION
} from "./ai/thread-version-recommendation.js";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseUrl: process.env.DEEPSEEK_BASE_URL,
  model: process.env.DEEPSEEK_COMMUNITY_SPARK_MODEL
};

let capturedUrl = "";
let capturedRequest: RequestInit | undefined;

try {
  process.env.DEEPSEEK_API_KEY = "test-thread-version-key";
  process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.example/";
  process.env.DEEPSEEK_COMMUNITY_SPARK_MODEL = "deepseek-v4-flash";

  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedRequest = init;
    return new Response(
      JSON.stringify({
        id: "thread-version-response-1",
        choices: [{
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              selectedVersionId: "path-b",
              recommendedRationale:
                "The images progress naturally from the window to the returning light.",
              confidence: 0.87,
              harmonizedRationale:
                "A small pronoun adjustment makes the handoff between contributors gentler.",
              harmonizedLines: [
                {
                  lineId: "b-1",
                  text: "The window keeps a little winter.",
                  changeNote: ""
                },
                {
                  lineId: "b-2",
                  text: "It waits there until morning.",
                  changeNote:
                    "Reference: Clarified the opening pronoun without changing the image."
                },
                {
                  lineId: "b-3",
                  text: "A spaceship erupts into a completely unrelated universe.",
                  changeNote: "Replaced the image."
                }
              ]
            })
          }
        }],
        usage: { prompt_tokens: 410, completion_tokens: 155 }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const candidates = [
    {
      id: "path-a",
      lineCount: 2,
      totalLikes: 99,
      lines: [
        {
          lineId: "a-1",
          lineNumber: 1,
          text: "A loud clock fills the room.",
          authorId: "user-a"
        },
        {
          lineId: "a-2",
          lineNumber: 2,
          text: "No one answers.",
          authorId: "user-b",
          parentContinuationId: "a-1"
        }
      ]
    },
    {
      id: "path-b",
      lineCount: 3,
      totalLikes: 4,
      lines: [
        {
          lineId: "b-1",
          lineNumber: 1,
          text: "The window keeps a little winter.",
          authorId: "user-a"
        },
        {
          lineId: "b-2",
          lineNumber: 2,
          text: "She waits there until morning.",
          authorId: "user-c",
          parentContinuationId: "b-1"
        },
        {
          lineId: "b-3",
          lineNumber: 3,
          text: "Then light returns without asking.",
          authorId: "user-d",
          parentContinuationId: "b-2"
        }
      ]
    }
  ];

  const response = await requestThreadVersionRecommendation({
    intent: "moderation-preview",
    poemId: "thread-check",
    locale: "en",
    text: JSON.stringify({
      thread: {
        id: "thread-check",
        title: "Winter Window",
        rules: "Continue the image without naming snow."
      },
      candidateVersions: candidates
    })
  });
  const normalized = JSON.parse(response.suggestions[0] ?? "{}") as {
    selectedVersionId?: string;
    harmonizedLines?: Array<{
      lineId?: string;
      text?: string;
      changed?: boolean;
    }>;
  };
  const providerBody = JSON.parse(String(capturedRequest?.body)) as {
    model?: string;
    thinking?: { type?: string };
    messages?: Array<{ role?: string; content?: string }>;
    response_format?: { type?: string };
    max_tokens?: number;
  };
  const providerInput = JSON.parse(
    providerBody.messages?.[1]?.content ?? "{}"
  ) as {
    branchNodes?: Array<{ lineId?: string; text?: string }>;
    candidateVersions?: Array<{ id?: string; lineIds?: string[]; lines?: unknown }>;
  };

  assert(
    capturedUrl === "https://api.deepseek.example/chat/completions" &&
      new Headers(capturedRequest?.headers).get("authorization") ===
        "Bearer test-thread-version-key" &&
      THREAD_VERSION_AI_PROMPT_VERSION === "thread-version-ai-v3" &&
      providerBody.model === "deepseek-v4-flash" &&
      providerBody.thinking?.type === "disabled" &&
      providerBody.max_tokens === 1_600 &&
      providerBody.messages?.[0]?.role === "system" &&
      providerBody.messages?.[0]?.content?.includes(
        "OUTPUT LANGUAGE (MANDATORY)"
      ) &&
      providerBody.messages[0].content.includes(
        "same language as its edited line"
      ) &&
      providerBody.messages[0].content.includes(
        "punctuation-only changes do not count"
      ) &&
      providerInput.branchNodes?.length === 5 &&
      providerInput.candidateVersions?.every(
        (candidate) =>
          Array.isArray(candidate.lineIds) && candidate.lines === undefined
      ) &&
      providerBody.response_format?.type === "json_object",
    "Thread Version AI did not use DeepSeek with the deduplicated branch payload."
  );
  assert(
    normalized.selectedVersionId === "path-b",
    "Recommended did not preserve the exact selected branch id."
  );
  assert(
    normalized.harmonizedLines?.length === 3 &&
      normalized.harmonizedLines[0]?.text ===
        candidates[1]!.lines[0]!.text &&
      normalized.harmonizedLines[1]?.text ===
        "It waits there until morning." &&
      normalized.harmonizedLines[1]?.changed === true &&
      normalized.harmonizedLines[2]?.text ===
        candidates[1]!.lines[2]!.text &&
      normalized.harmonizedLines[2]?.changed === false,
    "Harmonized did not preserve line structure or reject an unsafe rewrite."
  );

  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => {
        throw new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError"
        );
      }
    }) as unknown as Response;
  let timeoutCode = "";
  try {
    await requestThreadVersionRecommendation({
      intent: "moderation-preview",
      poemId: "thread-timeout-check",
      locale: "en",
      text: JSON.stringify({
        thread: {
          id: "thread-timeout-check",
          title: "Tide",
          rules: "Continue."
        },
        candidateVersions: [candidates[0]]
      })
    });
  } catch (error) {
    timeoutCode = error instanceof Error ? error.message : "";
  }
  assert(
    timeoutCode === "LLM_TIMEOUT",
    "Thread Version AI did not normalize response-body timeouts."
  );
} finally {
  globalThis.fetch = originalFetch;
  restoreEnvironment("DEEPSEEK_API_KEY", originalEnvironment.apiKey);
  restoreEnvironment("DEEPSEEK_BASE_URL", originalEnvironment.baseUrl);
  restoreEnvironment(
    "DEEPSEEK_COMMUNITY_SPARK_MODEL",
    originalEnvironment.model
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
