import type {
  ContentSearchResult,
  PoemSummary,
  TagContentResult
} from "@linespace/api-client";
import { getCurrentLinespaceUserId } from "../core/auth-context.js";
import type { DatabaseClient } from "../core/client.js";
import { ensureDatabaseResult } from "../core/errors.js";
import type { ProfileRepository } from "../profile/profile.repository.js";
import { PostRepository } from "../post/post.repository.js";
import { ThreadRepository } from "../thread/thread.repository.js";

export class ContentDiscoveryQuery {
  constructor(
    private readonly client: DatabaseClient,
    private readonly profiles: ProfileRepository,
    private readonly posts: PostRepository,
    private readonly threads: ThreadRepository
  ) {}

  async searchContent(
    query: string,
    _viewerId: string
  ): Promise<ContentSearchResult> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId) throw new Error("search requires an authenticated user");
    const normalized = query.trim();
    if (!normalized) return { query: "", posts: [], threads: [], users: [] };
    const idsResult = await this.client.rpc("search_content_ids", {
      p_query: normalized,
      p_limit: 40
    });
    ensureDatabaseResult(idsResult.error);
    const rows = (idsResult.data as Array<{
      content_kind: "post" | "thread";
      content_id: string;
    }> | null) ?? [];
    const postIds = rows
      .filter((row) => row.content_kind === "post")
      .map((row) => row.content_id);
    const threadIds = rows
      .filter((row) => row.content_kind === "thread")
      .map((row) => row.content_id);
    const [postItems, threadItems, userPage] = await Promise.all([
      Promise.all(postIds.map((id) => this.posts.getPoem(id))),
      Promise.all(threadIds.map((id) => this.threads.getThread(id))),
      this.profiles.searchUsers(actorId, normalized, { limit: 30 })
    ]);
    const users = [
      ...userPage.recent,
      ...userPage.friends,
      ...userPage.results
    ].filter(
      (user, index, items) =>
        items.findIndex((item) => item.id === user.id) === index
    );
    return {
      query: normalized,
      posts: postItems.filter((item): item is PoemSummary => Boolean(item)),
      threads: threadItems.flatMap((item) => (item ? [item.thread] : [])),
      users
    };
  }

  async listTagContent(
    tag: string,
    _viewerId: string
  ): Promise<TagContentResult> {
    const normalized = tag.trim().replace(/^#+/, "").toLocaleLowerCase();
    if (!normalized) return { tag: "", posts: [], threads: [] };
    const idsResult = await this.client.rpc("list_tag_content_ids", {
      p_tag: normalized,
      p_limit: 100
    });
    ensureDatabaseResult(idsResult.error);
    const rows = (idsResult.data as Array<{
      content_kind: "post" | "thread";
      content_id: string;
    }> | null) ?? [];
    const postIds = rows
      .filter((row) => row.content_kind === "post")
      .map((row) => row.content_id);
    const threadIds = rows
      .filter((row) => row.content_kind === "thread")
      .map((row) => row.content_id);
    const [postItems, threadItems] = await Promise.all([
      Promise.all(postIds.map((id) => this.posts.getPoem(id))),
      Promise.all(threadIds.map((id) => this.threads.getThread(id)))
    ]);
    return {
      tag: normalized,
      posts: postItems.filter((item): item is PoemSummary => Boolean(item)),
      threads: threadItems.flatMap((item) => (item ? [item.thread] : []))
    };
  }
}
