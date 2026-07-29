import type {
  ThreadAiHarmonizedLine,
  ThreadAiVersions
} from "@linespace/api-client";
import type { DatabaseClient } from "../core/client.js";
import { ensureDatabaseResult } from "../core/errors.js";

type SnapshotRow = {
  source_revision: number;
  status: "processing" | "ready" | "failed";
  prompt_version: string;
  model: string;
  result: unknown;
  generated_at: string | null;
  error_code: string | null;
};

export class ThreadAiVersionRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getThreadAiVersions(
    threadId: string,
    promptVersion: string,
    model: string
  ): Promise<ThreadAiVersions> {
    const [threadResult, snapshotsResult] = await Promise.all([
      this.client
        .from("poetry_threads")
        .select("content_revision")
        .eq("id", threadId)
        .maybeSingle(),
      this.client
        .from("thread_ai_version_snapshots")
        .select(
          "source_revision,status,prompt_version,model,result,generated_at,error_code"
        )
        .eq("thread_id", threadId)
        .eq("prompt_version", promptVersion)
        .eq("model", model)
        .order("source_revision", { ascending: false })
        .limit(20)
    ]);
    ensureDatabaseResult(threadResult.error);
    ensureDatabaseResult(snapshotsResult.error);
    const thread = threadResult.data as { content_revision?: number } | null;
    if (!thread) throw new Error("thread not found");
    const sourceRevision = Math.max(1, Number(thread.content_revision) || 1);
    const snapshots = (snapshotsResult.data as SnapshotRow[] | null) ?? [];
    const current = snapshots.find(
      (snapshot) => snapshot.source_revision === sourceRevision
    );
    const ready =
      current?.status === "ready"
        ? current
        : snapshots.find((snapshot) => snapshot.status === "ready");
    const parsed = ready ? parseSnapshotResult(ready.result) : undefined;
    const status =
      current?.status === "ready"
        ? "ready"
        : current?.status === "failed"
          ? "failed"
          : current?.status === "processing"
            ? "processing"
            : "pending";

    return {
      threadId,
      sourceRevision,
      ...(ready ? { snapshotRevision: ready.source_revision } : {}),
      status,
      isStale: Boolean(ready && ready.source_revision !== sourceRevision),
      promptVersion,
      model,
      ...(parsed
        ? {
            recommended: {
              selectedVersionId: parsed.selectedVersionId,
              rationale: parsed.recommendedRationale,
              confidence: parsed.confidence
            },
            harmonized: {
              rationale: parsed.harmonizedRationale,
              lines: parsed.harmonizedLines
            }
          }
        : {}),
      ...(ready?.generated_at ? { generatedAt: ready.generated_at } : {}),
      ...(current?.error_code ? { errorCode: current.error_code } : {})
    };
  }
}

type StoredThreadAiResult = {
  selectedVersionId: string;
  recommendedRationale: string;
  confidence: number;
  harmonizedRationale: string;
  harmonizedLines: ThreadAiHarmonizedLine[];
};

function parseSnapshotResult(value: unknown): StoredThreadAiResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  if (
    typeof source.selectedVersionId !== "string" ||
    typeof source.recommendedRationale !== "string" ||
    typeof source.harmonizedRationale !== "string" ||
    !Array.isArray(source.harmonizedLines)
  ) {
    return undefined;
  }
  const harmonizedLines = source.harmonizedLines.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const line = value as Record<string, unknown>;
    if (
      typeof line.lineId !== "string" ||
      typeof line.text !== "string" ||
      typeof line.changed !== "boolean"
    ) {
      return [];
    }
    return [{
      lineId: line.lineId,
      text: line.text,
      changeNote:
        typeof line.changeNote === "string" ? line.changeNote : "",
      changed: line.changed
    }];
  });
  return {
    selectedVersionId: source.selectedVersionId,
    recommendedRationale: source.recommendedRationale,
    confidence:
      typeof source.confidence === "number" && Number.isFinite(source.confidence)
        ? Math.max(0, Math.min(1, source.confidence))
        : 0.5,
    harmonizedRationale: source.harmonizedRationale,
    harmonizedLines
  };
}
