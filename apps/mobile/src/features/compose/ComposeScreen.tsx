import { router, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import { AppScreen } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemDraft, PoemDraftMedia, PoemDraftSettings } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { getMediaAspectRatio } from "@/features/poem/poemPresentation";

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
  const sourceVersionId = getParam(params.sourceVersionId);
  const lockedVersionContent = getParam(params.lockedVersionContent) === "true";
  const contributorHandles = parseList(getParam(params.contributorHandles));
  const versionLines = parseVersionLines(getParam(params.versionLines));
  const [title, setTitle] = useState(getParam(params.generatedTitle) ?? "");
  const [body, setBody] = useState(getParam(params.fullPoemText) ?? "");
  const [tag, setTag] = useState("");
  const [mention, setMention] = useState(contributorHandles.map((handle) => `@${handle}`).join(" "));
  const [media, setMedia] = useState<PoemDraftMedia | null>(() => {
    const uri = getParam(params.mediaUri);
    const kind = getParam(params.mediaKind) as PoemDraftMedia["kind"] | undefined;
    return uri && (kind === "image" || kind === "video")
      ? { uri, kind, name: sourceVersionId ? "thread-version-media" : "media" }
      : null;
  });
  const [settings] = useState<PoemDraftSettings>(initialSettings);
  const [error, setError] = useState<string | null>(null);

  const draftQuery = useQuery({
    queryKey: ["compose-draft-session", currentUserId, sessionKey, "post"],
    queryFn: () =>
      lineSpaceApi.createPoemDraft({ ownerId: currentUserId, mode: "draft" }),
    staleTime: Infinity
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const draftId = draftQuery.data?.id;
      if (!draftId) throw new Error("Draft is not ready");
      return lineSpaceApi.updatePoemDraft({
        draftId,
        userId: currentUserId,
        title: title.trim(),
        body: body.trim(),
        byline: contributorHandles.length
          ? [...contributorHandles].sort((left, right) => left.localeCompare(right)).join(", ")
          : draftQuery.data?.collaborators[0]?.user.displayName ?? "",
        tags: parseTags(tag),
        mentions: parseMentions(mention),
        media,
        versionLines,
        settings
      });
    },
    onSuccess: (draft) =>
      router.push({
        pathname: "/compose-preview",
        params: { draftId: draft.id }
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
    if (!body.trim()) {
      setError("Write at least one line before opening layout.");
      return;
    }
    setError(null);
    saveMutation.mutate();
  };

  const mediaHeight = getComposeMediaHeight(media);

  return (
    <AppScreen
      scroll
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <ComposeHeader
        isBusy={saveMutation.isPending}
        onAction={goToPreview}
        title="new post"
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
        editable={!lockedVersionContent}
        onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="next"
          style={styles.titleInput}
          textAlign="center"
          value={title}
        />
        <View style={styles.divider} />
        <TextInput
          multiline
        editable={!lockedVersionContent}
        onChangeText={setBody}
          placeholder="Write your lines"
          placeholderTextColor={colors.tabMuted}
          style={styles.lineInput}
          textAlignVertical="top"
          value={body}
        />
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

      {error || saveMutation.isError ? (
        <Text style={styles.error}>
          {error ?? "The draft could not be saved."}
        </Text>
      ) : null}

    </AppScreen>
  );
}

function ComposeHeader({
  title,
  isBusy,
  onAction
}: {
  title: string;
  isBusy: boolean;
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
        disabled={isBusy}
        onPress={onAction}
        style={styles.actionButton}
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
