import type { AiAssistRequest, AiAssistResponse } from "@linespace/api-client";

/**
 * This prompt is intentionally tracked in source control. It contains product
 * rules only; the secret key is read from the API server environment.
 */
export const THREAD_VERSION_RECOMMENDATION_PROMPT = `
You are LineSpace's poetry thread editor.
Review the supplied JSON versions as an editor, not as a co-author.
Choose the single most harmonious version by considering:
1. image continuity and emotional movement;
2. rhythm and line-to-line transition;
3. variety of contributors without breaking voice;
4. parent-child continuity;
5. likes only as a weak tie-breaker, never as the main criterion.

Return JSON only:
{
  "selectedVersionId": "string",
  "rationale": "one short sentence",
  "confidence": 0.0
}
Do not rewrite any line. Do not invent IDs.
`.trim();

export async function requestThreadVersionRecommendation(
  request: AiAssistRequest
): Promise<AiAssistResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_NOT_CONFIGURED");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: THREAD_VERSION_RECOMMENDATION_PROMPT },
        {
          role: "user",
          content: request.text.slice(0, 80_000)
        }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`LLM_REQUEST_FAILED_${response.status}`);
  }
  const payload = (await response.json()) as {
    id?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM_EMPTY_RESPONSE");
  return {
    id: payload.id || `ai-${Date.now()}`,
    intent: request.intent,
    suggestions: [content],
    usage: {
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0
    }
  };
}
