import type {
  ContinuationDetail,
  InboxConversationMessage,
  PoetryThread,
  ShareThreadInput,
  ThreadContinuation,
  ThreadDetail,
  ThreadFeedQuery,
  ThreadShareResult,
  UpdateContinuationLikeInput,
  UpdateThreadCollectionInput,
  UpdateThreadLikeInput
} from "@linespace/api-client";
import type { DatabaseClient, UserRow } from "./repository-support";
import {
  countValue,
  ensureDatabaseResult,
  getCurrentLinespaceUserId,
  loadProfiles,
  toUserProfile
} from "./repository-support";

type ThreadRow = {
  id: string;
  author_user_id: string;
  title: string | null;
  prompt: string;
  starting_content: string;
  rules: string | null;
  tags: string[] | null;
  mentions: string[] | null;
  media: unknown;
  visibility: "public" | "include" | "exclude";
  status: "open" | "complete";
  created_at: string;
  updated_at: string;
};

type ContinuationRow = {
  id: string;
  thread_id: string;
  parent_continuation_id: string | null;
  line_number: number;
  content: string;
  author_user_id: string;
  created_at: string;
  updated_at: string;
};

const threadSelect =
  "id,author_user_id,title,prompt,starting_content,rules,tags,mentions,media,visibility,status,created_at,updated_at";
const continuationSelect =
  "id,thread_id,parent_continuation_id,line_number,content,author_user_id,created_at,updated_at";

export class ThreadRepository {
  constructor(private readonly client: DatabaseClient) {}

  async listThreads(query: ThreadFeedQuery = {}): Promise<PoetryThread[]> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    let request = this.client
      .from("poetry_threads")
      .select(threadSelect)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100);

    if (query.sort === "following") {
      if (!actorId) return [];
      const follows = await this.client
        .from("user_follows")
        .select("following_user_id")
        .eq("follower_user_id", actorId);
      ensureDatabaseResult(follows.error);
      const ids = ((follows.data as Array<{ following_user_id: string }> | null) ?? [])
        .map((row) => row.following_user_id);
      if (ids.length === 0) return [];
      request = request.in("author_user_id", ids);
    }

    const result = await request;
    ensureDatabaseResult(result.error);
    const rows = (result.data as ThreadRow[] | null) ?? [];
    const mapped = await this.mapThreads(rows, actorId);
    if (query.sort === "top") {
      return mapped.sort((left, right) => right.metrics.likes - left.metrics.likes);
    }
    return mapped;
  }

  async getThread(threadId: string): Promise<ThreadDetail | null> {
    const result = await this.client
      .from("poetry_threads")
      .select(threadSelect)
      .eq("id", threadId)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) return null;
    const actorId = await getCurrentLinespaceUserId(this.client);
    const threads = await this.mapThreads([result.data as ThreadRow], actorId);
    const thread = threads[0];
    if (!thread) return null;
    const continuationRows = await this.loadContinuations(threadId);
    return {
      thread,
      continuations: await this.mapContinuations(continuationRows, actorId)
    };
  }

  async getContinuationDetail(continuationId: string): Promise<ContinuationDetail | null> {
    const currentResult = await this.client
      .from("thread_continuations")
      .select(continuationSelect)
      .eq("id", continuationId)
      .maybeSingle();
    ensureDatabaseResult(currentResult.error);
    if (!currentResult.data) return null;
    const currentRow = currentResult.data as ContinuationRow;
    const detail = await this.getThread(currentRow.thread_id);
    if (!detail) return null;
    const byId = new Map(detail.continuations.map((item) => [item.id, item]));
    const path: ThreadContinuation[] = [];
    let cursor = currentRow.parent_continuation_id;
    while (cursor) {
      const item = byId.get(cursor);
      if (!item) break;
      path.unshift(item);
      cursor = item.parentContinuationId ?? null;
    }
    const children = detail.continuations.filter(
      (item) => item.parentContinuationId === currentRow.id
    );
    const current = byId.get(currentRow.id);
    if (!current) return null;
    return {
      thread: detail.thread,
      path,
      current,
      children
    };
  }

  async createThreadContinuation(input: {
    threadId: string;
    userId: string;
    content: string;
  }): Promise<ThreadContinuation> {
    return this.insertContinuation({
      threadId: input.threadId,
      parentContinuationId: null,
      lineNumber: 2,
      userId: input.userId,
      content: input.content
    });
  }

  async createContinuation(input: {
    continuationId: string;
    userId: string;
    content: string;
  }): Promise<ThreadContinuation> {
    const parentResult = await this.client
      .from("thread_continuations")
      .select("thread_id,line_number")
      .eq("id", input.continuationId)
      .maybeSingle();
    ensureDatabaseResult(parentResult.error);
    const parent = parentResult.data as
      | { thread_id: string; line_number: number }
      | null;
    if (!parent) throw new Error("continuation not found");
    return this.insertContinuation({
      threadId: parent.thread_id,
      parentContinuationId: input.continuationId,
      lineNumber: parent.line_number + 1,
      userId: input.userId,
      content: input.content
    });
  }

  async setThreadLike(input: UpdateThreadLikeInput): Promise<PoetryThread> {
    await this.setEngagement(
      "thread_likes",
      "thread_id",
      input.threadId,
      input.userId,
      input.isActive
    );
    const detail = await this.getThread(input.threadId);
    if (!detail) throw new Error("thread not found");
    return detail.thread;
  }

  async setContinuationLike(input: UpdateContinuationLikeInput): Promise<ThreadContinuation> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) throw new Error("like actor mismatch");
    if (input.isActive) {
      const result = await this.client.from("thread_continuation_likes").upsert(
        { continuation_id: input.continuationId, user_id: actorId },
        { onConflict: "continuation_id,user_id", ignoreDuplicates: true }
      );
      ensureDatabaseResult(result.error);
    } else {
      const result = await this.client
        .from("thread_continuation_likes")
        .delete()
        .eq("continuation_id", input.continuationId)
        .eq("user_id", actorId);
      ensureDatabaseResult(result.error);
    }
    const result = await this.client
      .from("thread_continuations")
      .select(continuationSelect)
      .eq("id", input.continuationId)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) throw new Error("continuation not found");
    const rows = await this.mapContinuations(
      [result.data as ContinuationRow],
      actorId
    );
    const continuation = rows[0];
    if (!continuation) throw new Error("continuation not found");
    return continuation;
  }

  async setThreadCollection(input: UpdateThreadCollectionInput): Promise<PoetryThread> {
    await this.setEngagement(
      "thread_saves",
      "thread_id",
      input.threadId,
      input.userId,
      input.isActive
    );
    const detail = await this.getThread(input.threadId);
    if (!detail) throw new Error("thread not found");
    return detail.thread;
  }

  async recordThreadShare(target: {
    kind: "thread" | "continuation";
    threadId?: string;
    continuationId?: string;
    userId: string;
  }): Promise<ThreadShareResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== target.userId) throw new Error("share actor mismatch");
    const threadId =
      target.threadId ??
      (await this.client
        .from("thread_continuations")
        .select("thread_id")
        .eq("id", target.continuationId ?? "")
        .single()).data?.thread_id;
    if (!threadId) throw new Error("thread not found");
    const countResult = await this.client
      .from("thread_shares")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId);
    ensureDatabaseResult(countResult.error);
    return {
      targetId: target.continuationId ?? threadId,
      shareCount: countValue(countResult.count)
    };
  }

  async shareThread(input: ShareThreadInput): Promise<ThreadShareResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.senderId) throw new Error("share actor mismatch");
    const result = await this.client.rpc("share_thread_to_inbox", {
      p_thread_id: input.threadId ?? null,
      p_continuation_id: input.continuationId ?? null,
      p_recipient_user_ids: [...new Set(input.recipientIds)],
      p_note: input.note ?? null
    });
    ensureDatabaseResult(result.error);
    const rows = (result.data as InboxRow[] | null) ?? [];
    const profiles = await loadProfiles(
      this.client,
      rows.flatMap((row) => [row.sender_user_id, row.recipient_user_id])
    );
    const messages: InboxConversationMessage[] = rows.map((row) => ({
      id: row.id,
      sender: profiles.get(row.sender_user_id) ?? {
        id: row.sender_user_id,
        handle: "unknown",
        displayName: "Unknown",
        avatarColor: "#DCD8D3"
      },
      recipient: profiles.get(row.recipient_user_id),
      createdAt: row.created_at,
      kind: row.kind,
      ...(row.text_body ? { text: row.text_body } : {}),
      sharedThread: {
        threadId: row.thread_id ?? input.threadId ?? "",
        ...(row.continuation_id ? { continuationId: row.continuation_id } : {}),
        title: row.excerpt ?? "Shared thread",
        excerpt: row.excerpt ?? "",
        author: profiles.get(row.sender_user_id) ?? {
          id: row.sender_user_id,
          handle: "unknown",
          displayName: "Unknown",
          avatarColor: "#DCD8D3"
        }
      }
    }));
    return {
      targetId: input.continuationId ?? input.threadId ?? "",
      shareCount: messages.length,
      recipientIds: input.recipientIds,
      messages
    };
  }

  async listThreadVersions(threadId: string): Promise<unknown[]> {
    const result = await this.client
      .from("thread_versions")
      .select("id,thread_id,kind,title,selected_continuation_ids,total_likes,line_count,ai_rationale,created_by,created_at,updated_at")
      .eq("thread_id", threadId)
      .order("updated_at", { ascending: false });
    ensureDatabaseResult(result.error);
    return (result.data as unknown[] | null) ?? [];
  }

  private async insertContinuation(input: {
    threadId: string;
    parentContinuationId: string | null;
    lineNumber: number;
    userId: string;
    content: string;
  }): Promise<ThreadContinuation> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) throw new Error("continuation actor mismatch");
    const result = await this.client
      .from("thread_continuations")
      .insert({
        id: crypto.randomUUID(),
        thread_id: input.threadId,
        parent_continuation_id: input.parentContinuationId,
        line_number: input.lineNumber,
        content: input.content.trim(),
        author_user_id: actorId
      })
      .select(continuationSelect)
      .single();
    ensureDatabaseResult(result.error);
    const rows = await this.mapContinuations(
      [result.data as ContinuationRow],
      actorId
    );
    const continuation = rows[0];
    if (!continuation) throw new Error("continuation not found");
    return continuation;
  }

  private async loadContinuations(threadId: string): Promise<ContinuationRow[]> {
    const result = await this.client
      .from("thread_continuations")
      .select(continuationSelect)
      .eq("thread_id", threadId)
      .order("line_number", { ascending: true })
      .order("created_at", { ascending: true });
    ensureDatabaseResult(result.error);
    return (result.data as ContinuationRow[] | null) ?? [];
  }

  private async mapThreads(
    rows: ThreadRow[],
    actorId: string | null
  ): Promise<PoetryThread[]> {
    const profiles = await loadProfiles(
      this.client,
      rows.map((row) => row.author_user_id)
    );
    const ids = rows.map((row) => row.id);
    const [likes, saves, shares, continuationCounts] = await Promise.all([
      actorId
        ? this.client.from("thread_likes").select("thread_id").eq("user_id", actorId).in("thread_id", ids)
        : Promise.resolve({ data: [], error: null }),
      actorId
        ? this.client.from("thread_saves").select("thread_id").eq("user_id", actorId).in("thread_id", ids)
        : Promise.resolve({ data: [], error: null }),
      this.client.from("thread_shares").select("thread_id").in("thread_id", ids),
      this.client.from("thread_continuations").select("thread_id").in("thread_id", ids)
    ]);
    ensureDatabaseResult(likes.error);
    ensureDatabaseResult(saves.error);
    ensureDatabaseResult(shares.error);
    ensureDatabaseResult(continuationCounts.error);
    const liked = new Set(
      ((likes.data as Array<{ thread_id: string }> | null) ?? []).map(
        (row) => row.thread_id
      )
    );
    const saved = new Set(
      ((saves.data as Array<{ thread_id: string }> | null) ?? []).map(
        (row) => row.thread_id
      )
    );
    const shareCount = countBy(
      ((shares.data as Array<{ thread_id: string }> | null) ?? []).map(
        (row) => row.thread_id
      )
    );
    const continuationCount = countBy(
      ((continuationCounts.data as Array<{ thread_id: string }> | null) ?? []).map(
        (row) => row.thread_id
      )
    );
    const likeCounts = await this.loadLikeCounts(ids);
    return rows.flatMap((row) => {
      const author = profiles.get(row.author_user_id);
      if (!author) return [];
      return [
        {
          id: row.id,
          author,
          ...(row.title ? { title: row.title } : {}),
          content: row.starting_content,
          startingContent: row.starting_content,
          ...(row.rules ? { rules: row.rules } : {}),
          tags: row.tags ?? [],
          mentions: row.mentions ?? [],
          visibility: row.visibility,
          createdAt: row.created_at,
          status: row.status,
          metrics: {
            likes: likeCounts.get(row.id) ?? 0,
            continuations: continuationCount.get(row.id) ?? 0,
            shares: shareCount.get(row.id) ?? 0,
            saves: 0
          },
          viewer: { liked: liked.has(row.id), saved: saved.has(row.id) }
        }
      ];
    });
  }

  private async mapContinuations(
    rows: ContinuationRow[],
    actorId: string | null
  ): Promise<ThreadContinuation[]> {
    const profiles = await loadProfiles(
      this.client,
      rows.map((row) => row.author_user_id)
    );
    const ids = rows.map((row) => row.id);
    const [likes, likeCounts] = await Promise.all([
      actorId
        ? this.client
            .from("thread_continuation_likes")
            .select("continuation_id")
            .eq("user_id", actorId)
            .in("continuation_id", ids)
        : Promise.resolve({ data: [], error: null }),
      this.client
        .from("thread_continuation_likes")
        .select("continuation_id")
        .in("continuation_id", ids)
    ]);
    ensureDatabaseResult(likes.error);
    ensureDatabaseResult(likeCounts.error);
    const liked = new Set(
      ((likes.data as Array<{ continuation_id: string }> | null) ?? []).map(
        (row) => row.continuation_id
      )
    );
    const counts = countBy(
      ((likeCounts.data as Array<{ continuation_id: string }> | null) ?? []).map(
        (row) => row.continuation_id
      )
    );
    return rows.flatMap((row) => {
      const author = profiles.get(row.author_user_id);
      if (!author) return [];
      return [
        {
          id: row.id,
          threadId: row.thread_id,
          ...(row.parent_continuation_id
            ? { parentContinuationId: row.parent_continuation_id }
            : {}),
          lineNumber: row.line_number,
          author,
          content: row.content,
          createdAt: row.created_at,
          metrics: {
            likes: counts.get(row.id) ?? 0,
            continuations: 0,
            shares: 0,
            saves: 0
          },
          viewer: { liked: liked.has(row.id) }
        }
      ];
    });
  }

  private async setEngagement(
    table: "thread_likes" | "thread_saves",
    idColumn: "thread_id",
    threadId: string,
    userId: string,
    active: boolean
  ) {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== userId) throw new Error("engagement actor mismatch");
    if (active) {
      const result = await this.client.from(table).upsert(
        { [idColumn]: threadId, user_id: actorId },
        { onConflict: `${idColumn},user_id`, ignoreDuplicates: true }
      );
      ensureDatabaseResult(result.error);
    } else {
      const result = await this.client
        .from(table)
        .delete()
        .eq(idColumn, threadId)
        .eq("user_id", actorId);
      ensureDatabaseResult(result.error);
    }
  }

  private async loadLikeCounts(ids: string[]): Promise<Map<string, number>> {
    const result = await this.client
      .from("thread_likes")
      .select("thread_id")
      .in("thread_id", ids);
    ensureDatabaseResult(result.error);
    return countBy(
      ((result.data as Array<{ thread_id: string }> | null) ?? []).map(
        (row) => row.thread_id
      )
    );
  }
}

function countBy(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

type InboxRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  kind: "shared-thread" | "shared-continuation";
  text_body: string | null;
  thread_id: string | null;
  continuation_id: string | null;
  excerpt: string | null;
  created_at: string;
};
