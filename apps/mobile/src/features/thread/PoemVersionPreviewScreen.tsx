import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
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
import { AppScreen, Avatar, EmptyState, MoreIcon, ShareIcon } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { ThreadContinuation, ThreadDetail } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import {
  adaptThreadToCreativeViewModel,
  buildCustomPoemVersion,
  buildPoemVersions,
  getFullPoemText,
  getThreadMedia,
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
  const [pageIndex, setPageIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<ExportNotice | null>(null);
  const threadQuery = useQuery({
    queryKey: ["thread-detail", threadId, currentUserId],
    enabled: Boolean(threadId),
    queryFn: () => lineSpaceApi.getThread(threadId!, currentUserId)
  });
  const treeQuery = useQuery({
    queryKey: [
      "thread-version-tree",
      threadId,
      currentUserId,
      threadQuery.data?.continuations.map((item) => item.id).join("|")
    ],
    enabled: Boolean(threadQuery.data),
    queryFn: () => getThreadContinuationTree(threadQuery.data!)
  });
  const detail = threadQuery.data ?? undefined;
  const allContinuations = treeQuery.data ?? detail?.continuations ?? [];
  const baseVersions = useMemo(
    () => (detail ? buildPoemVersions(detail.thread, allContinuations) : []),
    [allContinuations, detail]
  );
  const recommendationQuery = useQuery({
    queryKey: ["thread-version-recommendation", threadId, versionSignature(baseVersions)],
    enabled: Boolean(detail && baseVersions.length),
    retry: false,
    queryFn: () =>
      lineSpaceApi.requestAiAssist({
        intent: "moderation-preview",
        locale: "en",
        poemId: threadId,
        text: JSON.stringify({
          task: "recommend-thread-version",
          versions: baseVersions.map((version) => ({
            id: version.id,
            lineCount: version.lines.length,
            totalLikes: version.totalLikeScore,
            lines: version.lines.map((line) => ({
              lineNumber: line.lineNumber,
              text: line.text,
              authorId: line.author.id,
              likes: line.likes,
              parentContinuationId: line.parentContinuationId
            }))
          }))
        })
      })
  });
  const selectedCustomIds = useMemo(
    () => (customSelectionIds ?? "").split(",").map((id) => id.trim()).filter(Boolean),
    [customSelectionIds]
  );
  const versions = useMemo(() => {
    if (!detail || baseVersions.length === 0) return [];
    const mostPopular = [...baseVersions].sort(compareMostPopular)[0]!;
    const longest = [...baseVersions].sort(compareLongest)[0]!;
    const aiResult = parseRecommendation(recommendationQuery.data?.suggestions[0]);
    const recommendedBase =
      baseVersions.find((version) => version.id === aiResult?.selectedVersionId) ??
      mostPopular;
    const recommended = {
      ...recommendedBase,
      id: `${recommendedBase.id}:recommended`,
      criterion: "recommended" as const,
      aiRationale: aiResult?.rationale
    };
    const pages: PoemVersionViewModel[] = [
      recommended,
      { ...mostPopular, id: `${mostPopular.id}:popular`, criterion: "mostPopular" },
      { ...longest, id: `${longest.id}:longest`, criterion: "longest" }
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
    recommendationQuery.data?.suggestions,
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
    if (Platform.OS === "web") {
      const exported =
        kind === "JPG"
          ? await exportVersionJpeg(currentVersion, media)
          : exportVersionPdf(currentVersion, media);
      setNotice({
        id: `${currentVersion.id}:${kind}`,
        message: exported
          ? `${kind} export opened successfully.`
          : `${kind} export was blocked by the browser.`
      });
      return;
    }
    await Share.share({
      title: currentVersion.title,
      message: `${currentVersion.title}\n\n${getFullPoemText(currentVersion)}`
    });
    setNotice({
      id: `${currentVersion.id}:${kind}`,
      message: `${kind} content is ready in the system share sheet.`
    });
  };

  const handlePost = () => {
    if (!currentVersion || !creativeThread) return;
    if (!canPostVersion) {
      setNotice({
        id: `${currentVersion.id}:post-forbidden`,
        message: "Join this Thread before publishing one of its versions."
      });
      return;
    }
    const sortedContributors = [...new Map(
      currentVersion.lines.map((line) => [line.author.id, line.author])
    ).values()].sort((left, right) => left.handle.localeCompare(right.handle));
    router.push({
      pathname: "/(tabs)/compose",
      params: {
        type: "post",
        session: `thread-version-${currentVersion.id}-${Date.now()}`,
        sourceThreadId: currentVersion.threadId,
        sourceVersionId: currentVersion.id,
        generatedTitle: currentVersion.title,
        fullPoemText: getFullPoemText(currentVersion),
        contributorIds: sortedContributors.map((person) => person.id).join(","),
        contributorHandles: sortedContributors.map((person) => person.handle).join(","),
        versionLines: JSON.stringify(currentVersion.lines),
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
        {threadQuery.isLoading || treeQuery.isLoading ? (
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
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.versionPageContent}
                  >
                    <View style={styles.versionMetaRow}>
                      <View>
                        <Text style={styles.versionCriterion}>
                          {criterionLabel(version.criterion)}
                        </Text>
                        <Text style={styles.versionDescription}>
                          {criterionDescription(
                            version.criterion,
                            recommendationQuery.isFetching
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
                    <PoemArtwork version={version} media={media} />
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
            <View style={styles.pageIndicator}>
              {versions.map((version, index) => (
                <View
                  key={version.id}
                  style={[styles.pageDot, index === pageIndex && styles.pageDotActive]}
                />
              ))}
            </View>
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
  media
}: {
  version: PoemVersionViewModel;
  media: ThreadMediaPreset;
}) {
  const contributors = [...new Map(
    version.lines.map((line) => [line.author.id, line.author])
  ).values()];
  return (
    <View style={[styles.artwork, { backgroundColor: media.backgroundColor }]}>
      {media.uri ? (
        <Image source={{ uri: media.uri }} resizeMode="cover" style={styles.artworkImage} />
      ) : null}
      <View style={[styles.artworkWash, { backgroundColor: media.overlayColor }]} />
      <Text style={[styles.artworkTitle, { color: media.textColor }]}>{version.title}</Text>
      <View style={styles.artworkRule} />
      {version.lines.map((line) => (
        <View key={line.id} style={styles.artworkLineRow}>
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
            <Text style={[styles.artworkLine, { color: media.textColor }]}>{line.text}</Text>
          </View>
        </View>
      ))}
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

async function getThreadContinuationTree(detail: ThreadDetail) {
  const visited = new Set<string>();
  const result: ThreadContinuation[] = [];
  const visit = async (continuation: ThreadContinuation) => {
    if (visited.has(continuation.id)) return;
    visited.add(continuation.id);
    result.push(continuation);
    const childDetail = await lineSpaceApi.getContinuationDetail(
      continuation.id,
      currentUserId
    );
    for (const child of childDetail?.children ?? []) await visit(child);
  };
  for (const continuation of detail.continuations) await visit(continuation);
  return result;
}

function versionSignature(versions: readonly PoemVersionViewModel[]) {
  return versions
    .map((version) => `${version.id}:${version.updatedAt}:${version.totalLikeScore}`)
    .join("|");
}

function compareMostPopular(left: PoemVersionViewModel, right: PoemVersionViewModel) {
  return (
    right.totalLikeScore - left.totalLikeScore ||
    right.continuationCount - left.continuationCount ||
    left.id.localeCompare(right.id)
  );
}

function compareLongest(left: PoemVersionViewModel, right: PoemVersionViewModel) {
  return (
    right.continuationCount - left.continuationCount ||
    right.totalLikeScore - left.totalLikeScore ||
    left.id.localeCompare(right.id)
  );
}

function criterionLabel(criterion?: PoemVersionCriterion) {
  if (criterion === "recommended") return "Recommended";
  if (criterion === "mostPopular") return "Most popular";
  if (criterion === "custom") return "My custom version";
  return "Longest";
}

function criterionDescription(
  criterion: PoemVersionCriterion | undefined,
  aiLoading: boolean
) {
  if (criterion === "recommended") {
    return aiLoading
      ? "AI is reviewing tone, imagery and continuity."
      : "AI-reviewed path with a popularity fallback.";
  }
  if (criterion === "mostPopular") return "The path with the highest combined likes.";
  if (criterion === "custom") return "Your one-choice-per-line edit.";
  return "The path with the greatest number of connected lines.";
}

function parseRecommendation(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as {
      selectedVersionId?: unknown;
      rationale?: unknown;
    };
    return {
      selectedVersionId:
        typeof parsed.selectedVersionId === "string"
          ? parsed.selectedVersionId
          : undefined,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined
    };
  } catch {
    return undefined;
  }
}

async function exportVersionJpeg(
  version: PoemVersionViewModel,
  media: ThreadMediaPreset
) {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  const width = 1200;
  const lineHeight = 70;
  const height = Math.max(1200, 320 + version.lines.length * lineHeight);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.fillStyle = media.backgroundColor;
  context.fillRect(0, 0, width, height);
  context.fillStyle = media.textColor;
  context.font = "bold 54px Georgia";
  context.fillText(version.title, 90, 120);
  context.font = "24px Arial";
  let y = 220;
  for (const line of version.lines) {
    context.font = "bold 20px Arial";
    context.fillText(`${line.lineNumber}. @${line.author.handle}  ♥ ${line.likes}`, 90, y);
    context.font = "28px Georgia";
    drawWrappedText(context, line.text, 90, y + 34, width - 180, 36);
    y += lineHeight;
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) return false;
  downloadBlob(blob, `${safeFilename(version.title)}.jpg`);
  return true;
}

function exportVersionPdf(version: PoemVersionViewModel, media: ThreadMediaPreset) {
  if (typeof window === "undefined") return false;
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return false;
  const lines = version.lines
    .map(
      (line) =>
        `<section><small>${line.lineNumber}. @${escapeHtml(line.author.handle)} · ♥ ${line.likes}</small><p>${escapeHtml(line.text)}</p></section>`
    )
    .join("");
  popup.document.write(
    `<!doctype html><html><head><title>${escapeHtml(version.title)}</title><style>body{margin:0;padding:56px;background:${media.backgroundColor};color:${media.textColor};font-family:Georgia,serif}main{max-width:720px;margin:auto}h1{font-size:42px}section{margin:32px 0}small{font:600 13px Arial,sans-serif;opacity:.72}p{font-size:22px;line-height:1.65;white-space:pre-wrap}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><main><h1>${escapeHtml(version.title)}</h1>${lines}</main><script>window.onload=()=>window.print()</script></body></html>`
  );
  popup.document.close();
  return true;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let offset = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + offset);
      line = word;
      offset += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) context.fillText(line, x, y + offset);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").slice(0, 80) || "linespace-version";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  artworkLineRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 116,
    flexDirection: "row",
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
