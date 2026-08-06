import { createHash } from "node:crypto";
import type {
  ThreadContinuation,
  ThreadDetail
} from "@linespace/api-client";
import {
  createServiceRoleDatabaseClient,
  type DatabaseClient
} from "../database/core/client.js";
import { ensureDatabaseResult } from "../database/core/errors.js";
import { ThreadRepository } from "../database/thread/thread.repository.js";
import {
  requestThreadVersionRecommendation,
  THREAD_VERSION_AI_PROMPT_VERSION,
  type ThreadVersionAiResult
} from "./thread-version-recommendation.js";
import { communitySparkModel } from "./community-spark.js";

const DEFAULT_DEBOUNCE_MS = 12_000;
const MAX_DRAIN_JOBS = 3;

type ClaimedJob = {
  thread_id: string;
  target_revision: number;
  attempts: number;
};

export async function enqueueThreadAiVersionRefresh(
  threadId: string,
  delaySeconds = 12
) {
  const client = requireServiceClient();
  const result = await client.rpc("enqueue_thread_ai_generation", {
    p_thread_id: threadId,
    p_delay_seconds: delaySeconds
  });
  ensureDatabaseResult(result.error);
}

export async function processThreadAiVersionAfterDebounce(threadId: string) {
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_DEBOUNCE_MS));
  await processThreadAiVersionJob(threadId, true);
}

export async function drainThreadAiVersionJobs(limit = MAX_DRAIN_JOBS) {
  const processed: string[] = [];
  for (let index = 0; index < Math.max(1, Math.min(limit, 10)); index += 1) {
    const threadId = await processThreadAiVersionJob();
    if (!threadId) break;
    processed.push(threadId);
  }
  return processed;
}

export async function processThreadAiVersionJob(
  threadId?: string,
  force = false
): Promise<string | null> {
  const client = requireServiceClient();
  const claimed = await claimJob(client, threadId, force);
  if (!claimed) return null;

  let sourceHash = "";
  try {
    const repository = new ThreadRepository(client);
    const detail = await repository.getThread(claimed.thread_id);
    if (!detail) throw new Error("THREAD_NOT_FOUND");
    const candidates = buildAiCandidates(detail);
    sourceHash = createSourceHash(detail, candidates);
    const model = communitySparkModel();

    const cached = await client
      .from("thread_ai_version_snapshots")
      .select("id,status")
      .eq("thread_id", claimed.thread_id)
      .eq("source_revision", claimed.target_revision)
      .eq("prompt_version", THREAD_VERSION_AI_PROMPT_VERSION)
      .eq("model", model)
      .eq("status", "ready")
      .maybeSingle();
    ensureDatabaseResult(cached.error);
    if (cached.data) {
      await markJobReady(client, claimed);
      return claimed.thread_id;
    }

    await upsertSnapshot(client, {
      threadId: claimed.thread_id,
      sourceRevision: claimed.target_revision,
      sourceHash,
      model,
      status: "processing"
    });

    const response = await requestThreadVersionRecommendation({
      intent: "moderation-preview",
      locale: "en",
      poemId: claimed.thread_id,
      text: JSON.stringify({
        task: "recommend-thread-version",
        thread: {
          id: detail.thread.id,
          title: detail.thread.title,
          rules: detail.thread.rules
        },
        candidateVersions: candidates
      })
    });
    const result = parseWorkerResult(response.suggestions[0]);
    await upsertSnapshot(client, {
      threadId: claimed.thread_id,
      sourceRevision: claimed.target_revision,
      sourceHash,
      model,
      status: "ready",
      result,
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0
    });
    await markJobReady(client, claimed);
    return claimed.thread_id;
  } catch (error) {
    const code = normalizeWorkerError(error);
    if (sourceHash) {
      await upsertSnapshot(client, {
        threadId: claimed.thread_id,
        sourceRevision: claimed.target_revision,
        sourceHash,
        model: communitySparkModel(),
        status: "failed",
        errorCode: code
      }).catch(() => undefined);
    }
    await markJobFailed(client, claimed, code);
    console.error("Thread Version background generation failed", {
      threadId: claimed.thread_id,
      revision: claimed.target_revision,
      attempts: claimed.attempts,
      code
    });
    return claimed.thread_id;
  }
}

async function claimJob(
  client: DatabaseClient,
  threadId?: string,
  force = false
): Promise<ClaimedJob | null> {
  const result = await client.rpc("claim_thread_ai_generation_job", {
    p_thread_id: threadId ?? null,
    p_force: force
  });
  ensureDatabaseResult(result.error);
  const rows = result.data as ClaimedJob[] | null;
  return rows?.[0] ?? null;
}

async function markJobReady(client: DatabaseClient, job: ClaimedJob) {
  const result = await client
    .from("thread_ai_generation_jobs")
    .update({
      status: "ready",
      locked_at: null,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("thread_id", job.thread_id)
    .eq("target_revision", job.target_revision)
    .eq("status", "processing");
  ensureDatabaseResult(result.error);
}

async function markJobFailed(
  client: DatabaseClient,
  job: ClaimedJob,
  errorCode: string
) {
  const retrySeconds = Math.min(900, 30 * 2 ** Math.max(0, job.attempts - 1));
  const result = await client
    .from("thread_ai_generation_jobs")
    .update({
      status: "failed",
      locked_at: null,
      last_error: errorCode,
      run_after: new Date(Date.now() + retrySeconds * 1_000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("thread_id", job.thread_id)
    .eq("target_revision", job.target_revision)
    .eq("status", "processing");
  ensureDatabaseResult(result.error);
}

async function upsertSnapshot(
  client: DatabaseClient,
  input: {
    threadId: string;
    sourceRevision: number;
    sourceHash: string;
    model: string;
    status: "processing" | "ready" | "failed";
    result?: ThreadVersionAiResult;
    inputTokens?: number;
    outputTokens?: number;
    errorCode?: string;
  }
) {
  const now = new Date().toISOString();
  const databaseResult = await client
    .from("thread_ai_version_snapshots")
    .upsert(
      {
        thread_id: input.threadId,
        source_revision: input.sourceRevision,
        source_hash: input.sourceHash,
        status: input.status,
        prompt_version: THREAD_VERSION_AI_PROMPT_VERSION,
        model: input.model,
        selected_version_id: input.result?.selectedVersionId ?? null,
        recommended_rationale: input.result?.recommendedRationale ?? null,
        harmonized_rationale: input.result?.harmonizedRationale ?? null,
        result: input.result ?? null,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
        error_code: input.errorCode ?? null,
        generated_at: input.status === "ready" ? now : null,
        updated_at: now
      },
      {
        onConflict: "thread_id,source_revision,prompt_version,model"
      }
    );
  ensureDatabaseResult(databaseResult.error);
}

type AiCandidate = {
  id: string;
  lineCount: number;
  lines: Array<{
    lineId: string;
    lineNumber: number;
    text: string;
    authorId: string;
    parentContinuationId?: string;
  }>;
};

function buildAiCandidates(detail: ThreadDetail): AiCandidate[] {
  const continuations =
    detail.allContinuations ?? detail.continuations ?? [];
  const paths = collectLeafPaths(continuations);
  const startingText =
    detail.thread.startingContent?.trim() ||
    deriveStartingContentFallback(detail.thread.content);
  return paths.slice(0, 100).map((path) => {
    const lines: AiCandidate["lines"] = [
      {
        lineId: `${detail.thread.id}:starting-content`,
        lineNumber: 1,
        text: startingText,
        authorId: detail.thread.author.id
      },
      ...path.map((line, index) => ({
        lineId: line.id,
        lineNumber: line.lineNumber ?? index + 2,
        text: line.content,
        authorId: line.author.id,
        ...(line.parentContinuationId
          ? { parentContinuationId: line.parentContinuationId }
          : {})
      }))
    ];
    const leaf = path[path.length - 1];
    return {
      id: leaf
        ? `${detail.thread.id}:${leaf.id}:${versionContentHash(
            lines.map((line) => line.text).join("\n")
          )}`
        : `${detail.thread.id}:initial`,
      lineCount: lines.length,
      lines
    };
  });
}

function collectLeafPaths(
  continuations: readonly ThreadContinuation[]
): ThreadContinuation[][] {
  const children = new Map<string, ThreadContinuation[]>();
  const roots: ThreadContinuation[] = [];
  for (const continuation of continuations) {
    if (!continuation.parentContinuationId) {
      roots.push(continuation);
      continue;
    }
    const siblings = children.get(continuation.parentContinuationId) ?? [];
    siblings.push(continuation);
    children.set(continuation.parentContinuationId, siblings);
  }
  const stable = (items: readonly ThreadContinuation[]) =>
    [...items].sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id)
    );
  const paths: ThreadContinuation[][] = [];
  const visit = (node: ThreadContinuation, path: ThreadContinuation[]) => {
    const next = [...path, node];
    const descendants = stable(children.get(node.id) ?? []);
    if (descendants.length === 0) {
      paths.push(next);
      return;
    }
    for (const child of descendants) visit(child, next);
  };
  for (const root of stable(roots)) visit(root, []);
  return paths.length ? paths : [[]];
}

function createSourceHash(detail: ThreadDetail, candidates: AiCandidate[]) {
  const continuations =
    detail.allContinuations ?? detail.continuations ?? [];
  const canonical = {
    thread: {
      id: detail.thread.id,
      title: detail.thread.title ?? "",
      startingContent: detail.thread.startingContent ?? "",
      rules: detail.thread.rules ?? detail.thread.content
    },
    nodes: [...continuations]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((line) => ({
        id: line.id,
        parentId: line.parentContinuationId ?? null,
        lineNumber: line.lineNumber ?? null,
        text: line.content,
        authorId: line.author.id
      })),
    candidateIds: candidates.map((candidate) => candidate.id),
    promptVersion: THREAD_VERSION_AI_PROMPT_VERSION,
    model: communitySparkModel()
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function parseWorkerResult(value?: string): ThreadVersionAiResult {
  if (!value) throw new Error("LLM_EMPTY_RESPONSE");
  const result = JSON.parse(value) as Partial<ThreadVersionAiResult>;
  if (
    typeof result.selectedVersionId !== "string" ||
    typeof result.recommendedRationale !== "string" ||
    typeof result.harmonizedRationale !== "string" ||
    !Array.isArray(result.harmonizedLines)
  ) {
    throw new Error("LLM_INVALID_RESPONSE");
  }
  return result as ThreadVersionAiResult;
}

function versionContentHash(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function deriveStartingContentFallback(content: string) {
  const sentences = content.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  return sentences.length > 1 ? sentences[sentences.length - 1]! : content;
}

function normalizeWorkerError(error: unknown) {
  if (!(error instanceof Error)) return "THREAD_VERSION_AI_FAILED";
  const message = error.message.toLocaleLowerCase();
  if (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return "LLM_TIMEOUT";
  }
  return error.message.startsWith("LLM_")
    ? error.message
    : error.message.slice(0, 120) || "THREAD_VERSION_AI_FAILED";
}

function requireServiceClient() {
  const client = createServiceRoleDatabaseClient();
  if (!client) throw new Error("THREAD_VERSION_AI_DATABASE_NOT_CONFIGURED");
  return client;
}
