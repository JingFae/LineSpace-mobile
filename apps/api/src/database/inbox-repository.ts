import type {
  CreateInboxGroupInput,
  InboxActivitySummary,
  InboxConversationMessage,
  InboxGroup,
  InviteInboxGroupMembersInput,
  RespondInboxGroupInviteInput,
  SendInboxMessageInput,
  SharePoemToGroupInput,
  ShareThreadToGroupInput,
  UserProfile
} from "@linespace/api-client";
import type { DatabaseClient } from "./repository-support.js";
import {
  ensureDatabaseResult,
  getCurrentLinespaceUserId,
  loadProfiles,
  type UserRow
} from "./repository-support.js";

type MessageRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  group_id?: string | null;
  kind: "text" | "shared-post" | "shared-thread" | "shared-continuation";
  text_body: string | null;
  post_id: string | null;
  thread_id: string | null;
  continuation_id: string | null;
  excerpt: string | null;
  line_number: number | null;
  created_at: string;
};

type GroupRow = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string;
  category: "comments" | "likes" | "thread" | "social";
  action: "commented" | "liked" | "saved" | "continued" | "followed" | "mentioned";
  target_kind: "post" | "comment" | "thread" | "profile";
  post_id: string | null;
  comment_id: string | null;
  thread_id: string | null;
  title: string;
  excerpt: string;
  created_at: string;
  read_at: string | null;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  status: "invited" | "active" | "declined";
  invited_by_user_id: string | null;
  invited_at: string;
  joined_at: string | null;
};

const messageSelect =
  "id,sender_user_id,recipient_user_id,kind,text_body,post_id,thread_id,continuation_id,excerpt,line_number,created_at";
const activityKinds = ["comments", "likes", "thread", "social"] as const;

export class InboxRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getInboxActivitySummary(userId: string): Promise<InboxActivitySummary> {
    await this.assertActor(userId);
    const [result, countResults] = await Promise.all([
      this.client
        .from("inbox_activity_events")
        .select(
          "id,recipient_user_id,actor_user_id,category,action,target_kind,post_id,comment_id,thread_id,title,excerpt,created_at,read_at"
        )
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      Promise.all(
        activityKinds.flatMap((kind) => [
          this.client
            .from("inbox_activity_events")
            .select("id", { count: "exact", head: true })
            .eq("recipient_user_id", userId)
            .eq("category", kind),
          this.client
            .from("inbox_activity_events")
            .select("id", { count: "exact", head: true })
            .eq("recipient_user_id", userId)
            .eq("category", kind)
            .is("read_at", null)
        ])
      )
    ]);
    ensureDatabaseResult(result.error);
    const rows = (result.data as ActivityRow[] | null) ?? [];
    const profiles = await loadProfiles(this.client, rows.map((row) => row.actor_user_id));
    const summary: InboxActivitySummary = {
      userId,
      unread: { comments: 0, likes: 0, thread: 0, social: 0 },
      totals: { comments: 0, likes: 0, thread: 0, social: 0 },
      recent: { comments: [], likes: [], thread: [], social: [] }
    };
    activityKinds.forEach((kind, index) => {
      const totalResult = countResults[index * 2];
      const unreadResult = countResults[index * 2 + 1];
      if (!totalResult || !unreadResult) return;
      ensureDatabaseResult(totalResult.error);
      ensureDatabaseResult(unreadResult.error);
      summary.totals[kind] = totalResult.count ?? 0;
      summary.unread[kind] = unreadResult.count ?? 0;
    });
    for (const row of rows) {
      if (summary.recent[row.category].length >= 50) continue;
      summary.recent[row.category].push({
        id: row.id,
        kind: row.category,
        action: row.action,
        actor: profiles.get(row.actor_user_id) ?? unknownProfile(row.actor_user_id),
        target: {
          kind: row.target_kind,
          title: row.title,
          excerpt: row.excerpt,
          ...(row.post_id ? { poemId: row.post_id } : {}),
          ...(row.comment_id ? { commentId: row.comment_id } : {}),
          ...(row.thread_id ? { threadId: row.thread_id } : {})
        },
        dateLabel: activityDateLabel(row.created_at),
        unread: !row.read_at
      });
    }
    return summary;
  }

  async listInboxMessages(
    userId: string,
    contactId: string
  ): Promise<InboxConversationMessage[]> {
    await this.assertActor(userId);
    const [sentResult, receivedResult] = await Promise.all([
      this.client
        .from("inbox_messages")
        .select(messageSelect)
        .eq("sender_user_id", userId)
        .eq("recipient_user_id", contactId)
        .order("created_at", { ascending: true }),
      this.client
        .from("inbox_messages")
        .select(messageSelect)
        .eq("sender_user_id", contactId)
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: true })
    ]);
    ensureDatabaseResult(sentResult.error);
    ensureDatabaseResult(receivedResult.error);
    const rows = [
      ...((sentResult.data as MessageRow[] | null) ?? []),
      ...((receivedResult.data as MessageRow[] | null) ?? [])
    ].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
    return this.mapMessages(rows);
  }

  async sendInboxMessage(
    input: SendInboxMessageInput
  ): Promise<InboxConversationMessage> {
    await this.assertActor(input.senderId);
    if (input.groupId) {
      const result = await this.client.rpc("send_group_message", {
        p_group_id: input.groupId,
        p_text: input.text
      });
      ensureDatabaseResult(result.error);
      return this.mapGroupMessage(result.data as GroupMessageRow);
    }
    if (!input.recipientId) throw new Error("recipient required");
    const result = await this.client.rpc("send_inbox_message", {
      p_recipient_user_id: input.recipientId,
      p_text: input.text,
      p_kind: "text",
      p_post_id: null,
      p_thread_id: null,
      p_continuation_id: null,
      p_excerpt: null
    });
    ensureDatabaseResult(result.error);
    const rows = await this.mapMessages([result.data as MessageRow]);
    const message = rows[0];
    if (!message) throw new Error("message was not created");
    return message;
  }

  async sharePoemToGroup(
    input: SharePoemToGroupInput
  ): Promise<InboxConversationMessage> {
    await this.assertActor(input.senderId);
    const result = await this.client.rpc("share_post_to_inbox_group", {
      p_group_id: input.groupId,
      p_post_id: input.poemId,
      p_note: input.note ?? null
    });
    ensureDatabaseResult(result.error);
    return this.mapGroupMessage(result.data as GroupMessageRow);
  }

  async shareThreadToGroup(
    input: ShareThreadToGroupInput
  ): Promise<InboxConversationMessage> {
    await this.assertActor(input.senderId);
    const result = await this.client.rpc("share_thread_to_inbox_group", {
      p_group_id: input.groupId,
      p_thread_id: input.threadId,
      p_continuation_id: input.continuationId ?? null,
      p_note: input.note ?? null
    });
    ensureDatabaseResult(result.error);
    return this.mapGroupMessage(result.data as GroupMessageRow);
  }

  async listInboxGroups(userId: string): Promise<InboxGroup[]> {
    await this.assertActor(userId);
    const result = await this.client
      .from("inbox_groups")
      .select("id,name,owner_user_id,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    ensureDatabaseResult(result.error);
    const groups = (result.data as GroupRow[] | null) ?? [];
    return Promise.all(groups.map((group) => this.mapGroup(group)));
  }

  async listInboxGroupInvites(userId: string): Promise<InboxGroup[]> {
    await this.assertActor(userId);
    const membersResult = await this.client
      .from("inbox_group_members")
      .select("group_id")
      .eq("user_id", userId)
      .eq("status", "invited");
    ensureDatabaseResult(membersResult.error);
    const ids = ((membersResult.data as Array<{ group_id: string }> | null) ?? []).map(
      (row) => row.group_id
    );
    if (ids.length === 0) return [];
    const result = await this.client
      .from("inbox_groups")
      .select("id,name,owner_user_id,created_at,updated_at")
      .in("id", ids)
      .order("updated_at", { ascending: false });
    ensureDatabaseResult(result.error);
    return Promise.all(
      ((result.data as GroupRow[] | null) ?? []).map((group) => this.mapGroup(group))
    );
  }

  async getInboxGroup(groupId: string, userId: string): Promise<InboxGroup | null> {
    await this.assertActor(userId);
    const result = await this.client
      .from("inbox_groups")
      .select("id,name,owner_user_id,created_at,updated_at")
      .eq("id", groupId)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    return result.data ? this.mapGroup(result.data as GroupRow) : null;
  }

  async createInboxGroup(input: CreateInboxGroupInput): Promise<InboxGroup> {
    await this.assertActor(input.ownerId);
    const result = await this.client.rpc("create_inbox_group", {
      p_name: input.name,
      p_invitee_user_ids: [...new Set(input.inviteeIds)]
    });
    ensureDatabaseResult(result.error);
    const group = result.data as GroupRow | null;
    if (!group) throw new Error("group was not created");
    const mapped = await this.mapGroup(group);
    return mapped;
  }

  async updateInboxGroup(input: {
    groupId: string;
    userId: string;
    name: string;
  }): Promise<InboxGroup> {
    await this.assertActor(input.userId);
    const result = await this.client
      .from("inbox_groups")
      .update({ name: input.name.trim() })
      .eq("id", input.groupId)
      .eq("owner_user_id", input.userId)
      .select("id,name,owner_user_id,created_at,updated_at")
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) throw new Error("group not found or forbidden");
    return this.mapGroup(result.data as GroupRow);
  }

  async inviteInboxGroupMembers(
    input: InviteInboxGroupMembersInput
  ): Promise<InboxGroup> {
    await this.assertActor(input.inviterId);
    const result = await this.client.rpc("invite_inbox_group_members", {
      p_group_id: input.groupId,
      p_invitee_user_ids: [...new Set(input.inviteeIds)]
    });
    ensureDatabaseResult(result.error);
    const group = await this.getInboxGroup(input.groupId, input.inviterId);
    if (!group) throw new Error("group not found");
    return group;
  }

  async respondInboxGroupInvite(
    input: RespondInboxGroupInviteInput
  ): Promise<InboxGroup> {
    await this.assertActor(input.userId);
    const result = await this.client.rpc("respond_to_group_invitation", {
      p_group_id: input.groupId,
      p_response: input.accept ? "accepted" : "declined"
    });
    ensureDatabaseResult(result.error);
    const group = await this.getInboxGroup(input.groupId, input.userId);
    if (!group) throw new Error("group not found");
    return group;
  }

  async listInboxGroupMessages(
    groupId: string,
    userId: string
  ): Promise<InboxConversationMessage[]> {
    await this.assertActor(userId);
    const result = await this.client
      .from("inbox_group_messages")
      .select("id,group_id,sender_user_id,kind,text_body,post_id,thread_id,continuation_id,excerpt,line_number,created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });
    ensureDatabaseResult(result.error);
    return this.mapGroupMessages((result.data as GroupMessageRow[] | null) ?? []);
  }

  private async mapMessages(rows: MessageRow[]): Promise<InboxConversationMessage[]> {
    if (rows.length === 0) return [];
    const profiles = await loadProfiles(
      this.client,
      rows.flatMap((row) => [row.sender_user_id, row.recipient_user_id])
    );
    const postIds = rows
      .map((row) => row.post_id)
      .filter((id): id is string => Boolean(id));
    const threadIds = rows
      .map((row) => row.thread_id)
      .filter((id): id is string => Boolean(id));
    const [postsResult, threadsResult] = await Promise.all([
      postIds.length
        ? this.client
            .from("posts")
            .select("id,title,body,tags,artwork_url,author_user_id")
            .in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      threadIds.length
        ? this.client
            .from("poetry_threads")
            .select("id,title,starting_content,author_user_id,media")
            .in("id", threadIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    ensureDatabaseResult(postsResult.error);
    ensureDatabaseResult(threadsResult.error);
    const postRows = (postsResult.data as Array<{
      id: string;
      title: string;
      body: string;
      tags: string[] | null;
      artwork_url: string | null;
      author_user_id: string;
    }> | null) ?? [];
    const threadRows = (threadsResult.data as Array<{
      id: string;
      title: string | null;
      starting_content: string;
      author_user_id: string;
      media: { uri?: string } | null;
    }> | null) ?? [];
    const contentProfiles = await loadProfiles(this.client, [
      ...postRows.map((row) => row.author_user_id),
      ...threadRows.map((row) => row.author_user_id)
    ]);
    const posts = new Map(
      postRows.map((row) => [
        row.id,
        {
          id: row.id,
          title: row.title,
          excerpt: row.body.slice(0, 160),
          tags: row.tags ?? [],
          author:
            contentProfiles.get(row.author_user_id) ??
            unknownProfile(row.author_user_id),
          ...(row.artwork_url ? { artworkUrl: row.artwork_url } : {})
        }
      ])
    );
    const threads = new Map(
      threadRows.map((row) => [
        row.id,
        {
          title: row.title ?? "Shared thread",
          excerpt: row.starting_content.slice(0, 160),
          author:
            contentProfiles.get(row.author_user_id) ??
            unknownProfile(row.author_user_id),
          ...(typeof row.media?.uri === "string" ? { artworkUrl: row.media.uri } : {})
        }
      ])
    );
    return rows.map((row) => ({
      id: row.id,
      sender: profiles.get(row.sender_user_id) ?? unknownProfile(row.sender_user_id),
      ...(profiles.get(row.recipient_user_id)
        ? { recipient: profiles.get(row.recipient_user_id) }
        : {}),
      createdAt: row.created_at,
      kind: row.kind,
      ...(row.text_body ? { text: row.text_body } : {}),
      ...(row.post_id && posts.get(row.post_id)
        ? { sharedPost: posts.get(row.post_id) }
        : {}),
      ...(row.thread_id && threads.get(row.thread_id)
        ? {
            sharedThread: {
              threadId: row.thread_id,
              ...(row.continuation_id
                ? { continuationId: row.continuation_id }
                : {}),
              title: threads.get(row.thread_id)!.title,
              excerpt: row.excerpt ?? threads.get(row.thread_id)!.excerpt,
              ...(row.line_number ? { lineNumber: row.line_number } : {}),
              author: threads.get(row.thread_id)!.author
            }
          }
        : {})
    }));
  }

  private async mapGroupMessage(row: GroupMessageRow): Promise<InboxConversationMessage> {
    const messages = await this.mapGroupMessages([row]);
    const message = messages[0];
    if (!message) throw new Error("group message was not found");
    return message;
  }

  private async mapGroupMessages(
    rows: GroupMessageRow[]
  ): Promise<InboxConversationMessage[]> {
    if (rows.length === 0) return [];
    const postIds = rows.flatMap((row) => (row.post_id ? [row.post_id] : []));
    const threadIds = rows.flatMap((row) => (row.thread_id ? [row.thread_id] : []));
    const [profiles, postsResult, threadsResult] = await Promise.all([
      loadProfiles(this.client, rows.map((row) => row.sender_user_id)),
      postIds.length
        ? this.client
            .from("posts")
            .select("id,title,body,tags,artwork_url,author_user_id")
            .in("id", [...new Set(postIds)])
        : Promise.resolve({ data: [], error: null }),
      threadIds.length
        ? this.client
            .from("poetry_threads")
            .select("id,title,starting_content,author_user_id,media")
            .in("id", [...new Set(threadIds)])
        : Promise.resolve({ data: [], error: null })
    ]);
    ensureDatabaseResult(postsResult.error);
    ensureDatabaseResult(threadsResult.error);
    const postRows = (postsResult.data as Array<{
      id: string;
      title: string;
      body: string;
      tags: string[] | null;
      artwork_url: string | null;
      author_user_id: string;
    }> | null) ?? [];
    const threadRows = (threadsResult.data as Array<{
      id: string;
      title: string | null;
      starting_content: string;
      author_user_id: string;
      media: { uri?: string } | null;
    }> | null) ?? [];
    const contentProfiles = await loadProfiles(this.client, [
      ...postRows.map((row) => row.author_user_id),
      ...threadRows.map((row) => row.author_user_id)
    ]);
    const posts = new Map(
      postRows.map((row) => [
        row.id,
        {
          id: row.id,
          title: row.title,
          excerpt: row.body.slice(0, 160),
          tags: row.tags ?? [],
          author:
            contentProfiles.get(row.author_user_id) ??
            unknownProfile(row.author_user_id),
          ...(row.artwork_url ? { artworkUrl: row.artwork_url } : {})
        }
      ])
    );
    const threads = new Map(
      threadRows.map((row) => [
        row.id,
        {
          title: row.title ?? "Shared thread",
          excerpt: row.starting_content.slice(0, 160),
          author:
            contentProfiles.get(row.author_user_id) ??
            unknownProfile(row.author_user_id),
          ...(typeof row.media?.uri === "string" ? { artworkUrl: row.media.uri } : {})
        }
      ])
    );
    return rows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      sender: profiles.get(row.sender_user_id) ?? unknownProfile(row.sender_user_id),
      createdAt: row.created_at,
      kind: row.kind,
      ...(row.text_body ? { text: row.text_body } : {}),
      ...(row.post_id && posts.get(row.post_id)
        ? { sharedPost: posts.get(row.post_id) }
        : {}),
      ...(row.thread_id && threads.get(row.thread_id)
        ? {
            sharedThread: {
              threadId: row.thread_id,
              ...(row.continuation_id
                ? { continuationId: row.continuation_id }
                : {}),
              title: threads.get(row.thread_id)!.title,
              excerpt: row.excerpt ?? threads.get(row.thread_id)!.excerpt,
              ...(row.line_number ? { lineNumber: row.line_number } : {}),
              author: threads.get(row.thread_id)!.author,
              ...(threads.get(row.thread_id)!.artworkUrl
                ? { artworkUrl: threads.get(row.thread_id)!.artworkUrl }
                : {})
            }
          }
        : {})
    }));
  }

  private async mapGroup(group: GroupRow): Promise<InboxGroup> {
    const membersResult = await this.client
      .from("inbox_group_members")
      .select(
        "group_id,user_id,role,status,invited_by_user_id,invited_at,joined_at"
      )
      .eq("group_id", group.id)
      .order("invited_at", { ascending: true });
    ensureDatabaseResult(membersResult.error);
    const members = (membersResult.data as MemberRow[] | null) ?? [];
    const profiles = await loadProfiles(this.client, [
      ...members.map((item) => item.user_id),
      ...members
        .map((item) => item.invited_by_user_id)
        .filter((id): id is string => Boolean(id))
    ]);
    const lastMessageResult = await this.client
      .from("inbox_group_messages")
      .select("id,group_id,sender_user_id,kind,text_body,post_id,thread_id,continuation_id,excerpt,line_number,created_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .limit(1);
    ensureDatabaseResult(lastMessageResult.error);
    const last = ((lastMessageResult.data as GroupMessageRow[] | null) ?? [])[0];
    return {
      id: group.id,
      name: group.name,
      ownerId: group.owner_user_id,
      members: members.flatMap((member) => {
        const user = profiles.get(member.user_id);
        if (!user) return [];
        return [
          {
            user,
            role: member.role,
            status: member.status,
            ...(member.invited_by_user_id && profiles.get(member.invited_by_user_id)
              ? { invitedBy: profiles.get(member.invited_by_user_id) }
              : {}),
            invitedAt: member.invited_at,
            ...(member.joined_at ? { joinedAt: member.joined_at } : {})
          }
        ];
      }),
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      ...(last ? { lastMessage: await this.mapGroupMessage(last) } : {})
    };
  }

  private async assertActor(userId: string): Promise<void> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== userId) throw new Error("inbox actor mismatch");
  }
}

type GroupMessageRow = {
  id: string;
  group_id: string;
  sender_user_id: string;
  kind: "text" | "shared-post" | "shared-thread" | "shared-continuation";
  text_body: string | null;
  post_id: string | null;
  thread_id: string | null;
  continuation_id: string | null;
  excerpt: string | null;
  line_number: number | null;
  created_at: string;
};

function unknownProfile(id: string): UserProfile {
  return {
    id,
    handle: "unknown",
    displayName: "Unknown",
    avatarColor: "#DCD8D3"
  };
}

function activityDateLabel(value: string): string {
  const date = new Date(value);
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
