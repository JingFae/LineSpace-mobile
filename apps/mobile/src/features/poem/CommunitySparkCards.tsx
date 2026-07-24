import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { Avatar } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type {
  ApplyCommunitySparkResult,
  CommunitySparkResponse,
  CommunitySparkSuggestion,
  CommunitySparkWorkingCopy,
  PoemSummary
} from "@linespace/api-client";
import { HttpLineSpaceApiError } from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";

type CommunitySparkCardsProps = {
  autoLoad?: boolean;
  label: "Community Spark" | "Creative Spark";
  /** Draft mode generates against the supplied working copy without persisting a post. */
  sparkMode?: "post" | "draft";
  poem?: PoemSummary;
  userId: string;
  workingCopy?: CommunitySparkWorkingCopy;
  onApplied?: (result: ApplyCommunitySparkResult, change: SparkApplyChange) => void;
  onDraftApplied?: (change: SparkApplyChange) => void;
  onSourcePress?: (commentId: string) => void;
};

export type SparkApplyChange = {
  beforeLines: string[];
  afterLines: string[];
  suggestion: CommunitySparkSuggestion;
};

export function CommunitySparkCards({
  autoLoad = false,
  label,
  sparkMode = "post",
  poem,
  userId,
  workingCopy,
  onApplied,
  onDraftApplied,
  onSourcePress
}: CommunitySparkCardsProps) {
  const [expanded, setExpanded] = useState(autoLoad);
  const [batch, setBatch] = useState<CommunitySparkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [generatedCopyKey, setGeneratedCopyKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const loadingRef = useRef(false);
  const previousSuggestionsRef = useRef<string[]>([]);
  const autoLoadedPostRef = useRef<string | null>(null);

  const resolvedWorkingCopy = useMemo(() => {
    const fallbackLines = poem?.lines ?? [];
    const lines = (workingCopy?.lines ?? fallbackLines)
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      title: (workingCopy?.title ?? poem?.title ?? "").trim(),
      lines: lines.length ? lines : fallbackLines,
      tags: workingCopy?.tags ?? poem?.tags ?? []
    };
  }, [poem?.lines, poem?.tags, poem?.title, workingCopy]);
  const currentCopyKey = useMemo(
    () => JSON.stringify(resolvedWorkingCopy),
    [resolvedWorkingCopy]
  );
  const suggestionsAreStale = Boolean(
    batch && generatedCopyKey && generatedCopyKey !== currentCopyKey
  );

  const loadBatch = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setExpanded(true);
    setLoading(true);
    setError(null);
    setAppliedId(null);
    if (resolvedWorkingCopy.lines.length === 0) {
      setError("Write at least one line before asking Creative Spark.");
      setLoading(false);
      loadingRef.current = false;
      return;
    }
    try {
      const next = sparkMode === "draft"
        ? await lineSpaceApi.requestCreativeSpark({
            userId,
            previousSuggestions: previousSuggestionsRef.current.slice(-12),
            workingCopy: resolvedWorkingCopy
          })
        : await lineSpaceApi.requestCommunitySpark({
            poemId: poem!.id,
            userId,
            previousSuggestions: previousSuggestionsRef.current.slice(-12),
            workingCopy: resolvedWorkingCopy
          });
      previousSuggestionsRef.current = [
        ...previousSuggestionsRef.current,
        ...next.suggestions.map((suggestion) => suggestion.suggestion)
      ].slice(-12);
      setBatch(next);
      setGeneratedCopyKey(currentCopyKey);
      setPage(0);
      setTimeout(() => scrollRef.current?.scrollTo({ x: 0, animated: false }), 0);
    } catch (loadError) {
      setError(communitySparkLoadError(loadError));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [currentCopyKey, poem?.id, resolvedWorkingCopy, sparkMode, userId]);

  useEffect(() => {
    const sparkKey = poem?.id ?? `draft-${currentCopyKey}`;
    if (!autoLoad || autoLoadedPostRef.current === sparkKey) return;
    autoLoadedPostRef.current = sparkKey;
    void loadBatch();
  }, [autoLoad, currentCopyKey, loadBatch, poem?.id]);

  const applySuggestion = async (suggestion: CommunitySparkSuggestion) => {
    if (applyingId || !batch) return;
    if (suggestionsAreStale) {
      setError("Your words changed. Refresh these ideas before applying one.");
      return;
    }
    setApplyingId(suggestion.id);
    setError(null);
    try {
      const change: SparkApplyChange = {
        beforeLines: [...resolvedWorkingCopy.lines],
        afterLines: [...suggestion.proposedLines],
        suggestion
      };
      if (sparkMode === "draft") {
        onDraftApplied?.(change);
        setAppliedId(suggestion.id);
        return;
      }
      const result = await lineSpaceApi.applyCommunitySpark({
        poemId: poem!.id,
        userId,
        suggestionId: suggestion.id,
        baseRevision: batch.baseRevision,
        proposedLines: suggestion.proposedLines,
        sourceCommentId: suggestion.source?.commentId
      });
      setAppliedId(suggestion.id);
      onApplied?.(result, change);
    } catch {
      setError("This idea could not be applied. Refresh and try once more.");
    } finally {
      setApplyingId(null);
    }
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (!viewportWidth || !batch) return;
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
    if (nextPage >= batch.suggestions.length) {
      void loadBatch();
      return;
    }
    setPage(nextPage);
  };

  if (!expanded) {
    return (
      <Pressable
        accessibilityHint="Turn reader feedback into writing ideas"
        accessibilityRole="button"
        onPress={() => void loadBatch()}
        style={styles.entryButton}
      >
        <Text style={styles.entrySpark}>✦</Text>
        <Text style={styles.entryLabel}>{label}</Text>
        <Text style={styles.entryArrow}>›</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.sparkMark}><Text style={styles.sparkMarkText}>✦</Text></View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{label}</Text>
          <Text style={styles.subtitle}>{sparkMode === "draft" ? "Ideas shaped by your draft" : "Ideas shaped by your readers"}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {batch ? (
            <Pressable
              accessibilityLabel="Refresh Creative Spark ideas"
              disabled={loading}
              onPress={() => void loadBatch()}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={`Collapse ${label}`}
            onPress={() => setExpanded(false)}
            style={styles.collapseButton}
          >
            <Text style={styles.collapseText}>⌃</Text>
          </Pressable>
        </View>
      </View>

      {loading && !batch ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.stateTitle}>Listening for a spark…</Text>
          <Text style={styles.stateBody}>Reading the poem alongside thoughtful feedback.</Text>
        </View>
      ) : error && !batch ? (
        <Pressable onPress={() => void loadBatch()} style={styles.stateCard}>
          <Text style={styles.stateTitle}>{error}</Text>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      ) : batch ? (
        <>
          <Text style={styles.summary}>{batch.summary}</Text>
          {suggestionsAreStale ? (
            <Pressable onPress={() => void loadBatch()} style={styles.staleBanner}>
              <Text style={styles.staleText}>Your words changed · refresh ideas</Text>
            </Pressable>
          ) : null}
          <View
            onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
            style={styles.carouselViewport}
          >
            <ScrollView
              decelerationRate="fast"
              horizontal
              onMomentumScrollEnd={handleMomentumEnd}
              pagingEnabled
              ref={scrollRef}
              showsHorizontalScrollIndicator={false}
            >
              {batch.suggestions.map((suggestion, index) => (
                <View
                  key={suggestion.id}
                  style={[styles.slide, { width: viewportWidth || 320 }]}
                >
                  <SuggestionCard
                    applied={appliedId === suggestion.id}
                    applying={applyingId === suggestion.id}
                    disabled={suggestionsAreStale || Boolean(applyingId)}
                    index={index}
                    onApply={() => void applySuggestion(suggestion)}
                    onSourcePress={onSourcePress}
                    suggestion={suggestion}
                  />
                </View>
              ))}
              <View style={[styles.slide, { width: viewportWidth || 320 }]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => void loadBatch()}
                  style={styles.moreCard}
                >
                  {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.moreGlyph}>→</Text>}
                  <Text style={styles.moreTitle}>{loading ? "Finding three more…" : "Swipe for three more"}</Text>
                  <Text style={styles.moreBody}>A fresh batch will explore a different direction.</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
          <View style={styles.pagination}>
            {batch.suggestions.map((suggestion, index) => (
              <View
                key={`${suggestion.id}-dot`}
                style={[styles.dot, page === index && styles.dotActive]}
              />
            ))}
          </View>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

function communitySparkLoadError(error: unknown) {
  if (error instanceof HttpLineSpaceApiError) {
    return error.message;
  }
  return "Creative Spark is resting for a moment. Try again.";
}

function SuggestionCard({
  suggestion,
  index,
  applying,
  applied,
  disabled,
  onApply,
  onSourcePress
}: {
  suggestion: CommunitySparkSuggestion;
  index: number;
  applying: boolean;
  applied: boolean;
  disabled: boolean;
  onApply: () => void;
  onSourcePress?: (commentId: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopline}>
        <Text style={styles.cardNumber}>0{index + 1}</Text>
        <Text style={styles.kindLabel}>
          {suggestion.kind === "revise" ? "REVISION IDEA" : "CONTINUATION IDEA"}
        </Text>
      </View>
      <Text style={styles.suggestion}>{suggestion.suggestion}</Text>
      <View style={styles.previewBox}>
        <Text style={styles.previewLabel}>A possible line</Text>
        <Text numberOfLines={3} style={styles.previewText}>{suggestion.preview}</Text>
      </View>
      <View style={styles.cardFooter}>
        {suggestion.source ? (
          <Pressable
            accessibilityHint="Open this comment in the post"
            accessibilityRole="link"
            onPress={() => onSourcePress?.(suggestion.source!.commentId)}
            style={styles.source}
          >
            <Avatar
              color={suggestion.source.author.avatarColor}
              imageSource={suggestion.source.author.avatarUrl ? { uri: suggestion.source.author.avatarUrl } : undefined}
              label={suggestion.source.author.displayName}
              size={22}
            />
            <View style={styles.sourceCopy}>
              <Text style={styles.sourceBy}>From @{suggestion.source.author.handle}</Text>
              <Text numberOfLines={1} style={styles.sourceExcerpt}>“{suggestion.source.excerpt}”</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.poemSource}>Inspired by the poem’s own voice</Text>
        )}
        <Pressable
          accessibilityLabel="Apply this suggestion to the poem lines"
          accessibilityRole="button"
          disabled={disabled || applied}
          onPress={onApply}
          style={[styles.applyButton, (disabled || applied) && styles.applyButtonDisabled]}
        >
          {applying ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.applyGlyph}>{applied ? "✓" : "✓"}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entryButton: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center"
  },
  entrySpark: { color: colors.accentWarm, fontSize: 16, marginRight: 9 },
  entryLabel: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "600" },
  entryArrow: { color: colors.profileMuted, fontSize: 24, fontWeight: "300" },
  shell: {
    marginTop: 16,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#FBF8F1"
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitleRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  sparkMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  sparkMarkText: { color: "#F7D990", fontSize: 15 },
  headerCopy: { flex: 1, marginLeft: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  subtitle: { marginTop: 2, color: colors.profileMuted, fontSize: 10 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 3 },
  refreshButton: { paddingHorizontal: 8, paddingVertical: 8 },
  refreshText: { color: colors.profileMuted, fontSize: 11, fontWeight: "600" },
  collapseButton: { width: 32, height: 36, alignItems: "center", justifyContent: "center" },
  collapseText: { color: colors.profileMuted, fontSize: 18 },
  summary: { paddingHorizontal: 16, paddingBottom: 10, color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  stateCard: { minHeight: 176, padding: 24, alignItems: "center", justifyContent: "center" },
  stateTitle: { marginTop: 12, color: colors.ink, fontSize: 15, fontWeight: "600", textAlign: "center" },
  stateBody: { marginTop: 6, maxWidth: 250, color: colors.profileMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
  retryText: { marginTop: 10, color: colors.accentWarm, fontSize: 12, fontWeight: "600" },
  staleBanner: { marginHorizontal: 14, marginBottom: 8, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: "center" },
  staleText: { color: colors.accentWarm, fontSize: 11, fontWeight: "600" },
  carouselViewport: { width: "100%" },
  slide: { paddingHorizontal: 12, paddingBottom: 4 },
  card: {
    minHeight: 248,
    padding: 17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E9E0D2",
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1
  },
  cardTopline: { flexDirection: "row", alignItems: "center" },
  cardNumber: { color: colors.ink, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  kindLabel: { marginLeft: 9, color: colors.profileMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  suggestion: { marginTop: 13, color: colors.ink, fontFamily: "Georgia", fontSize: 18, lineHeight: 25 },
  previewBox: { marginTop: 13, paddingLeft: 11, borderLeftWidth: 2, borderLeftColor: "#D8B66A" },
  previewLabel: { color: colors.profileMuted, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase" },
  previewText: { marginTop: 4, color: colors.inkSoft, fontFamily: "Georgia", fontSize: 14, lineHeight: 20 },
  cardFooter: { flex: 1, minHeight: 54, marginTop: 15, flexDirection: "row", alignItems: "flex-end" },
  source: { flex: 1, minWidth: 0, paddingRight: 10, flexDirection: "row", alignItems: "center" },
  sourceCopy: { flex: 1, minWidth: 0, marginLeft: 7 },
  sourceBy: { color: colors.profileMuted, fontSize: 9, fontWeight: "600" },
  sourceExcerpt: { marginTop: 2, color: colors.tabMuted, fontSize: 10, lineHeight: 14 },
  poemSource: { flex: 1, paddingRight: 10, color: colors.tabMuted, fontSize: 10, fontStyle: "italic" },
  applyButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  applyButtonDisabled: { opacity: 0.42 },
  applyGlyph: { color: colors.white, fontSize: 18, fontWeight: "700" },
  moreCard: { minHeight: 248, borderRadius: 17, borderWidth: 1, borderStyle: "dashed", borderColor: colors.faint, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  moreGlyph: { color: colors.ink, fontSize: 25, fontWeight: "300" },
  moreTitle: { marginTop: 9, color: colors.ink, fontSize: 15, fontWeight: "600" },
  moreBody: { marginTop: 6, color: colors.profileMuted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  pagination: { height: 28, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.faint },
  dotActive: { width: 16, backgroundColor: colors.ink },
  inlineError: { paddingHorizontal: 16, paddingBottom: 12, color: colors.accentWarm, fontSize: 11, textAlign: "center" }
});
