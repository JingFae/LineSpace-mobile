import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import {
  AppScreen,
  Avatar,
  EmptyState,
  MoreIcon,
  ShareIcon,
  buildAiTextSegments
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { exportPoemCard } from "@/utils/poemCardExport";
import {
  adaptThreadToCreativeViewModel,
  buildCustomPoemVersion,
  buildPoemVersions,
  getFullPoemText,
  getThreadMedia,
  getVersionContentHash,
  threadMediaPresets,
  type PoemVersionCriterion,
  type PoemVersionViewModel,
  type ThreadMediaPreset
} from "./threadCreative";

type ExportNotice = {
  id: string;
  message: string;
};

type PoemVersionPreviewScreenProps = {
  threadId?: string;
  customSelectionIds?: string;
};

export function PoemVersionPreviewScreen({
  threadId,
  customSelectionIds
}: PoemVersionPreviewScreenProps) {
  const { width } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<ExportNotice | null>(null);
  const pagerRef = useRef<ScrollView | null>(null);
  const visiblePageIndexRef = useRef(1);
  const exportCardRef = useRef<View | null>(null);
  const positionedInitialPageRef = useRef(false);
  const threadQuery = useQuery({
    queryKey: ["thread-detail", threadId, currentUserId],
    enabled: Boolean(threadId),
    queryFn: () => lineSpaceApi.getThread(threadId!, currentUserId),
    staleTime: 60_000
  });
  const detail = threadQuery.data ?? undefined;
  const allContinuations = detail?.allContinuations ?? detail?.continuations ?? [];
  const baseVersions = useMemo(
    () => (detail ? buildPoemVersions(detail.thread, allContinuations) : []),
    [allContinuations, detail]
  );
  const threadContentSignature = useMemo(
    () =>
      detail
        ? getVersionContentHash(
            JSON.stringify({
              title: detail.thread.title ?? "",
              startingContent: detail.thread.startingContent ?? "",
              rules: detail.thread.rules ?? detail.thread.content,
              nodes: allContinuations.map((continuation) => ({
                id: continuation.id,
                parentId: continuation.parentContinuationId ?? null,
                text: continuation.content
              }))
            })
          )
        : "",
    [allContinuations, detail]
  );
  const aiVersionsQuery = useQuery({
    queryKey: ["thread-ai-versions", threadId, threadContentSignature],
    enabled: Boolean(detail && baseVersions.length),
    retry: 1,
    staleTime: 5 * 60_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" ||
        status === "processing"
        ? 2_500
        : false;
    },
    queryFn: () => lineSpaceApi.getThreadAiVersions(threadId!)
  });
  const aiSnapshotPending = Boolean(
    aiVersionsQuery.isLoading ||
      (!aiVersionsQuery.data?.recommended &&
        (aiVersionsQuery.data?.status === "pending" ||
          aiVersionsQuery.data?.status === "processing"))
  );
  const selectedCustomIds = useMemo(
    () => (customSelectionIds ?? "").split(",").map((id) => id.trim()).filter(Boolean),
    [customSelectionIds]
  );
  const versions = useMemo(() => {
    if (!detail || baseVersions.length === 0) return [];
    const mostPopular = [...baseVersions].sort(compareMostPopular)[0]!;
    const aiResult = aiVersionsQuery.data;
    const storedContinuationIds =
      aiResult?.harmonized?.lines
        .map((line) => line.lineId)
        .filter((lineId) =>
          allContinuations.some((continuation) => continuation.id === lineId)
        ) ?? [];
    const recommendedBase =
      baseVersions.find(
        (version) => version.id === aiResult?.recommended?.selectedVersionId
      ) ??
      (storedContinuationIds.length
        ? buildCustomPoemVersion(
            detail.thread,
            allContinuations,
            storedContinuationIds
          )
        : mostPopular);
    const recommended = {
      ...recommendedBase,
      id: `${recommendedBase.id}:recommended`,
      criterion: "recommended" as const,
      aiRationale: aiResult?.recommended?.rationale
    };
    const harmonizedLinesById = new Map(
      aiResult?.harmonized?.lines.map((line) => [line.lineId, line]) ?? []
    );
    const harmonized = {
      ...recommendedBase,
      id: `${recommendedBase.id}:harmonized`,
      criterion: "harmonized" as const,
      aiRationale: aiResult?.harmonized?.rationale,
      lines: recommendedBase.lines.map((line) => {
        const aiLine = harmonizedLinesById.get(line.id);
        if (!aiLine?.changed || aiLine.text === line.text) return { ...line };
        return {
          ...line,
          originalText: line.text,
          text: aiLine.text,
          aiChangeNote: aiLine.changeNote
        };
      })
    };
    const pages: PoemVersionViewModel[] = [
      { ...mostPopular, id: `${mostPopular.id}:popular`, criterion: "mostPopular" },
      recommended,
      harmonized
    ];
    if (selectedCustomIds.length > 0) {
      pages.push(
        buildCustomPoemVersion(detail.thread, allContinuations, selectedCustomIds)
      );
    }
    return pages;
  }, [
    allContinuations,
    baseVersions,
    detail,
    aiVersionsQuery.data,
    selectedCustomIds
  ]);
  const currentVersion = versions[Math.min(pageIndex, Math.max(versions.length - 1, 0))];
  const creativeThread = detail ? adaptThreadToCreativeViewModel(detail.thread) : null;
  const canPostVersion = Boolean(
    detail &&
      currentUserId &&
      (detail.thread.author.id === currentUserId ||
        allContinuations.some((continuation) => continuation.author.id === currentUserId))
  );
  const media: ThreadMediaPreset = detail
    ? getThreadMedia(detail.thread)
    : { ...threadMediaPresets.paper, uri: undefined };
  const pageWidth = viewportWidth || width;

  useEffect(() => {
    if (
      positionedInitialPageRef.current ||
      pageWidth <= 0 ||
      versions.length < 3
    ) {
      return;
    }
    positionedInitialPageRef.current = true;
    visiblePageIndexRef.current = 1;
    setPageIndex(1);
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: pageWidth, y: 0, animated: false });
    });
  }, [pageWidth, versions.length]);

  const syncVisiblePage = (offsetX: number) => {
    if (pageWidth <= 0 || versions.length === 0) return;
    const nextIndex = Math.max(
      0,
      Math.min(Math.round(offsetX / pageWidth), versions.length - 1)
    );
    visiblePageIndexRef.current = nextIndex;
    setPageIndex((current) => (current === nextIndex ? current : nextIndex));
  };

  const handleCopy = () => {
    if (!currentVersion) return;
    const text = `${currentVersion.title}\n\n${getFullPoemText(currentVersion)}`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    } else {
      void Share.share({ message: text });
    }
    setMoreOpen(false);
    setNotice({ id: currentVersion.id, message: "Poem text copied." });
  };

  const handleExport = async (kind: "JPG" | "PDF") => {
    if (!currentVersion) return;
    setExportOpen(false);
    try {
      await exportPoemCard(exportCardRef.current, {
        format: kind,
        title: currentVersion.title,
        backgroundColor: media.backgroundColor
      });
      setNotice({
        id: `${currentVersion.id}:${kind}`,
        message: `${kind} downloaded from LineSpace.`
      });
    } catch (error) {
      setNotice({
        id: `${currentVersion.id}:${kind}:error`,
        message:
          error instanceof Error
            ? error.message
            : "The poem card could not be exported. Please try again."
      });
    }
  };

  const handlePost = () => {
    const activeVersion =
      versions[
        Math.max(
          0,
          Math.min(visiblePageIndexRef.current, Math.max(versions.length - 1, 0))
        )
      ];
    if (!activeVersion || !creativeThread) return;
    if (!canPostVersion) {
      setNotice({
        id: `${activeVersion.id}:post-forbidden`,
        message: "Join this Thread before publishing one of its versions."
      });
      return;
    }
    const sortedContributors = [...new Map(
      activeVersion.lines.map((line) => [line.author.id, line.author])
    ).values()].sort((left, right) => left.handle.localeCompare(right.handle));
    const versionLines = activeVersion.lines.map((line) => ({
      ...line,
      ...(activeVersion.criterion === "harmonized"
        ? { aiHarmonized: true }
        : {})
    }));
    router.push({
      pathname: "/(tabs)/compose",
      params: {
        type: "post",
        session: `thread-version-${activeVersion.id}-${Date.now()}`,
        sourceThreadId: activeVersion.threadId,
        sourceVersionId: activeVersion.id,
        generatedTitle: activeVersion.title,
        fullPoemText: getFullPoemText(activeVersion),
        contributorIds: sortedContributors.map((person) => person.id).join(","),
        contributorHandles: sortedContributors.map((person) => person.handle).join(","),
        versionLines: JSON.stringify(versionLines),
        mediaUri: detail?.thread.media?.uri,
        mediaKind: detail?.thread.media?.kind,
        mediaId: creativeThread.mediaId,
        startingContent: creativeThread.startingContent,
        lockedVersionContent: "true"
      }
    } as unknown as Href);
  };

  const openCustomBuilder = () => {
    if (!detail) return;
    router.push({
      pathname: "/thread/[id]",
      params: {
        id: detail.thread.id,
        selectVersion: "true",
        selected: selectedCustomIds.join(",")
      }
    } as unknown as Href);
  };

  return (
    <AppScreen
      scroll={false}
      padded={false}
      style={styles.previewScreen}
      contentContainerStyle={styles.previewRoot}
    >
      <View style={styles.previewTopBar}>
        <Pressable
          accessibilityLabel="Close poem version preview"
          onPress={() => router.back()}
          style={styles.previewIconButton}
        >
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
        <View style={styles.previewTitleCopy}>
          <Text style={styles.previewTopTitle}>Poem version</Text>
          <Text style={styles.previewTopSubtitle}>
            {currentVersion ? criterionLabel(currentVersion.criterion) : "Building"}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="More version options"
          onPress={() => setMoreOpen((open) => !open)}
          style={styles.previewIconButton}
        >
          <MoreIcon color={colors.white} />
        </Pressable>
      </View>

      <View
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        style={styles.previewViewport}
      >
        {threadQuery.isLoading ? (
          <View style={styles.previewLoading}>
            <ActivityIndicator color={colors.white} />
            <Text style={styles.previewLoadingText}>Building poem versions</Text>
          </View>
        ) : !detail || !creativeThread || !currentVersion ? (
          <EmptyState
            title="Poem version unavailable"
            body="This thread version could not be opened."
          />
        ) : (
          <>
            {moreOpen ? (
              <PreviewMenu
                items={[
                  { label: "Copy text", onPress: handleCopy },
                  {
                    label: "View thread",
                    onPress: () =>
                      router.push({
                        pathname: "/thread/[id]",
                        params: { id: detail.thread.id }
                      } as unknown as Href)
                  },
                  {
                    label: "Report",
                    onPress: () =>
                      setNotice({ id: "report", message: "Report received for review." })
                  }
                ]}
              />
            ) : null}
            <View
              accessibilityLabel={`Page ${Math.min(pageIndex, 2) + 1} of 3`}
              style={styles.pageIndicator}
            >
              {versions.slice(0, 3).map((version, index) => (
                <View
                  key={version.id}
                  style={[styles.pageDot, index === pageIndex && styles.pageDotActive]}
                />
              ))}
            </View>
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) =>
                syncVisiblePage(event.nativeEvent.contentOffset.x)
              }
              onScroll={(event) =>
                syncVisiblePage(event.nativeEvent.contentOffset.x)
              }
              onScrollEndDrag={(event) =>
                syncVisiblePage(event.nativeEvent.contentOffset.x)
              }
              scrollEventThrottle={16}
              style={styles.versionPager}
            >
              {versions.map((version) => (
                <View key={version.id} style={[styles.versionPage, { width: pageWidth }]}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.versionPageContent}
                  >
                    <View style={styles.versionMetaRow}>
                      <View>
                        {version.criterion === "recommended" ||
                        version.criterion === "harmonized" ? (
                          <Text style={styles.versionNumber}>
                            {version.criterion === "recommended" ? "VERSION 1" : "VERSION 2"}
                          </Text>
                        ) : null}
                        <Text style={styles.versionCriterion}>
                          {criterionLabel(version.criterion)}
                        </Text>
                        <Text style={styles.versionDescription}>
                          {criterionDescription(
                            version.criterion,
                            aiSnapshotPending,
                            aiVersionsQuery.isError ||
                              (aiVersionsQuery.data?.status === "failed" &&
                                !aiVersionsQuery.data.recommended),
                            Boolean(aiVersionsQuery.data?.isStale)
                          )}
                        </Text>
                        {version.aiRationale ? (
                          <Text style={styles.versionRationale}>
                            “{version.aiRationale}”
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.totalLikesPill}>
                        <Text style={styles.totalLikesValue}>{version.totalLikeScore}</Text>
                        <Text style={styles.totalLikesLabel}>total likes</Text>
                      </View>
                    </View>
                    <View style={styles.artworkLoadingFrame}>
                      <PoemArtwork version={version} media={media} />
                      {aiSnapshotPending &&
                      (version.criterion === "recommended" ||
                        version.criterion === "harmonized") ? (
                        <AiVersionLoadingOverlay criterion={version.criterion} />
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={openCustomBuilder}
                      style={styles.customEntry}
                    >
                      <Text style={styles.customEntryTitle}>Build my version</Text>
                      <Text style={styles.customEntryBody}>
                        Choose one continuation for each numbered line.
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
            <View style={styles.versionActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setExportOpen((open) => !open)}
                style={styles.versionActionButton}
              >
                <ShareIcon color={colors.ink} width={18} height={18} />
                <Text style={styles.versionActionText}>Export</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handlePost}
                style={[
                  styles.versionActionButton,
                  styles.postActionButton,
                  !canPostVersion && styles.postActionButtonUnavailable
                ]}
              >
                <Text style={styles.postActionText}>Post</Text>
              </Pressable>
            </View>
            {exportOpen ? (
              <PreviewMenu
                bottom
                items={[
                  { label: "Export as JPG", onPress: () => void handleExport("JPG") },
                  { label: "Export as PDF", onPress: () => void handleExport("PDF") }
                ]}
              />
            ) : null}
          </>
        )}
      </View>
      {currentVersion ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.exportCaptureStage}
        >
          <PoemArtwork
            exportRef={exportCardRef}
            media={media}
            version={currentVersion}
          />
        </View>
      ) : null}
      {notice ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setNotice(null)}
          style={styles.previewNotice}
        >
          <Text style={styles.previewNoticeText}>{notice.message}</Text>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

function PoemArtwork({
  version,
  media,
  exportRef
}: {
  version: PoemVersionViewModel;
  media: ThreadMediaPreset;
  exportRef?: Ref<View>;
}) {
  const contributors = [...new Map(
    version.lines.map((line) => [line.author.id, line.author])
  ).values()];
  return (
    <View
      collapsable={false}
      ref={exportRef}
      style={[styles.artwork, { backgroundColor: media.backgroundColor }]}
    >
      {media.uri ? (
        <Image source={{ uri: media.uri }} resizeMode="cover" style={styles.artworkImage} />
      ) : null}
      <View style={[styles.artworkWash, { backgroundColor: media.overlayColor }]} />
      <Text style={[styles.artworkTitle, { color: media.textColor }]}>{version.title}</Text>
      <View style={styles.artworkRule} />
      {version.criterion === "harmonized" ? (
        <View style={styles.harmonizedLegend}>
          <View style={styles.harmonizedLegendSwatch} />
          <Text style={[styles.harmonizedLegendText, { color: media.mutedTextColor }]}>
            Blue marks AI additions or replacements
          </Text>
        </View>
      ) : null}
      {version.lines.map((line) => {
        const segments = line.originalText
          ? buildAiTextSegments(line.originalText, line.text)
          : [{ text: line.text, ai: false }];
        return (
          <View
            key={line.id}
            style={[
              styles.artworkLineRow,
              line.originalText && styles.harmonizedLineRow
            ]}
          >
            <Avatar
              color={line.author.avatarColor}
              imageSource={line.author.avatarUrl ? { uri: line.author.avatarUrl } : undefined}
              label={line.author.displayName}
              size={30}
            />
            <View style={styles.artworkLineCopy}>
              <View style={styles.artworkLineHeader}>
                <Text style={[styles.artworkLineAuthor, { color: media.textColor }]}>
                  {line.lineNumber}. @{line.author.handle}
                </Text>
                <Text style={[styles.artworkLineLikes, { color: media.mutedTextColor }]}>
                  ♥ {line.likes}
                </Text>
              </View>
              <Text style={[styles.artworkLine, { color: media.textColor }]}>
                {segments.map((segment, index) => (
                  <Text
                    key={`${line.id}:${index}`}
                    style={segment.ai ? styles.harmonizedText : undefined}
                  >
                    {segment.text}
                  </Text>
                ))}
              </Text>
              {line.aiChangeNote ? (
                <Text style={styles.harmonizedChangeNote}>{line.aiChangeNote}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
      <View style={styles.artworkFooter}>
        <View style={styles.artworkContributors}>
          {contributors.slice(0, 5).map((contributor, index) => (
            <View
              key={contributor.id}
              style={[styles.artworkAvatar, { marginLeft: index ? -8 : 0 }]}
            >
              <Avatar
                color={contributor.avatarColor}
                imageSource={contributor.avatarUrl ? { uri: contributor.avatarUrl } : undefined}
                label={contributor.displayName}
                size={28}
              />
            </View>
          ))}
        </View>
        <Text style={[styles.artworkMeta, { color: media.mutedTextColor }]}>
          {version.lines.length} lines · {version.totalLikeScore} likes
        </Text>
      </View>
    </View>
  );
}

function AiVersionLoadingOverlay({
  criterion
}: {
  criterion: "recommended" | "harmonized";
}) {
  const harmonizing = criterion === "harmonized";
  return (
    <View
      accessibilityLabel={
        harmonizing
          ? "AI is harmonizing this poem path"
          : "AI is choosing the recommended poem path"
      }
      accessibilityRole="progressbar"
      style={styles.aiLoadingOverlay}
    >
      <View style={styles.aiLoadingCard}>
        <View style={styles.aiLoadingSpinner}>
          <ActivityIndicator color="#73AEDD" size="small" />
        </View>
        <View style={styles.aiLoadingCopy}>
          <Text style={styles.aiLoadingTitle}>
            {harmonizing ? "Harmonizing this path…" : "Choosing the clearest path…"}
          </Text>
          <Text style={styles.aiLoadingBody}>
            {harmonizing
              ? "Preserving every voice while smoothing the transitions."
              : "Comparing every branch without rewriting anyone’s words."}
          </Text>
        </View>
      </View>
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
        <Pressable key={item.label} onPress={item.onPress} style={styles.previewMenuItem}>
          <Text style={styles.previewMenuText}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function compareMostPopular(left: PoemVersionViewModel, right: PoemVersionViewModel) {
  return (
    right.totalLikeScore - left.totalLikeScore ||
    right.continuationCount - left.continuationCount ||
    left.id.localeCompare(right.id)
  );
}

function criterionLabel(criterion?: PoemVersionCriterion) {
  if (criterion === "recommended") return "Recommended";
  if (criterion === "harmonized") return "AI Harmonized";
  if (criterion === "mostPopular") return "Popular";
  if (criterion === "custom") return "My custom version";
  return "Recommended";
}

function criterionDescription(
  criterion: PoemVersionCriterion | undefined,
  aiLoading: boolean,
  aiUnavailable: boolean,
  aiStale: boolean
) {
  if (criterion === "recommended") {
    if (aiUnavailable) return "AI is unavailable; the most popular intact path is shown.";
    if (aiStale) return "Showing the previous shared path while new contributions are reviewed.";
    return aiLoading
      ? "Preparing one shared recommendation for every reader."
      : "The most coherent existing path, with every word preserved.";
  }
  if (criterion === "harmonized") {
    if (aiUnavailable) return "AI is unavailable; the recommended path remains unchanged.";
    if (aiStale) return "Showing the previous shared edit while the new relay is harmonized.";
    return aiLoading
      ? "Preparing one shared, traceable edit in the background."
      : "Small transition edits only; blue marks every AI-authored change.";
  }
  if (criterion === "mostPopular") return "The path with the highest combined likes.";
  if (criterion === "custom") return "Your one-choice-per-line edit.";
  return "The most coherent existing path, with every word preserved.";
}

const styles = StyleSheet.create({
  previewScreen: { backgroundColor: "#11151D" },
  previewRoot: { flex: 1, backgroundColor: "#11151D" },
  previewTopBar: {
    height: 92,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between"
  },
  previewIconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  closeGlyph: { color: colors.white, fontSize: 34, lineHeight: 38 },
  previewTitleCopy: { alignItems: "center" },
  previewTopTitle: { color: colors.white, fontSize: 18, fontWeight: "700" },
  previewTopSubtitle: { marginTop: 2, color: "rgba(255,255,255,.62)", fontSize: 11 },
  previewViewport: { flex: 1, position: "relative" },
  exportCaptureStage: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: 420
  },
  previewLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  previewLoadingText: { color: "rgba(255,255,255,.7)", fontSize: 13 },
  versionPager: { flex: 1 },
  versionPage: { flex: 1 },
  versionPageContent: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 190 },
  versionMetaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12
  },
  versionCriterion: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  versionNumber: {
    marginBottom: 2,
    color: "#73AEDD",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1.4
  },
  versionDescription: {
    maxWidth: 270,
    marginTop: 4,
    color: "rgba(255,255,255,.58)",
    fontSize: 11,
    lineHeight: 15
  },
  versionRationale: {
    maxWidth: 280,
    marginTop: 7,
    color: "rgba(255,255,255,.78)",
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic"
  },
  totalLikesPill: {
    minWidth: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.1)"
  },
  totalLikesValue: { color: colors.white, fontSize: 18, fontWeight: "700" },
  totalLikesLabel: { color: "rgba(255,255,255,.54)", fontSize: 9 },
  artworkLoadingFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28
  },
  aiLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: "rgba(17,21,29,.72)"
  },
  aiLoadingCard: {
    width: "100%",
    maxWidth: 300,
    minHeight: 92,
    paddingHorizontal: 17,
    paddingVertical: 15,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(115,174,221,.34)",
    backgroundColor: "rgba(17,21,29,.94)"
  },
  aiLoadingSpinner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(115,174,221,.12)"
  },
  aiLoadingCopy: { flex: 1, minWidth: 0 },
  aiLoadingTitle: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700"
  },
  aiLoadingBody: {
    marginTop: 4,
    color: "rgba(255,255,255,.62)",
    fontSize: 10,
    lineHeight: 15
  },
  artwork: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    minHeight: 470
  },
  artworkImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  artworkWash: { ...StyleSheet.absoluteFillObject },
  artworkTitle: {
    position: "relative",
    fontSize: 31,
    lineHeight: 38,
    fontFamily: "Georgia",
    fontWeight: "700"
  },
  artworkRule: {
    position: "relative",
    width: 42,
    height: 2,
    marginTop: 15,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,.42)"
  },
  harmonizedLegend: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 5
  },
  harmonizedLegendSwatch: {
    width: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(69, 143, 204, .28)"
  },
  harmonizedLegendText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600"
  },
  artworkLineRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10
  },
  harmonizedLineRow: {
    position: "relative"
  },
  artworkLineCopy: { flex: 1, minWidth: 0 },
  artworkLineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  artworkLineAuthor: { fontSize: 11, lineHeight: 14, fontWeight: "700", opacity: 0.72 },
  artworkLineLikes: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
  artworkLine: { marginTop: 4, fontSize: 17, lineHeight: 25, fontFamily: "Georgia" },
  harmonizedText: {
    color: "#2878A8",
    fontWeight: "600",
    textDecorationColor: "rgba(40, 120, 168, .30)",
    textDecorationLine: "underline"
  },
  harmonizedChangeNote: {
    marginTop: 5,
    color: "#367EAF",
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600"
  },
  artworkFooter: {
    position: "relative",
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,.32)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  artworkContributors: { flexDirection: "row", alignItems: "center" },
  artworkAvatar: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.8)",
    borderRadius: 16
  },
  artworkMeta: { fontSize: 11 },
  customEntry: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,.22)",
    backgroundColor: "rgba(255,255,255,.06)"
  },
  customEntryTitle: { color: colors.white, fontSize: 15, fontWeight: "700" },
  customEntryBody: { marginTop: 3, color: "rgba(255,255,255,.56)", fontSize: 11 },
  pageIndicator: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,.28)"
  },
  pageDotActive: { width: 20, backgroundColor: colors.white },
  versionActions: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 30,
    flexDirection: "row",
    gap: 10
  },
  versionActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white
  },
  versionActionText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  postActionButton: { backgroundColor: "#E7CC88" },
  postActionButtonUnavailable: { opacity: 0.52 },
  postActionText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  previewMenu: {
    position: "absolute",
    right: 18,
    top: 4,
    zIndex: 20,
    minWidth: 178,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.white
  },
  previewMenuBottom: { top: undefined, bottom: 90, left: 18, right: undefined },
  previewMenuItem: { minHeight: 42, paddingHorizontal: 16, justifyContent: "center" },
  previewMenuText: { color: colors.ink, fontSize: 14 },
  previewNotice: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 96,
    zIndex: 30,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.black
  },
  previewNoticeText: { color: colors.white, fontSize: 13, textAlign: "center" }
});
