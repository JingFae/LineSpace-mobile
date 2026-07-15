import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { AppScreen, Avatar, EmptyState, MoreIcon, ShareIcon } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { ThreadContinuation, ThreadDetail } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import {
  adaptThreadToCreativeViewModel,
  buildPoemVersions,
  getFullPoemText,
  getThreadMedia,
  selectRepresentativeVersions,
  threadMediaPresets,
  type PoemVersionViewModel
} from "./threadCreative";

type ExportNotice = {
  id: string;
  message: string;
};

export function PoemVersionPreviewScreen({ threadId }: { threadId?: string }) {
  const { width } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState<ExportNotice | null>(null);
  const threadQuery = useQuery({
    queryKey: ["thread-detail", threadId, currentUserId],
    enabled: Boolean(threadId),
    queryFn: () => lineSpaceApi.getThread(threadId!, currentUserId)
  });
  const treeQuery = useQuery({
    queryKey: ["thread-version-tree", threadId, currentUserId, threadQuery.data?.continuations.map((item) => item.id).join("|")],
    enabled: Boolean(threadQuery.data),
    queryFn: () => getThreadContinuationTree(threadQuery.data!)
  });
  const detail = threadQuery.data ?? undefined;
  const allContinuations = treeQuery.data ?? detail?.continuations ?? [];
  const versions = useMemo(() => {
    if (!detail) return [];
    return selectRepresentativeVersions(buildPoemVersions(detail.thread, allContinuations));
  }, [allContinuations, detail]);
  const currentVersion = versions[Math.min(pageIndex, Math.max(versions.length - 1, 0))];
  const creativeThread = detail ? adaptThreadToCreativeViewModel(detail.thread) : null;
  const media = detail ? getThreadMedia(detail.thread) : threadMediaPresets.paper;
  const canPublishVersion = currentVersion?.contributorIds.includes(currentUserId) ?? false;
  const pageWidth = viewportWidth || width;

  const handleCopy = () => {
    if (!currentVersion) return;
    const text = `${currentVersion.title}\n\n${getFullPoemText(currentVersion)}`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setMoreOpen(false);
    setNotice({ id: currentVersion.id, message: "Poem text copied for this version." });
  };

  const handleExport = (kind: "Image" | "PDF") => {
    if (!currentVersion) return;
    setShareOpen(false);
    setNotice({
      id: `${currentVersion.id}:${kind}`,
      message: `${kind} export preview prepared. Real export service is still mocked.`
    });
  };

  const handlePost = () => {
    if (!currentVersion || !creativeThread) return;
    router.push({
      pathname: "/(tabs)/compose",
      params: {
        sourceThreadId: currentVersion.threadId,
        versionId: currentVersion.id,
        generatedTitle: currentVersion.title,
        fullPoemText: getFullPoemText(currentVersion),
        contributorIds: currentVersion.contributorIds.join(","),
        mediaId: creativeThread.mediaId,
        startingContent: creativeThread.startingContent
      }
    } as unknown as Href);
  };

  return (
    <AppScreen scroll={false} padded={false} style={styles.previewScreen} contentContainerStyle={styles.previewRoot}>
      <View style={styles.previewTopBar}>
        <Pressable accessibilityLabel="Close poem version preview" onPress={() => router.back()} style={styles.previewIconButton}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
        <View style={styles.previewTopTitle}>
          <Text style={styles.previewTitle}>Poem Version</Text>
          {versions.length > 1 ? <Text style={styles.previewSubtitle}>{pageIndex + 1} of {versions.length}</Text> : null}
        </View>
        <Pressable accessibilityLabel="More poem version options" onPress={() => setMoreOpen((open) => !open)} style={styles.previewIconButton}>
          <MoreIcon color={colors.white} />
        </Pressable>
      </View>

      <View
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        style={styles.previewViewport}
      >
        {threadQuery.isLoading || treeQuery.isLoading ? (
          <View style={styles.previewLoading}>
            <ActivityIndicator color={colors.white} />
            <Text style={styles.previewLoadingText}>Building poem versions</Text>
          </View>
        ) : !detail || !creativeThread || !currentVersion ? (
          <EmptyState title="Poem version unavailable" body="This thread version could not be opened." />
        ) : (
          <>
            {moreOpen ? (
              <PreviewMenu
                items={[
                  { label: "Copy text", onPress: handleCopy },
                  {
                    label: "View thread",
                    onPress: () => router.push({ pathname: "/thread/[id]", params: { id: detail.thread.id } } as unknown as Href)
                  },
                  { label: "Report", onPress: () => setNotice({ id: "report", message: "Report received for review." }) }
                ]}
              />
            ) : null}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                setPageIndex(Math.max(0, Math.min(nextIndex, versions.length - 1)));
              }}
              style={styles.versionPager}
            >
              {versions.map((version) => (
                <View key={version.id} style={[styles.versionPage, { width: pageWidth }]}>
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.versionPageContent}>
                    <Text style={styles.versionCriterion}>
                      {version.criterion === "mostLiked" ? "Most liked" : "Longest version"}
                    </Text>
                    <PoemArtwork version={version} media={media} />
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
            {versions.length > 1 ? (
              <View style={styles.pageIndicator}>
                {versions.map((version, index) => (
                  <View key={version.id} style={[styles.pageDot, index === pageIndex && styles.pageDotActive]} />
                ))}
              </View>
            ) : null}
            {canPublishVersion ? (
              <View style={styles.versionActions}>
                <Pressable accessibilityRole="button" onPress={() => setShareOpen((open) => !open)} style={styles.versionActionButton}>
                  <ShareIcon color={colors.ink} width={18} height={18} />
                  <Text style={styles.versionActionText}>Share</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handlePost} style={[styles.versionActionButton, styles.postActionButton]}>
                  <Text style={styles.postActionText}>Post</Text>
                </Pressable>
              </View>
            ) : null}
            {shareOpen ? (
              <PreviewMenu
                bottom
                items={[
                  { label: "Export as Image", onPress: () => handleExport("Image") },
                  { label: "Export as PDF", onPress: () => handleExport("PDF") }
                ]}
              />
            ) : null}
          </>
        )}
      </View>
      {notice ? (
        <Pressable accessibilityRole="button" onPress={() => setNotice(null)} style={styles.previewNotice}>
          <Text style={styles.previewNoticeText}>{notice.message}</Text>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

function PoemArtwork({
  version,
  media
}: {
  version: PoemVersionViewModel;
  media: ReturnType<typeof getThreadMedia>;
}) {
  return (
    <View style={[styles.artwork, { backgroundColor: media.backgroundColor }]}>
      <View pointerEvents="none" style={[styles.artworkOverlay, { backgroundColor: media.overlayColor }]} />
      <Text style={[styles.artworkTitle, { color: media.textColor }]}>{version.title}</Text>
      <View style={[styles.artworkDivider, { backgroundColor: media.accentColor }]} />
      {version.lines.map((line) => (
        <View key={line.id} style={styles.artworkLine}>
          <Avatar
            color={line.author.avatarColor}
            imageSource={line.author.avatarUrl ? { uri: line.author.avatarUrl } : undefined}
            label={line.author.displayName}
            size={30}
          />
          <View style={styles.artworkLineBody}>
            <Text style={[styles.artworkAuthor, { color: media.mutedTextColor }]}>
              {line.isStartingContent ? "Starting Content" : line.author.handle}
            </Text>
            <Text style={[styles.artworkText, { color: media.textColor }]}>{line.text}</Text>
          </View>
        </View>
      ))}
      <Text style={[styles.artworkMeta, { color: media.mutedTextColor }]}>
        {version.continuationCount === 0 ? "Initial version" : `${version.continuationCount} continuations`} · {version.contributorIds.length} contributors
      </Text>
    </View>
  );
}

function PreviewMenu({
  items,
  bottom = false
}: {
  items: Array<{ label: string; onPress: () => void }>;
  bottom?: boolean;
}) {
  return (
    <View style={[styles.previewMenu, bottom && styles.previewMenuBottom]}>
      {items.map((item) => (
        <Pressable key={item.label} accessibilityRole="button" onPress={item.onPress} style={styles.previewMenuItem}>
          <Text style={styles.previewMenuText}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

async function getThreadContinuationTree(detail: ThreadDetail) {
  const visited = new Set<string>();
  const all: ThreadContinuation[] = [];

  const walk = async (continuation: ThreadContinuation) => {
    if (visited.has(continuation.id)) return;
    visited.add(continuation.id);
    all.push(continuation);
    const childDetail = await lineSpaceApi.getContinuationDetail(continuation.id, currentUserId);
    for (const child of childDetail?.children ?? []) {
      await walk(child);
    }
  };

  for (const continuation of detail.continuations) {
    await walk(continuation);
  }
  return all;
}

const styles = StyleSheet.create({
  previewScreen: { backgroundColor: "#171717" },
  previewRoot: { flex: 1, backgroundColor: "#171717" },
  previewTopBar: {
    height: 76,
    paddingTop: 28,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  previewIconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: colors.white, fontSize: 34, lineHeight: 36 },
  previewTopTitle: { alignItems: "center" },
  previewTitle: { color: colors.white, fontSize: 18, lineHeight: 22, fontWeight: "700" },
  previewSubtitle: { marginTop: 1, color: "rgba(255,255,255,0.62)", fontSize: 12, lineHeight: 15 },
  previewViewport: { flex: 1, minWidth: 0 },
  previewLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewLoadingText: { marginTop: 10, color: colors.white },
  versionPager: { flex: 1 },
  versionPage: { flexShrink: 0 },
  versionPageContent: { alignItems: "stretch", paddingHorizontal: spacing.lg, paddingBottom: 120 },
  versionCriterion: { marginBottom: 10, color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 17 },
  artwork: {
    position: "relative",
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
    borderRadius: 24,
    padding: 20
  },
  artworkOverlay: { ...StyleSheet.absoluteFillObject },
  artworkTitle: { position: "relative", maxWidth: "100%", flexShrink: 1, fontSize: 27, lineHeight: 33, fontWeight: "700" },
  artworkDivider: { position: "relative", height: StyleSheet.hairlineWidth, marginVertical: 16, opacity: 0.7 },
  artworkLine: { position: "relative", width: "100%", maxWidth: "100%", flexDirection: "row", alignItems: "flex-start", marginTop: 17 },
  artworkLineBody: { flex: 1, flexShrink: 1, minWidth: 0, maxWidth: "100%", marginLeft: 10 },
  artworkAuthor: { maxWidth: "100%", flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  artworkText: { flexShrink: 1, maxWidth: "100%", marginTop: 4, fontSize: 18, lineHeight: 27 },
  artworkMeta: { position: "relative", maxWidth: "100%", marginTop: 22, fontSize: 12, lineHeight: 16 },
  pageIndicator: { height: 24, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.32)" },
  pageDotActive: { width: 18, backgroundColor: colors.white },
  versionActions: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 18,
    flexDirection: "row",
    gap: 10
  },
  versionActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  versionActionText: { marginLeft: 7, fontSize: 15, lineHeight: 19, fontWeight: "700", color: colors.ink },
  postActionButton: { backgroundColor: colors.ink },
  postActionText: { fontSize: 15, lineHeight: 19, fontWeight: "700", color: colors.white },
  previewMenu: {
    position: "absolute",
    top: 70,
    right: spacing.lg,
    zIndex: 20,
    minWidth: 148,
    borderRadius: radius.lg,
    paddingVertical: 6,
    backgroundColor: colors.white
  },
  previewMenuBottom: { top: undefined, right: spacing.lg, bottom: 76 },
  previewMenuItem: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14 },
  previewMenuText: { fontSize: 14, lineHeight: 18, color: colors.ink },
  previewNotice: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 78,
    minHeight: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  previewNoticeText: { color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "600" }
});
