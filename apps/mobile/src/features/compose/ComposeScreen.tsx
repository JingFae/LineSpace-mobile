import { router, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import { AppScreen } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemDraft, PoemDraftMedia, PoemDraftSettings } from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { getMediaAspectRatio } from "@/features/poem/poemPresentation";
import {
  CommunitySparkCards,
  type SparkApplyChange
} from "@/features/poem/CommunitySparkCards";

type ComposeScreenProps = {
  sessionKey: string;
  params?: Record<string, string | string[] | undefined>;
};

const initialSettings: PoemDraftSettings = {
  declareOriginal: false,
  isPublic: true,
  visibility: "public",
  audienceUserIds: [],
  allowComments: true,
  allowQuotes: true,
  allowSharing: true,
  allowSave: true
};

export function ComposeScreen({ sessionKey, params = {} }: ComposeScreenProps) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? "";
  const resumeDraftId = getParam(params.draftId);
  const editPostId = getParam(params.editPostId);
  const sourceVersionId = getParam(params.sourceVersionId);
  const lockedVersionContent = getParam(params.lockedVersionContent) === "true";
  const contributorHandles = parseList(getParam(params.contributorHandles));
  const versionLines = parseVersionLines(getParam(params.versionLines));
  const sourceVersionBody = getParam(params.fullPoemText) ?? "";
  const [title, setTitle] = useState(getParam(params.generatedTitle) ?? "");
  const [body, setBody] = useState(sourceVersionBody);
  const [tag, setTag] = useState("");
  const [mention, setMention] = useState(contributorHandles.map((handle) => `@${handle}`).join(" "));
  const [media, setMedia] = useState<PoemDraftMedia | null>(() => {
    const uri = getParam(params.mediaUri);
    const kind = getParam(params.mediaKind) as PoemDraftMedia["kind"] | undefined;
    return uri && (kind === "image" || kind === "video")
      ? { uri, kind, name: sourceVersionId ? "thread-version-media" : "media" }
      : null;
  });
  const [settings, setSettings] = useState<PoemDraftSettings>(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [editHydrated, setEditHydrated] = useState(false);
  const [sparkChange, setSparkChange] = useState<SparkApplyChange | null>(null);
  const [undoingSpark, setUndoingSpark] = useState(false);
  const editInitialized = useRef(false);
  const draftInitialized = useRef(false);
  const createdDraft = useRef<PoemDraft | null>(null);

  const editPostQuery = useQuery({
    queryKey: ["compose-edit-post", editPostId, currentUserId],
    queryFn: () => lineSpaceApi.getPoem(editPostId!, currentUserId),
    enabled: Boolean(editPostId) && currentUserId.length > 0
  });

  useEffect(() => {
    const post = editPostQuery.data;
    if (!post || editInitialized.current) return;
    if (post.author.id !== currentUserId) {
      setError("Only the author can edit this post.");
      return;
    }
    editInitialized.current = true;
    setTitle(post.title);
    setBody(post.lines.join("\n"));
    setTag(post.tags.map((value) => `#${value}`).join(" "));
    setMention((post.mentions ?? []).map((value) => `@${value.replace(/^@/, "")}`).join(" "));
    setMedia(post.media ? { ...post.media } : null);
    setSettings({
      declareOriginal: post.declareOriginal ?? false,
      isPublic: (post.visibility ?? "public") === "public",
      visibility: post.visibility ?? "public",
      audienceUserIds: [...(post.audienceUserIds ?? [])],
      allowComments: post.allowComments ?? true,
      allowQuotes: true,
      allowSharing: post.allowSharing ?? true,
      allowSave: true
    });
    setEditHydrated(true);
  }, [currentUserId, editPostQuery.data]);

  const draftQuery = useQuery({
    queryKey: [
      "compose-draft-session",
      currentUserId,
      sessionKey,
      "post",
      resumeDraftId ?? editPostId ?? sourceVersionId ?? "new"
    ],
    queryFn: async () => {
      if (!resumeDraftId) throw new Error("A saved draft id is required");
      const draft = await lineSpaceApi.getPoemDraft(resumeDraftId);
      if (!draft || draft.ownerId !== currentUserId || draft.mode !== "draft") {
        throw new Error("Draft was not found");
      }
      return draft;
    },
    enabled: Boolean(resumeDraftId) && currentUserId.length > 0,
    retry: 1,
    staleTime: Infinity
  });

  useEffect(() => {
    const draft = draftQuery.data;
    if (!resumeDraftId || !draft || draftInitialized.current) return;
    draftInitialized.current = true;
    setTitle(draft.title);
    setBody(draft.body);
    setTag(draft.tags.map((value) => `#${value}`).join(" "));
    setMention(draft.mentions.map((value) => `@${value.replace(/^@/, "")}`).join(" "));
    setMedia(draft.media ? { ...draft.media } : null);
    setSettings({
      ...draft.settings,
      audienceUserIds: [...draft.settings.audienceUserIds]
    });
  }, [currentUserId, draftQuery.data, resumeDraftId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let draft = draftQuery.data ?? createdDraft.current;
      if (!draft) {
        draft = await lineSpaceApi.createPoemDraft({ ownerId: currentUserId, mode: "draft" });
        createdDraft.current = draft;
      }
      return lineSpaceApi.updatePoemDraft({
        draftId: draft.id,
        userId: currentUserId,
        title: title.trim(),
        body: (lockedVersionContent ? sourceVersionBody : body).trim(),
        byline: contributorHandles.length
          ? [...contributorHandles].sort((left, right) => left.localeCompare(right)).join(", ")
          : draft.collaborators[0]?.user.displayName ?? "",
        tags: parseTags(tag),
        mentions: parseMentions(mention),
        media,
        ...(editPostQuery.data?.layout ? { layout: editPostQuery.data.layout } : {}),
        versionLines,
        settings
      });
    },
    onSuccess: (draft) =>
      router.push({
        pathname: "/compose-preview",
        params: { draftId: draft.id, ...(editPostId ? { editPostId } : {}) }
      } as Href)
  });

  const openMediaPicker = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo-library access is required to attach media.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: false,
      quality: 0.85,
      // Keep image posts portable across the draft and API boundaries. A
      // device-local file:// URI cannot be rendered after the post is loaded
      // again, while the data URI works in both mock and HTTP mode.
      base64: true
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    const uri =
      !isVideo && asset.base64
        ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
    setMedia({
      uri,
      kind: isVideo ? "video" : "image",
      name: asset.fileName ?? (isVideo ? "video" : "image"),
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType
    });
  };

  const goToPreview = () => {
    if (!(lockedVersionContent ? sourceVersionBody : body).trim()) {
      setError("Write at least one line before opening layout.");
      return;
    }
    if (resumeDraftId && !draftQuery.data) {
      setError(
        draftQuery.isError
          ? "The draft service is unavailable. Pull back and try again after the database migration is applied."
          : "Preparing your draft. Please try again in a moment."
      );
      return;
    }
    if (editPostId && !editPostQuery.data) {
      setError(editPostQuery.isError ? "This post could not be loaded for editing." : "Loading your post. Please try again in a moment.");
      return;
    }
    setError(null);
    saveMutation.mutate();
  };

  const mediaHeight = getComposeMediaHeight(media);

  const undoSparkChange = async () => {
    if (!sparkChange || undoingSpark) return;
    const currentLines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (JSON.stringify(currentLines) !== JSON.stringify(sparkChange.afterLines)) {
      setError("Your draft changed after the AI edit, so this change can no longer be undone safely.");
      return;
    }
    setUndoingSpark(true);
    try {
      if (editPostId) {
        const result = await lineSpaceApi.undoCommunitySpark({
          poemId: editPostId,
          userId: currentUserId,
          appliedLines: sparkChange.afterLines,
          previousLines: sparkChange.beforeLines
        });
        queryClient.setQueryData(["compose-edit-post", editPostId, currentUserId], result.poem);
        queryClient.setQueryData(["poem", editPostId, currentUserId], result.poem);
      }
      setBody(sparkChange.beforeLines.join("\n"));
      setSparkChange(null);
      setError(null);
    } catch {
      setError("This AI change can no longer be undone safely.");
    } finally {
      setUndoingSpark(false);
    }
  };

  return (
    <AppScreen
      scroll
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <ComposeHeader
        isBusy={(Boolean(resumeDraftId) && draftQuery.isLoading) || editPostQuery.isLoading || saveMutation.isPending}
        isDisabled={currentUserId.length === 0 || (Boolean(editPostId) && !editPostQuery.data)}
        onAction={goToPreview}
        title={editPostId ? "edit post" : "new post"}
      />

      <View style={styles.intro}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepNumber}>01</Text>
        </View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>Start with the words</Text>
          <Text style={styles.introHint}>
            Add a visual when it helps the poem breathe.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={openMediaPicker}
        style={[styles.mediaZone, { height: mediaHeight }]}
      >
        {media ? (
          <SelectedMedia media={media} onRemove={() => setMedia(null)} />
        ) : (
          <View style={styles.mediaEmpty}>
            <View style={styles.mediaPlusCircle}>
              <Text style={styles.mediaPlus}>＋</Text>
            </View>
            <Text style={styles.mediaPlaceholder}>Add image or video</Text>
            <Text style={styles.mediaHint}>optional · keep the poem at the center</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.editorPanel}>
        <TextInput
          accessibilityLabel="Post title"
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="next"
          style={styles.titleInput}
          textAlign="center"
          value={title}
        />
        <View style={styles.divider} />
        {lockedVersionContent ? (
          <Pressable
            accessibilityHint="Thread Version poem lines cannot be edited"
            accessibilityLabel="Locked Thread Version poem"
            accessibilityRole="button"
            onPress={() => setError("Thread Version poem lines cannot be edited.")}
            style={styles.lockedPoem}
          >
            <View style={styles.lockedPoemHeader}>
              <Text style={styles.lockedPoemLabel}>THREAD VERSION · LINES LOCKED</Text>
              <Text style={styles.lockedPoemIcon}>⌁</Text>
            </View>
            <ScrollView nestedScrollEnabled style={styles.lockedPoemScroll}>
              <Text selectable style={styles.lockedPoemText}>{body}</Text>
            </ScrollView>
          </Pressable>
        ) : (
          <TextInput
            multiline
            onChangeText={setBody}
            placeholder="Write your lines"
            placeholderTextColor={colors.tabMuted}
            style={styles.lineInput}
            textAlignVertical="top"
            value={body}
          />
        )}
        <View style={styles.divider} />
        <TextInput
          autoCapitalize="none"
          onChangeText={setTag}
          placeholder="#tag (optional)"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="next"
          style={styles.metaInput}
          textAlign="center"
          value={tag}
        />
        <View style={styles.divider} />
        <TextInput
          autoCapitalize="none"
          editable={!lockedVersionContent}
          onChangeText={setMention}
          placeholder="@mention (optional)"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="done"
          style={styles.metaInput}
          textAlign="center"
          value={mention}
        />
      </View>

      {editHydrated && editPostQuery.data?.author.id === currentUserId ? (
        <View style={styles.creativeSparkWrap}>
          <CommunitySparkCards
            autoLoad
            label="Creative Spark"
            onApplied={(result, change) => {
              setBody(result.poem.lines.join("\n"));
              setSparkChange(change);
              queryClient.setQueryData(
                ["compose-edit-post", editPostId, currentUserId],
                result.poem
              );
              queryClient.setQueryData(
                ["poem", editPostId, currentUserId],
                result.poem
              );
            }}
            onSourcePress={(sourceCommentId) =>
              router.push({
                pathname: "/poem/[id]",
                params: {
                  id: editPostQuery.data!.id,
                  commentId: sourceCommentId,
                  targetKind: "comment"
                }
              } as Href)
            }
            poem={editPostQuery.data}
            userId={currentUserId}
            workingCopy={{
              title,
              lines: body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
              tags: parseTags(tag)
            }}
          />
        </View>
      ) : null}

      {!editPostId ? (
        <View style={styles.creativeSparkWrap}>
          <CommunitySparkCards
            label="Creative Spark"
            onDraftApplied={(change) => {
              setBody(change.afterLines.join("\n"));
              setSparkChange(change);
            }}
            sparkMode="draft"
            userId={currentUserId}
            workingCopy={{
              title,
              lines: body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
              tags: parseTags(tag)
            }}
          />
        </View>
      ) : null}

      {sparkChange ? (
        <SparkChangeNotice
          change={sparkChange}
          isUndoing={undoingSpark}
          onUndo={() => void undoSparkChange()}
        />
      ) : null}

      {error || draftQuery.isError || saveMutation.isError ? (
        <Text style={styles.error}>
          {error ?? (draftQuery.isError ? "The draft service is temporarily unavailable." : "The draft could not be saved.")}
        </Text>
      ) : null}

    </AppScreen>
  );
}

function SparkChangeNotice({
  change,
  isUndoing,
  onUndo
}: {
  change: SparkApplyChange;
  isUndoing: boolean;
  onUndo: () => void;
}) {
  const highlighted = change.afterLines.filter(
    (line, index) => line !== change.beforeLines[index]
  );
  return (
    <View style={styles.sparkChangeNotice}>
      <View style={styles.sparkChangeHeader}>
        <View>
          <Text style={styles.sparkChangeEyebrow}>CREATIVE SPARK APPLIED</Text>
          <Text style={styles.sparkChangeTitle}>Your draft keeps the change in a warm glow.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={isUndoing} onPress={onUndo} style={styles.sparkUndoButton}>
          <Text style={styles.sparkUndoText}>{isUndoing ? "Undoing…" : "Undo"}</Text>
        </Pressable>
      </View>
      {highlighted.slice(0, 3).map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.sparkChangedLine}>{line}</Text>
      ))}
    </View>
  );
}

function ComposeHeader({
  title,
  isBusy,
  isDisabled,
  onAction
}: {
  title: string;
  isBusy: boolean;
  isDisabled: boolean;
  onAction: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={styles.closeButton}
      >
        <Text style={styles.closeGlyph}>×</Text>
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>post</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={isBusy || isDisabled}
        onPress={onAction}
        style={[styles.actionButton, isDisabled && styles.actionButtonDisabled]}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.profileMuted} />
        ) : (
          <Text style={styles.actionText}>next</Text>
        )}
      </Pressable>
    </View>
  );
}

function SelectedMedia({
  media,
  onRemove
}: {
  media: PoemDraftMedia;
  onRemove: () => void;
}) {
  return (
    <View style={styles.selectedMedia}>
      {media.kind === "image" ? (
        <Image
          accessibilityLabel="Selected poem image"
          source={{ uri: media.uri } as ImageSourcePropType}
          resizeMode="cover"
          style={styles.selectedImage}
        />
      ) : (
        <View style={styles.videoSelected}>
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>VIDEO</Text>
          </View>
          <Text style={styles.videoSelectedTitle}>Video selected</Text>
          <Text numberOfLines={1} style={styles.videoSelectedName}>
            {media.name}
          </Text>
        </View>
      )}
      <View style={styles.mediaOverlay}>
        <Text style={styles.mediaOverlayText}>Tap to replace</Text>
      </View>
      <Pressable
        accessibilityLabel="Remove media"
        onPress={onRemove}
        style={styles.removeMedia}
      >
        <Text style={styles.removeMediaText}>×</Text>
      </Pressable>
    </View>
  );
}

function getComposeMediaHeight(media: PoemDraftMedia | null) {
  if (!media) return 204;
  const ratio = getMediaAspectRatio(media);
  if (!ratio) return 220;
  if (ratio >= 1.65) return 190;
  if (ratio >= 1.05) return 238;
  return 310;
}

function parseTags(value: string) {
  return value
    .split(/[,\s#|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMentions(value: string) {
  return value
    .split(/[,\s@|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().replace(/^@/, ""))
    .filter(Boolean);
}

function parseVersionLines(value: string | undefined): PoemDraft["versionLines"] {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as PoemDraft["versionLines"];
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .filter(
        (line): line is NonNullable<PoemDraft["versionLines"]>[number] =>
          Boolean(line && typeof line.text === "string" && line.author)
      )
      .map((line) => ({
        lineNumber: line.lineNumber,
        text: line.text,
        author: line.author,
        likes: line.likes
      }));
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface },
  screen: {
    minHeight: 900,
    paddingBottom: 30,
    backgroundColor: colors.surface
  },
  header: {
    height: 78,
    paddingHorizontal: 8,
    paddingTop: 30,
    paddingBottom: 4,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  closeGlyph: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: "300"
  },
  headerCopy: { alignItems: "center" },
  headerTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600"
  },
  headerSubtitle: {
    marginTop: 1,
    color: colors.tabMuted,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2
  },
  actionButton: {
    width: 60,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  actionButtonDisabled: { opacity: 0.45 },
  actionText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500"
  },
  intro: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    backgroundColor: colors.surfaceWarm,
    flexDirection: "row",
    alignItems: "center"
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  stepNumber: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  introCopy: { flex: 1, marginLeft: 12 },
  introTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600"
  },
  introHint: {
    marginTop: 2,
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 17
  },
  mediaZone: {
    margin: 16,
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center"
  },
  mediaEmpty: { alignItems: "center" },
  mediaPlusCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  mediaPlus: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "300"
  },
  mediaPlaceholder: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500"
  },
  mediaHint: {
    marginTop: 4,
    color: colors.profileMuted,
    fontSize: 11,
    lineHeight: 15
  },
  selectedMedia: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted
  },
  selectedImage: { width: "100%", height: "100%" },
  mediaOverlay: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(17,17,17,0.62)"
  },
  mediaOverlayText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.2
  },
  videoSelected: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  videoBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.ink
  },
  videoBadgeText: {
    color: colors.white,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1
  },
  videoSelectedTitle: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21
  },
  videoSelectedName: {
    marginTop: 4,
    maxWidth: "90%",
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 16
  },
  removeMedia: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center"
  },
  removeMediaText: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "300"
  },
  editorPanel: {
    marginHorizontal: 16,
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  creativeSparkWrap: { marginHorizontal: 16 },
  sparkChangeNotice: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D49A",
    backgroundColor: "#FFF9E8"
  },
  sparkChangeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sparkChangeEyebrow: { color: "#8D6A1C", fontSize: 9, letterSpacing: 1.1, fontWeight: "700" },
  sparkChangeTitle: { maxWidth: 225, marginTop: 3, color: colors.ink, fontSize: 12, lineHeight: 17 },
  sparkUndoButton: { minWidth: 58, paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center" },
  sparkUndoText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  sparkChangedLine: { marginTop: 8, paddingLeft: 9, borderLeftWidth: 2, borderLeftColor: "#D8B66A", color: colors.inkSoft, fontFamily: "Georgia", fontSize: 13, lineHeight: 19 },
  titleInput: {
    height: 58,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 26
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line
  },
  lineInput: {
    minHeight: 160,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: spacing.md,
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 29
  },
  lockedPoem: {
    minHeight: 190,
    maxHeight: 300,
    paddingTop: 12,
    backgroundColor: colors.surface
  },
  lockedPoemHeader: {
    paddingHorizontal: 20,
    paddingBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  lockedPoemLabel: {
    color: colors.profileMuted,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.2,
    fontWeight: "700"
  },
  lockedPoemIcon: { color: colors.profileMuted, fontSize: 17, lineHeight: 20 },
  lockedPoemScroll: { maxHeight: 246 },
  lockedPoemText: {
    paddingHorizontal: 20,
    paddingBottom: spacing.lg,
    color: colors.ink,
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 29
  },
  metaInput: {
    height: 48,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20
  },
  error: {
    marginHorizontal: 20,
    marginTop: 10,
    color: colors.accent,
    fontSize: 12,
    lineHeight: 16
  }
});
