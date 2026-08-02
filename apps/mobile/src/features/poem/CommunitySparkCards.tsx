import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
  PoemSummary,
  UndoCommunitySparkResult
} from "@linespace/api-client";
import { HttpLineSpaceApiError } from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import {
  getSparkPreviewLines,
  removeSparkChangeFromLines
} from "./spark-card-model";

type CommunitySparkCardsProps = {
  autoLoad?: boolean;
  label: "Community Spark" | "Creative Spark";
  /** Draft mode generates against the supplied working copy without persisting a post. */
  sparkMode?: "post" | "draft";
  poem?: PoemSummary;
  userId: string;
  workingCopy?: CommunitySparkWorkingCopy;
  onApplied?: (result: ApplyCommunitySparkResult, change: SparkApplyChange) => void;
  onUndone?: (result: UndoCommunitySparkResult, change: SparkApplyChange) => void;
  onDraftApplied?: (change: SparkApplyChange) => void;
  onDraftUndone?: (change: SparkApplyChange, restoredLines: string[]) => void;
  onSourcePress?: (commentId: string) => void;
};

export type SparkApplyChange = {
  beforeLines: string[];
  afterLines: string[];
  suggestion: CommunitySparkSuggestion;
};

type StoredSparkBatch = {
  response: CommunitySparkResponse;
  copyKey: string;
  beforeLines: string[];
};

type SparkCardEntry = {
  batch: StoredSparkBatch;
  suggestion: CommunitySparkSuggestion;
};

type AppliedSparkCard = {
  change: SparkApplyChange;
};

export function CommunitySparkCards({
  autoLoad = false,
  label,
  sparkMode = "post",
  poem,
  userId,
  workingCopy,
  onApplied,
  onUndone,
  onDraftApplied,
  onDraftUndone,
  onSourcePress
}: CommunitySparkCardsProps) {
  const [expanded, setExpanded] = useState(autoLoad);
  const [batches, setBatches] = useState<StoredSparkBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [appliedCards, setAppliedCards] = useState<Record<string, AppliedSparkCard>>({});
  const [justAppliedId, setJustAppliedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const loadingRef = useRef(false);
  const previousSuggestionsRef = useRef<string[]>([]);
  const autoLoadedPostRef = useRef<string | null>(null);
  const batchesRef = useRef<StoredSparkBatch[]>([]);
  const viewportWidthRef = useRef(0);
  const appliedPulse = useRef(new Animated.Value(0)).current;

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
  const entries = useMemo<SparkCardEntry[]>(
    () =>
      batches.flatMap((batch) =>
        batch.response.suggestions.map((suggestion) => ({ batch, suggestion }))
      ),
    [batches]
  );
  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const loadBatch = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setExpanded(true);
    setLoading(true);
    setError(null);
    if (resolvedWorkingCopy.lines.length === 0) {
      setError("Write at least one line before asking Creative Spark.");
      setLoading(false);
      loadingRef.current = false;
      return;
    }
    const requestedCopy = {
      title: resolvedWorkingCopy.title,
      lines: [...resolvedWorkingCopy.lines],
      tags: [...resolvedWorkingCopy.tags]
    };
    const requestedCopyKey = currentCopyKey;
    try {
      const next = sparkMode === "draft"
        ? await lineSpaceApi.requestCreativeSpark({
            userId,
            previousSuggestions: previousSuggestionsRef.current.slice(-12),
            workingCopy: requestedCopy
          })
        : await lineSpaceApi.requestCommunitySpark({
            poemId: poem!.id,
            userId,
            previousSuggestions: previousSuggestionsRef.current.slice(-12),
            workingCopy: requestedCopy
          });
      previousSuggestionsRef.current = [
        ...previousSuggestionsRef.current,
        ...next.suggestions.map((suggestion) => suggestion.suggestion)
      ].slice(-12);
      const nextStartIndex = batchesRef.current.reduce(
        (total, batch) => total + batch.response.suggestions.length,
        0
      );
      const stored: StoredSparkBatch = {
        response: next,
        copyKey: requestedCopyKey,
        beforeLines: [...requestedCopy.lines]
      };
      const nextBatches = [...batchesRef.current, stored];
      batchesRef.current = nextBatches;
      setBatches(nextBatches);
      setPage(nextStartIndex);
      setTimeout(
        () =>
          scrollRef.current?.scrollTo({
            x: nextStartIndex * viewportWidthRef.current,
            animated: true
          }),
        0
      );
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

  const animateApplied = (suggestionId: string) => {
    setJustAppliedId(suggestionId);
    appliedPulse.stopAnimation();
    appliedPulse.setValue(0);
    Animated.sequence([
      Animated.timing(appliedPulse, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.delay(900),
      Animated.timing(appliedPulse, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true
      })
    ]).start(() => setJustAppliedId(null));
  };

  const rememberApplied = (change: SparkApplyChange) => {
    setAppliedCards((current) => ({
      ...current,
      [change.suggestion.id]: {
        change
      }
    }));
    animateApplied(change.suggestion.id);
  };

  const applySuggestion = async (entry: SparkCardEntry) => {
    if (applyingId || undoingId) return;
    const { batch, suggestion } = entry;
    if (batch.copyKey !== currentCopyKey) {
      setError("Your words changed. Refresh these ideas before applying one.");
      return;
    }
    setApplyingId(suggestion.id);
    setError(null);
    try {
      const change: SparkApplyChange = {
        beforeLines: [...batch.beforeLines],
        afterLines: [...suggestion.proposedLines],
        suggestion
      };
      if (sparkMode === "draft") {
        onDraftApplied?.(change);
        rememberApplied(change);
        return;
      }
      const result = await lineSpaceApi.applyCommunitySpark({
        poemId: poem!.id,
        userId,
        suggestionId: suggestion.id,
        baseRevision: batch.response.baseRevision,
        proposedLines: suggestion.proposedLines,
        sourceCommentId: suggestion.source?.commentId
      });
      const appliedChange = {
        ...change,
        afterLines: [...result.poem.lines]
      };
      rememberApplied(appliedChange);
      onApplied?.(result, appliedChange);
    } catch (applyError) {
      if (applyError instanceof HttpLineSpaceApiError) {
        if (
          applyError.code === "COMMUNITY_SPARK_STALE" ||
          applyError.code === "COMMUNITY_SPARK_BUSY"
        ) {
          setError(applyError.message);
          return;
        }
        setError(
          applyError.message ||
            "This idea could not be applied. Please try once more."
        );
        return;
      }
      setError("This idea could not be applied. Please try once more.");
    } finally {
      setApplyingId(null);
    }
  };

  const undoSuggestion = async (suggestionId: string) => {
    const applied = appliedCards[suggestionId];
    if (!applied || applyingId || undoingId) return;
    const currentLines = [...resolvedWorkingCopy.lines];
    const restoredLines = removeSparkChangeFromLines(
      currentLines,
      applied.change.beforeLines,
      applied.change.afterLines
    );
    setUndoingId(suggestionId);
    setError(null);
    try {
      if (sparkMode === "draft") {
        onDraftUndone?.(applied.change, restoredLines);
      } else {
        const result = await lineSpaceApi.undoCommunitySpark({
          poemId: poem!.id,
          userId,
          appliedLines: currentLines,
          previousLines: restoredLines
        });
        onUndone?.(result, applied.change);
      }
      setAppliedCards((current) => {
        const next = { ...current };
        delete next[suggestionId];
        return next;
      });
      setJustAppliedId(null);
    } catch (undoError) {
      setError(
        undoError instanceof HttpLineSpaceApiError
          ? undoError.message
          : "This AI change can no longer be undone safely."
      );
    } finally {
      setUndoingId(null);
    }
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (!viewportWidth || entries.length === 0) return;
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
    if (nextPage >= entries.length) {
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
          {batches.length > 0 ? (
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

      {loading && batches.length === 0 ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.ink} />
          <Text style={styles.stateTitle}>Listening for a spark…</Text>
          <Text style={styles.stateBody}>Reading the poem alongside thoughtful feedback.</Text>
        </View>
      ) : error && batches.length === 0 ? (
        <Pressable onPress={() => void loadBatch()} style={styles.stateCard}>
          <Text style={styles.stateTitle}>{error}</Text>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      ) : batches.length > 0 ? (
        <>
          <Text style={styles.summary}>
            {entries[Math.min(page, entries.length - 1)]?.batch.response.summary ??
              batches[batches.length - 1]?.response.summary}
          </Text>
          <View
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              viewportWidthRef.current = width;
              setViewportWidth(width);
            }}
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
              {entries.map((entry, index) => {
                const applied = appliedCards[entry.suggestion.id];
                const stale = entry.batch.copyKey !== currentCopyKey;
                const busy = applyingId === entry.suggestion.id || undoingId === entry.suggestion.id;
                return (
                <View
                  key={entry.suggestion.id}
                  style={[styles.slide, { width: viewportWidth || 320 }]}
                >
                  <SuggestionCard
                    applied={Boolean(applied)}
                    busy={busy}
                    disabled={Boolean(applyingId || undoingId) || (!applied && stale)}
                    index={index}
                    justApplied={justAppliedId === entry.suggestion.id}
                    onAction={() =>
                      void (applied
                        ? undoSuggestion(entry.suggestion.id)
                        : applySuggestion(entry))
                    }
                    onSourcePress={onSourcePress}
                    previewLines={getSparkPreviewLines(
                      entry.batch.beforeLines,
                      entry.suggestion.proposedLines,
                      entry.suggestion.preview
                    )}
                    pulse={appliedPulse}
                    stale={stale}
                    suggestion={entry.suggestion}
                  />
                </View>
                );
              })}
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
            {entries.map((entry, index) => (
              <View
                key={`${entry.suggestion.id}-dot`}
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
  previewLines,
  busy,
  applied,
  justApplied,
  pulse,
  stale,
  disabled,
  onAction,
  onSourcePress
}: {
  suggestion: CommunitySparkSuggestion;
  index: number;
  previewLines: string[];
  busy: boolean;
  applied: boolean;
  justApplied: boolean;
  pulse: Animated.Value;
  stale: boolean;
  disabled: boolean;
  onAction: () => void;
  onSourcePress?: (commentId: string) => void;
}) {
  return (
    <View style={[styles.card, applied && styles.cardApplied]}>
      <View style={styles.cardTopline}>
        <Text style={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</Text>
        <Text style={styles.kindLabel}>
          {suggestion.kind === "revise" ? "REVISION IDEA" : "CONTINUATION IDEA"}
        </Text>
      </View>
      <Text style={styles.suggestion}>{suggestion.suggestion}</Text>
      <View style={styles.previewBox}>
        <Text style={styles.previewLabel}>
          {previewLines.length > 1 ? "THE CHANGED LINES" : "A POSSIBLE LINE"}
        </Text>
        <Text style={styles.previewText}>{previewLines.join("\n")}</Text>
      </View>
      {stale && !applied ? (
        <Text style={styles.cardStale}>Made for an earlier version · refresh to build on your latest lines</Text>
      ) : null}
      {justApplied ? (
        <Animated.View
          style={[
            styles.appliedPulse,
            {
              opacity: pulse,
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1]
                  })
                }
              ]
            }
          ]}
        >
          <Text style={styles.appliedPulseText}>✓ Applied to your lines</Text>
        </Animated.View>
      ) : null}
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
          accessibilityLabel={
            applied
              ? "Undo this suggestion's changes"
              : "Apply this suggestion to the poem lines"
          }
          accessibilityRole="button"
          disabled={disabled}
          onPress={onAction}
          style={[
            styles.applyButton,
            applied && styles.undoButton,
            disabled && styles.applyButtonDisabled
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={applied ? styles.undoText : styles.applyGlyph}>
              {applied ? "Undo" : "✓"}
            </Text>
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
  cardApplied: { borderColor: "#D8B66A", shadowOpacity: 0.1 },
  cardTopline: { flexDirection: "row", alignItems: "center" },
  cardNumber: { color: colors.ink, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  kindLabel: { marginLeft: 9, color: colors.profileMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  suggestion: { marginTop: 13, color: colors.ink, fontFamily: "Georgia", fontSize: 18, lineHeight: 25 },
  previewBox: { marginTop: 13, paddingLeft: 11, borderLeftWidth: 2, borderLeftColor: "#D8B66A" },
  previewLabel: { color: colors.profileMuted, fontSize: 9, letterSpacing: 0.7, textTransform: "uppercase" },
  previewText: { marginTop: 4, color: colors.inkSoft, fontFamily: "Georgia", fontSize: 14, lineHeight: 20 },
  cardStale: { marginTop: 10, color: colors.profileMuted, fontSize: 10, lineHeight: 14 },
  appliedPulse: { alignSelf: "flex-start", marginTop: 11, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "#FFF2CB" },
  appliedPulseText: { color: "#8D6A1C", fontSize: 10, fontWeight: "700" },
  cardFooter: { flex: 1, minHeight: 54, marginTop: 15, flexDirection: "row", alignItems: "flex-end" },
  source: { flex: 1, minWidth: 0, paddingRight: 10, flexDirection: "row", alignItems: "center" },
  sourceCopy: { flex: 1, minWidth: 0, marginLeft: 7 },
  sourceBy: { color: colors.profileMuted, fontSize: 9, fontWeight: "600" },
  sourceExcerpt: { marginTop: 2, color: colors.tabMuted, fontSize: 10, lineHeight: 14 },
  poemSource: { flex: 1, paddingRight: 10, color: colors.tabMuted, fontSize: 10, fontStyle: "italic" },
  applyButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  undoButton: { width: 58, paddingHorizontal: 8 },
  applyButtonDisabled: { opacity: 0.42 },
  applyGlyph: { color: colors.white, fontSize: 18, fontWeight: "700" },
  undoText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  moreCard: { minHeight: 248, borderRadius: 17, borderWidth: 1, borderStyle: "dashed", borderColor: colors.faint, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  moreGlyph: { color: colors.ink, fontSize: 25, fontWeight: "300" },
  moreTitle: { marginTop: 9, color: colors.ink, fontSize: 15, fontWeight: "600" },
  moreBody: { marginTop: 6, color: colors.profileMuted, fontSize: 11, lineHeight: 16, textAlign: "center" },
  pagination: { height: 28, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.faint },
  dotActive: { width: 16, backgroundColor: colors.ink },
  inlineError: { paddingHorizontal: 16, paddingBottom: 12, color: colors.accentWarm, fontSize: 11, textAlign: "center" }
});
