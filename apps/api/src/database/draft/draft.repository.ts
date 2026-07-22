import {
  type CreatePoemDraftInput,
  type CreateStorageUploadInput,
  type DraftInvitation,
  type DraftOperationInput,
  type InviteDraftCollaboratorInput,
  type PoemDesignCatalog,
  type PoemDraft,
  type PoemDraftMedia,
  type PoemDraftSettings,
  type PoemLayoutConfig,
  type PublishPoemDraftResult,
  type PublishThreadDraftResult,
  type SavePoemDraftInput,
  type StorageUploadTarget,
  type UpdatePoemDraftInput,
  type UserDraftPage,
  type UserConnectionPage,
  type UserProfile
} from "@linespace/api-client";
import { getCurrentLinespaceUserId } from "../core/auth-context.js";
import type { DatabaseClient } from "../core/client.js";
import { ensureDatabaseResult } from "../core/errors.js";
import {
  loadProfiles,
  toUserProfile,
  type UserRow
} from "../core/user-mapper.js";
import { arrayOfStrings, objectValue } from "../core/value-mappers.js";
import { PostRepository } from "../post/post.repository.js";
import { ThreadRepository } from "../thread/thread.repository.js";

type DraftRow = {
  id: string;
  owner_user_id: string;
  mode: "draft" | "relay";
  status: "editing" | "ready" | "published";
  title: string;
  body: string;
  relay_first_line: string | null;
  relay_rules: string | null;
  byline: string;
  tags: string[] | null;
  mentions: string[] | null;
  version_lines: unknown;
  media: unknown;
  settings: unknown;
  layout: unknown;
  version: number;
  created_at: string;
  updated_at: string;
};

const draftSelect =
  "id,owner_user_id,mode,status,title,body,relay_first_line,relay_rules,byline,tags,mentions,version_lines,media,settings,layout,version,created_at,updated_at";

const poemDesignCatalog: PoemDesignCatalog = {
  templates: [
    {
      id: "quiet-letter",
      label: "Quiet letter",
      description: "Ruled paper, literary serif and a botanical mark.",
      role: "template",
      swatch: "#F4EFE2",
      layout: {
        templateId: "quiet-letter",
        typographyId: "literary-serif",
        backgroundId: "letter-paper",
        stickerIds: ["botanical"]
      }
    },
    {
      id: "night-whisper",
      label: "Night whisper",
      description: "Dark blue paper, handwritten lines and a quiet moon.",
      role: "template",
      swatch: "#213142",
      layout: {
        templateId: "night-whisper",
        typographyId: "handwritten",
        backgroundId: "midnight",
        stickerIds: ["moon"]
      }
    },
    {
      id: "travel-postcard",
      label: "Postcard",
      description: "Warm correspondence paper with a postmark accent.",
      role: "template",
      swatch: "#EADBC5",
      layout: {
        templateId: "travel-postcard",
        typographyId: "clean-sans",
        backgroundId: "postcard",
        stickerIds: ["postmark"]
      }
    }
  ],
  typography: [
    {
      id: "literary-serif",
      label: "Literary",
      description: "A classic serif for reflective poems.",
      role: "serif",
      swatch: "#151515"
    },
    {
      id: "handwritten",
      label: "Handwritten",
      description: "A softer English script for intimate lines.",
      role: "script",
      swatch: "#38516B"
    },
    {
      id: "clean-sans",
      label: "Clear",
      description: "A restrained modern voice.",
      role: "sans",
      swatch: "#626262"
    }
  ],
  backgrounds: [
    {
      id: "letter-paper",
      label: "Letter paper",
      description: "Warm ruled stationery.",
      role: "ruled",
      swatch: "#F4EFE2"
    },
    {
      id: "kraft-paper",
      label: "Kraft",
      description: "Earthy paper with a tactile tone.",
      role: "kraft",
      swatch: "#C6A476"
    },
    {
      id: "postcard",
      label: "Postcard",
      description: "Vintage correspondence stock.",
      role: "postcard",
      swatch: "#EADBC5"
    },
    {
      id: "midnight",
      label: "Midnight",
      description: "Deep blue for luminous text.",
      role: "dark",
      swatch: "#213142"
    }
  ],
  stickers: [
    {
      id: "botanical",
      label: "Botanical",
      description: "A small pressed-leaf mark.",
      role: "botanical",
      swatch: "#66765A",
      symbol: "\u2766"
    },
    {
      id: "moon",
      label: "Moon",
      description: "A pale crescent for night poems.",
      role: "moon",
      swatch: "#F3E8C8",
      symbol: "\u263E"
    },
    {
      id: "postmark",
      label: "Postmark",
      description: "A simple correspondence stamp.",
      role: "postmark",
      swatch: "#9D5D4D",
      symbol: "\u2709"
    }
  ]
};

export class DraftRepository {
  constructor(
    private readonly client: DatabaseClient,
    private readonly posts: PostRepository,
    private readonly threads: ThreadRepository
  ) {}

  async getPoemDesignCatalog(): Promise<PoemDesignCatalog> {
    return structuredClone(poemDesignCatalog);
  }

  async createPoemDraft(input: CreatePoemDraftInput): Promise<PoemDraft> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.ownerId) throw new Error("draft actor mismatch");
    const result = await this.client.rpc("create_poem_draft", {
      p_mode: input.mode
    });
    ensureDatabaseResult(result.error);
    if (!result.data) throw new Error("draft was not created");
    return this.mapDraft(result.data as DraftRow);
  }

  async getPoemDraft(id: string): Promise<PoemDraft | null> {
    const result = await this.client
      .from("poem_drafts")
      .select(draftSelect)
      .eq("id", id)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    return result.data ? this.mapDraft(result.data as DraftRow) : null;
  }

  async updatePoemDraft(input: UpdatePoemDraftInput): Promise<PoemDraft> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) throw new Error("draft actor mismatch");
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title.trim().slice(0, 180);
    if (input.body !== undefined) patch.body = input.body;
    if (input.relayFirstLine !== undefined) {
      patch.relay_first_line = input.relayFirstLine.trim().slice(0, 1000);
    }
    if (input.relayRules !== undefined) {
      patch.relay_rules = input.relayRules.trim().slice(0, 5000);
    }
    if (input.byline !== undefined) patch.byline = input.byline.trim().slice(0, 120);
    if (input.tags !== undefined) patch.tags = input.tags.slice(0, 32);
    if (input.mentions !== undefined) patch.mentions = input.mentions.slice(0, 64);
    if (input.versionLines !== undefined) {
      patch.version_lines = input.versionLines.map((line) => ({
        lineNumber: line.lineNumber,
        text: line.text,
        authorId: line.author.id,
        ...(line.likes !== undefined ? { likes: line.likes } : {})
      }));
    }
    if (input.media !== undefined) patch.media = input.media;
    if (input.settings !== undefined) {
      const current = await this.getPoemDraft(input.draftId);
      patch.settings = {
        ...defaultSettings(),
        ...(current?.settings ?? {}),
        ...input.settings,
        audienceUserIds:
          input.settings.audienceUserIds ??
          current?.settings.audienceUserIds ??
          []
      };
    }
    if (input.layout !== undefined) patch.layout = input.layout;
    if (Object.keys(patch).length === 0) {
      const existing = await this.getPoemDraft(input.draftId);
      if (!existing) throw new Error("draft not found");
      return existing;
    }

    const result = await this.client
      .from("poem_drafts")
      .update(patch)
      .eq("id", input.draftId)
      .eq("owner_user_id", actorId)
      .select(draftSelect)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) throw new Error("draft not found or forbidden");
    return this.mapDraft(result.data as DraftRow);
  }

  async applyDraftOperation(input: DraftOperationInput): Promise<PoemDraft> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.userId) throw new Error("draft actor mismatch");
    const result = await this.client.rpc("apply_draft_operation", {
      p_draft_id: input.draftId,
      p_title: input.title,
      p_body: input.body,
      p_base_version: input.baseVersion
    });
    ensureDatabaseResult(result.error);
    if (!result.data) throw new Error("draft conflict");
    return this.mapDraft(result.data as DraftRow);
  }

  async listDraftInviteCandidates(userId: string): Promise<UserConnectionPage["items"]> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== userId) throw new Error("draft actor mismatch");
    const result = await this.client
      .from("users")
      .select("id,linespace_id,handle,display_name,avatar_url,avatar_color,bio")
      .neq("id", actorId)
      .order("handle", { ascending: true })
      .limit(50);
    ensureDatabaseResult(result.error);
    return ((result.data as UserRow[] | null) ?? []).map((row) => ({
      ...toUserProfile(row),
      isFollowing: false,
      followsYou: false,
      isFriend: false
    }));
  }

  async inviteDraftCollaborator(
    input: InviteDraftCollaboratorInput
  ): Promise<DraftInvitation> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== input.inviterId) throw new Error("draft actor mismatch");
    const result = await this.client
      .from("draft_invitations")
      .insert({
        id: crypto.randomUUID(),
        draft_id: input.draftId,
        inviter_user_id: actorId,
        invitee_user_id: input.inviteeId,
        status: "pending"
      })
      .select("id,draft_id,inviter_user_id,invitee_user_id,status,created_at")
      .single();
    ensureDatabaseResult(result.error);
    const row = result.data as {
      id: string;
      draft_id: string;
      inviter_user_id: string;
      invitee_user_id: string;
      status: DraftInvitation["status"];
      created_at: string;
    };
    return {
      id: row.id,
      draftId: row.draft_id,
      inviterId: row.inviter_user_id,
      inviteeId: row.invitee_user_id,
      status: row.status,
      createdAt: row.created_at
    };
  }

  async publishPoemDraft(input: {
    draftId: string;
    userId: string;
    replacePostId?: string;
  }): Promise<PublishPoemDraftResult> {
    await this.assertActor(input.userId);
    const result = input.replacePostId
      ? await this.client.rpc("publish_draft_over_post", {
          p_draft_id: input.draftId,
          p_post_id: input.replacePostId
        })
      : await this.client.rpc("publish_draft_as_post", {
          p_draft_id: input.draftId
        });
    ensureDatabaseResult(result.error);
    const postId = typeof result.data === "string" ? result.data : null;
    if (!postId) throw new Error("post publish failed");
    const [draft, poem] = await Promise.all([
      this.getPoemDraft(input.draftId),
      this.posts.getPoem(postId)
    ]);
    if (!draft || !poem) throw new Error("published post not found");
    return { draft, poem };
  }

  async publishThreadDraft(input: {
    draftId: string;
    userId: string;
  }): Promise<PublishThreadDraftResult> {
    await this.assertActor(input.userId);
    const result = await this.client.rpc("publish_draft_as_thread", {
      p_draft_id: input.draftId
    });
    ensureDatabaseResult(result.error);
    const threadId = typeof result.data === "string" ? result.data : null;
    if (!threadId) throw new Error("thread publish failed");
    const [draft, detail] = await Promise.all([
      this.getPoemDraft(input.draftId),
      this.threads.getThread(threadId)
    ]);
    if (!draft || !detail) throw new Error("published thread not found");
    return { draft, thread: detail.thread };
  }

  async savePoemDraft(input: SavePoemDraftInput): Promise<PoemDraft> {
    await this.assertActor(input.userId);
    const result = await this.client
      .from("poem_drafts")
      .update({ status: "ready" })
      .eq("id", input.draftId)
      .eq("owner_user_id", input.userId)
      .select(draftSelect)
      .maybeSingle();
    ensureDatabaseResult(result.error);
    if (!result.data) throw new Error("draft not found or forbidden");
    return this.mapDraft(result.data as DraftRow);
  }

  async listUserDrafts(userId: string): Promise<UserDraftPage> {
    await this.assertActor(userId);
    const result = await this.client
      .from("poem_drafts")
      .select(draftSelect)
      .eq("owner_user_id", userId)
      .in("status", ["editing", "ready"])
      .order("updated_at", { ascending: false })
      .limit(100);
    ensureDatabaseResult(result.error);
    const items = await Promise.all(
      ((result.data as DraftRow[] | null) ?? []).map((row) => this.mapDraft(row))
    );
    return { userId, total: items.length, items };
  }

  async createUploadUrl(
    input: CreateStorageUploadInput
  ): Promise<StorageUploadTarget> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId) throw new Error("authentication required");
    const safePath = input.path.replace(/^\/+/, "");
    if (
      !safePath.startsWith(`${actorId}/`) ||
      safePath.includes("..") ||
      !/^[a-zA-Z0-9/_\-.]+$/.test(safePath)
    ) {
      throw new Error("storage path must be scoped to the current user");
    }
    if (!/^(image\/(jpeg|png|webp|gif)|video\/mp4)$/.test(input.contentType)) {
      throw new Error("unsupported media type");
    }
    const result = await this.client.storage
      .from(input.bucket)
      .createSignedUploadUrl(safePath);
    if (result.error) throw new Error("storage upload is unavailable");
    return {
      bucket: input.bucket,
      path: safePath,
      token: result.data.token,
      signedUrl: result.data.signedUrl
    };
  }

  private async assertActor(userId: string): Promise<void> {
    const actorId = await getCurrentLinespaceUserId(this.client);
    if (!actorId || actorId !== userId) throw new Error("draft actor mismatch");
  }

  private async mapDraft(row: DraftRow): Promise<PoemDraft> {
    const collaboratorsResult = await this.client
      .from("draft_collaborators")
      .select("user_id,role,status,cursor_line,last_seen_at")
      .eq("draft_id", row.id)
      .order("last_seen_at", { ascending: false });
    ensureDatabaseResult(collaboratorsResult.error);
    const collaboratorRows = (collaboratorsResult.data as Array<{
      user_id: string;
      role: "owner" | "editor";
      status: "invited" | "active";
      cursor_line: number | null;
      last_seen_at: string;
    }> | null) ?? [];
    const ownerIds = [
      row.owner_user_id,
      ...collaboratorRows.map((item) => item.user_id),
      ...versionLineAuthorIds(row.version_lines)
    ];
    const profiles = await loadProfiles(this.client, ownerIds);
    const owner = profiles.get(row.owner_user_id);
    const collaborators = [
      owner
        ? {
            user: owner,
            role: "owner" as const,
            status: "active" as const,
            lastSeenAt: row.updated_at
          }
        : null,
      ...collaboratorRows.flatMap((item) => {
        const user = profiles.get(item.user_id);
        if (!user) return [];
        return [
          {
            user,
            role: item.role,
            status: item.status,
            ...(item.cursor_line !== null ? { cursorLine: item.cursor_line } : {}),
            lastSeenAt: item.last_seen_at
          }
        ];
      })
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      id: row.id,
      ownerId: row.owner_user_id,
      mode: row.mode,
      status: row.status,
      title: row.title,
      body: row.body,
      ...(row.relay_first_line !== null ? { relayFirstLine: row.relay_first_line } : {}),
      ...(row.relay_rules !== null ? { relayRules: row.relay_rules } : {}),
      byline: row.byline,
      tags: row.tags ?? [],
      mentions: row.mentions ?? [],
      versionLines: parseVersionLines(row.version_lines, profiles),
      media: parseMedia(row.media),
      settings: parseSettings(row.settings),
      layout: parseLayout(row.layout),
      collaborators,
      version: Number(row.version),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

function defaultSettings(): PoemDraftSettings {
  return {
    declareOriginal: false,
    isPublic: true,
    visibility: "public",
    audienceUserIds: [],
    allowComments: true,
    allowQuotes: true,
    allowSharing: true,
    allowSave: true
  };
}

function defaultLayout(): PoemLayoutConfig {
  return {
    templateId: "quiet-letter",
    typographyId: "literary-serif",
    backgroundId: "letter-paper",
    stickerIds: []
  };
}

function parseSettings(value: unknown): PoemDraftSettings {
  const source = objectValue(value);
  const visibility =
    source.visibility === "include" || source.visibility === "exclude"
      ? source.visibility
      : "public";
  return {
    declareOriginal: source.declareOriginal === true,
    isPublic: source.isPublic !== false,
    visibility,
    audienceUserIds: arrayOfStrings(source.audienceUserIds),
    allowComments: source.allowComments !== false,
    allowQuotes: source.allowQuotes !== false,
    allowSharing: source.allowSharing !== false,
    allowSave: source.allowSave !== false
  };
}

function parseLayout(value: unknown): PoemLayoutConfig {
  const source = objectValue(value);
  const layout = defaultLayout();
  if (
    source.templateId === "quiet-letter" ||
    source.templateId === "night-whisper" ||
    source.templateId === "travel-postcard"
  ) {
    layout.templateId = source.templateId;
  }
  if (
    source.typographyId === "literary-serif" ||
    source.typographyId === "handwritten" ||
    source.typographyId === "clean-sans"
  ) {
    layout.typographyId = source.typographyId;
  }
  if (
    source.backgroundId === "letter-paper" ||
    source.backgroundId === "kraft-paper" ||
    source.backgroundId === "postcard" ||
    source.backgroundId === "midnight"
  ) {
    layout.backgroundId = source.backgroundId;
  }
  layout.stickerIds = arrayOfStrings(source.stickerIds).filter(
    (item): item is PoemLayoutConfig["stickerIds"][number] =>
      item === "botanical" || item === "moon" || item === "postmark"
  );
  return layout;
}

function parseMedia(value: unknown): PoemDraftMedia | undefined {
  const source = objectValue(value);
  if (
    typeof source.uri !== "string" ||
    typeof source.name !== "string" ||
    (source.kind !== "image" && source.kind !== "video")
  ) {
    return undefined;
  }
  return {
    uri: source.uri,
    kind: source.kind,
    name: source.name,
    ...(typeof source.width === "number" ? { width: source.width } : {}),
    ...(typeof source.height === "number" ? { height: source.height } : {}),
    ...(typeof source.mimeType === "string" ? { mimeType: source.mimeType } : {})
  };
}

function parseVersionLines(
  value: unknown,
  profiles: Map<string, UserProfile>
): PoemDraft["versionLines"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = objectValue(item);
    if (typeof source.text !== "string" || typeof source.lineNumber !== "number") {
      return [];
    }
    const authorId = typeof source.authorId === "string" ? source.authorId : undefined;
    const author =
      (authorId ? profiles.get(authorId) : undefined) ??
      ({
        id: authorId ?? "unknown",
        handle: "unknown",
        displayName: "Unknown",
        avatarColor: "#DCD8D3"
      } satisfies UserProfile);
    return [
      {
        lineNumber: source.lineNumber,
        text: source.text,
        author,
        ...(typeof source.likes === "number" ? { likes: source.likes } : {})
      }
    ];
  });
}

function versionLineAuthorIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = objectValue(item);
    return typeof source.authorId === "string" ? [source.authorId] : [];
  });
}
