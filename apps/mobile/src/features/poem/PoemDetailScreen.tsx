import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  Avatar,
  CommentIcon,
  ContentTagRow,
  EmptyState,
  PoemEngagementBar,
  PoemLayoutCard,
  SearchIcon
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemComment, PoemCreditPerson, PoemSummary } from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { getPoemLayoutPresentation } from "./poemPresentation";
import { usePoemEngagement } from "./usePoemEngagement";

declare const require: (path: string) => ImageSourcePropType;

const waterArtwork = require("../../../assets/preview-water.png");
const figmaAccent = "#FF0038";

type PoemDetailScreenProps = {
  commentId?: string;
  id?: string;
  targetKind?: "post" | "comment";
};

export function PoemDetailScreen({ commentId, id, targetKind }: PoemDetailScreenProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<PoemComment | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const engagement = usePoemEngagement();
  const poemQuery = useQuery({
    queryKey: ["poem", id, currentUserId],
    enabled: Boolean(id) && currentUserId.length > 0,
    queryFn: () => lineSpaceApi.getPoem(id!, currentUserId)
  });

  const poem = poemQuery.data ?? undefined;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const updatePoemCache = (next: PoemSummary) => {
    queryClient.setQueryData(["poem", id, currentUserId], next);
  };

  const submitComment = async () => {
    const body = commentDraft.trim();
    if (!body || !id || commentBusy) return;
    setCommentBusy(true);
    try {
      await lineSpaceApi.createPoemComment({ poemId: id, userId: currentUserId, body, parentCommentId: replyTarget?.id });
      const next = await lineSpaceApi.getPoem(id, currentUserId);
      if (next) updatePoemCache(next);
      setCommentDraft("");
      setReplyTarget(null);
      setCommentComposerOpen(false);
      setNotice("Comment posted");
      void queryClient.invalidateQueries({ queryKey: ["user-profile", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
    } catch {
      setNotice("Could not post comment");
    } finally {
      setCommentBusy(false);
    }
  };

  const updateCommentCollection = async (comment: PoemComment, collection: "liked" | "saved", isActive: boolean) => {
    if (!id) return;
    try {
      const result = await lineSpaceApi.setCommentCollection({ poemId: id, commentId: comment.id, userId: currentUserId, collection, isActive });
      updatePoemCache(result.poem);
      void queryClient.invalidateQueries({ queryKey: ["user-profile", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile", comment.author.id] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-summary"] });
      if (collection === "saved" && isActive) setNotice("Comment saved to your profile");
    } catch {
      setNotice("Could not update comment");
    }
  };

  return (
    <AppScreen
      scroll={false}
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <DetailHeader poem={poem} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {poemQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : poemQuery.isError || !poem ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="Poem not found"
              body="The detail route is ready for poem records returned by id."
            />
          </View>
        ) : (
          <PoemDetailContent
            commentId={commentId}
            onCommentPress={() => { setReplyTarget(null); setCommentComposerOpen(true); }}
            onCommentSave={(comment) => updateCommentCollection(comment, "saved", !(comment.viewer?.saved ?? false))}
            onCommentLike={(comment) => updateCommentCollection(comment, "liked", !(comment.viewer?.liked ?? false))}
            onReplyPress={(comment) => { setReplyTarget(comment); setCommentComposerOpen(true); }}
            poem={poem}
            targetKind={targetKind}
          />
        )}
      </ScrollView>

      {poem ? (
        <>
          <CreditsPanel
            credits={getCredits(poem)}
            contributorsCount={poem.contributorsCount}
            isOpen={creditsOpen}
            onToggle={() => setCreditsOpen((value) => !value)}
          />
          <MetricDock
            onLikePress={(isLiked) =>
              engagement.setCollection(poem.id, "liked", isLiked)
            }
            onSavePress={(isSaved) =>
              engagement.setCollection(poem.id, "saved", isSaved)
            }
            disabled={engagement.isPending}
            onSharePress={() => router.push({ pathname: "/poem/share/[id]", params: { id: poem.id } } as never)}
            poem={poem}
          />
        </>
      ) : null}
      <CommentComposer
        busy={commentBusy}
        draft={commentDraft}
        onChange={setCommentDraft}
        onClose={() => { setCommentComposerOpen(false); setReplyTarget(null); }}
        onSubmit={submitComment}
        replyTarget={replyTarget}
        visible={commentComposerOpen}
      />
      {notice ? <View pointerEvents="none" style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
    </AppScreen>
  );
}

function DetailHeader({ poem }: { poem?: PoemSummary }) {
  const avatarColor = poem?.author.handle === "lili" ? figmaAccent : poem?.author.avatarColor;

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeftIcon />
        </Pressable>
        <Pressable disabled={!poem} onPress={() => poem && router.push({ pathname: "/profile/[id]", params: { id: poem.author.id } } as never)}>
          <Avatar
            color={avatarColor ?? colors.accent}
            imageSource={poem?.author.avatarUrl ? { uri: poem.author.avatarUrl } : undefined}
            label={poem?.author.displayName ?? "LineSpace"}
            size={34}
          />
        </Pressable>
        <Text style={styles.headerName}>{poem?.author.displayName.toLowerCase() ?? "line"}</Text>
      </View>

      <View style={styles.headerRight}>
        <Pressable accessibilityRole="button" style={styles.followButton}>
          <Text style={styles.followText}>+ follow</Text>
        </Pressable>
        <SearchButton />
      </View>
    </View>
  );
}

function PoemDetailContent({
  commentId,
  poem,
  targetKind,
  onCommentPress,
  onReplyPress,
  onCommentLike,
  onCommentSave
}: {
  commentId?: string;
  poem: PoemSummary;
  targetKind?: "post" | "comment";
  onCommentPress: () => void;
  onReplyPress: (comment: PoemComment) => void;
  onCommentLike: (comment: PoemComment) => void;
  onCommentSave: (comment: PoemComment) => void;
}) {
  const layoutPresentation = getPoemLayoutPresentation(poem);

  return (
    <View>
      {layoutPresentation ? (
        <PoemLayoutCard
          backgroundRole={layoutPresentation.backgroundRole}
          mediaAspectRatio={layoutPresentation.mediaAspectRatio}
          mediaSource={layoutPresentation.mediaSource}
          onTagPress={(tag) => router.push({ pathname: "/tags/[tag]", params: { tag, section: "posts" } } as never)}
          poem={{
            title: poem.title,
            lines: poem.lines,
            tags: poem.tags,
            byline: poem.author.displayName,
            startedAtLabel: formatPoemDate(poem.startedAt)
          }}
          stickerSymbols={layoutPresentation.stickerSymbols}
          style={[
            styles.detailLayoutCard,
            targetKind === "post" && styles.targetLayoutHighlight
          ]}
          typographyRole={layoutPresentation.typographyRole}
        />
      ) : (
        <HeroArtwork poem={poem} />
      )}
      <View
        style={[
          styles.poemPanel,
          layoutPresentation && styles.designedConversation,
          targetKind === "post" && styles.targetHighlight
        ]}
      >
        {!layoutPresentation ? (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.titleMark}>✦</Text>
              <Text style={styles.poemTitle}>{poem.title}</Text>
            </View>

            <View style={styles.lineStack}>
              {poem.lines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.poemLine}>
                  {line}
                </Text>
              ))}
            </View>

            <View style={styles.tagRow}>
              <ContentTagRow
                onTagPress={(tag) => router.push({ pathname: "/tags/[tag]", params: { tag, section: "posts" } } as never)}
                tags={poem.tags}
              />
            </View>
          </>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.postMeta}>
          <Text style={styles.postMetaTitle}>started by @{poem.author.handle}</Text>
          <Text style={styles.postMetaDate}>started {formatPoemDate(poem.startedAt)} · edited {formatPoemDate(poem.editedAt ?? poem.startedAt)}</Text>
        </View>

        <View style={styles.statusBlockDeprecated}>
          <Text style={styles.statusTitle}>
            🌱{poem.status === "growing" ? "Poem Growing" : "Final Poem"}
          </Text>
          <Text style={styles.statusDate}>started from {formatPoemDate(poem.startedAt)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.commentSummary}>
          <Text style={styles.commentCount}>{poem.metrics.comments} comments</Text>
          <Text style={styles.commentSort}>newest</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={onCommentPress} style={styles.commentInput}>
          <CommentIcon color="#9B9B9B" height={23} width={23} />
          <Text style={styles.commentPlaceholder}>Add a thoughtful comment…</Text>
        </Pressable>

        <View style={styles.commentList}>
          {(poem.comments ?? []).map((comment) => (
            <CommentRow
              highlighted={targetKind === "comment" && comment.id === commentId}
              key={comment.id}
              comment={comment}
              onLike={() => onCommentLike(comment)}
              onLongPress={() => onCommentSave(comment)}
              onReply={() => onReplyPress(comment)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function HeroArtwork({ poem }: { poem: PoemSummary }) {
  if (poem.artworkUrl) {
    return <Image source={{ uri: poem.artworkUrl }} resizeMode="cover" style={styles.heroImage} />;
  }
  if (poem.artworkTone === "water") {
    return <Image source={waterArtwork} resizeMode="cover" style={styles.heroImage} />;
  }

  return (
    <View style={[styles.heroImage, styles.heroFallback, fallbackPalette[poem.artworkTone].root]}>
      <View style={[styles.heroBand, styles.heroBandOne, fallbackPalette[poem.artworkTone].bandOne]} />
      <View style={[styles.heroBand, styles.heroBandTwo, fallbackPalette[poem.artworkTone].bandTwo]} />
      <View style={[styles.heroBand, styles.heroBandThree, fallbackPalette[poem.artworkTone].bandThree]} />
    </View>
  );
}

function CommentComposer({ visible, draft, replyTarget, busy, onChange, onClose, onSubmit }: { visible: boolean; draft: string; replyTarget: PoemComment | null; busy: boolean; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.composerRoot}><Pressable accessibilityLabel="Close comment composer" onPress={onClose} style={styles.composerBackdrop} /><View style={styles.composerSheet}><View style={styles.composerHandle} /><View style={styles.composerHeader}><View><Text style={styles.composerEyebrow}>{replyTarget ? "REPLYING TO" : "NEW COMMENT"}</Text><Text numberOfLines={1} style={styles.composerTitle}>{replyTarget ? `@${replyTarget.author.handle}` : "Add your voice"}</Text></View><Pressable accessibilityRole="button" disabled={busy} onPress={onSubmit} style={styles.composerSend}><Text style={styles.composerSendText}>{busy ? "…" : "Post"}</Text></Pressable></View><TextInput autoFocus multiline onChangeText={onChange} placeholder={replyTarget ? "Write a thoughtful reply…" : "Write a thoughtful comment…"} placeholderTextColor={colors.profileMuted} style={styles.composerInput} textAlignVertical="top" value={draft} /><Text style={styles.composerHint}>Long press any comment to save it to your profile.</Text></View></KeyboardAvoidingView></Modal>;
}

function CommentRow({
  comment,
  highlighted,
  onReply,
  onLike,
  onLongPress
}: {
  comment: PoemComment;
  highlighted?: boolean;
  onReply: () => void;
  onLike: () => void;
  onLongPress: () => void;
}) {
  const avatarColor = comment.author.handle === "lili" ? figmaAccent : comment.author.avatarColor;

  return (
    <Pressable onLongPress={onLongPress} onPress={onReply} style={[styles.commentRow, highlighted && styles.targetHighlight, comment.parentCommentId && styles.replyRow]}>
      <Pressable onPress={(event) => { event.stopPropagation(); router.push({ pathname: "/profile/[id]", params: { id: comment.author.id } } as never); }}>
        <Avatar
          color={avatarColor}
          imageSource={comment.author.avatarUrl ? { uri: comment.author.avatarUrl } : undefined}
          label={comment.author.displayName}
          size={30}
        />
      </Pressable>
      <View style={styles.commentBody}>
        <View style={styles.commentNameRow}>
          <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
          {comment.level ? <Text style={styles.commentLevel}>level.{comment.level}</Text> : null}
          {comment.badgeLabel ? <Text style={styles.commentBadgeText}>{comment.badgeLabel}</Text> : null}
        </View>
        <Text style={styles.commentDate}>{comment.dateLabel} · tap to reply</Text>
        <Text style={styles.commentText}>{comment.body}</Text>
        <View style={styles.commentActions}>
          <Text style={styles.replyLabel}>Reply</Text>
          <Pressable accessibilityLabel={comment.viewer?.liked ? "Unlike comment" : "Like comment"} onPress={(event) => { event.stopPropagation(); onLike(); }} style={styles.commentActionButton}>
            <Text style={[styles.heart, comment.viewer?.liked && styles.heartActive]}>{comment.viewer?.liked ? "♥" : "♡"}</Text>
            <Text style={styles.commentLikeCount}>{comment.likes ?? 0}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function CreditsPanel({
  credits,
  contributorsCount,
  isOpen,
  onToggle
}: {
  credits: NonNullable<PoemSummary["credits"]>;
  contributorsCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.creditsPanel, isOpen && styles.creditsPanelOpen]}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.creditsSummary}>
        <Text style={styles.creditsSummaryText}>By @{credits.startedBy.handle}</Text>
        <Text style={styles.creditsDividerText}>|</Text>
        <Text style={styles.creditsSummaryText}>with {contributorsCount} contributors</Text>
        <View style={styles.creditsSpacer} />
        <Text style={styles.creditsSummaryText}>Credits</Text>
        <ChevronDownIcon open={isOpen} />
      </Pressable>

      {isOpen ? (
        <View style={styles.creditsDetail}>
          <View style={styles.creditsLine} />
          <Text style={styles.creditsMutedTitle}>Started by person</Text>
          <View style={styles.creditsLine} />
          <CreditPerson person={credits.startedBy} />
          <View style={styles.creditsLine} />
          <Text style={styles.creditsMutedTitle}>Contributed by</Text>
          <View style={styles.creditsLine} />

          <View style={styles.creditsColumns}>
            <View style={styles.creditsColumn}>
              <Text style={styles.creditsColumnTitle}>comments</Text>
              {credits.commentContributors.map((person) => (
                <CreditPerson key={person.handle} person={person} compact />
              ))}
            </View>
            <View style={styles.creditsColumnDivider} />
            <View style={styles.creditsColumn}>
              <Text style={styles.creditsColumnTitle}>quotes</Text>
              {credits.quoteContributors.map((person) => (
                <CreditPerson key={person.handle} person={person} compact />
              ))}
            </View>
          </View>
          <View style={styles.creditsLine} />
        </View>
      ) : null}
    </View>
  );
}

function CreditPerson({
  person,
  compact = false
}: {
  person: PoemCreditPerson;
  compact?: boolean;
}) {
  return (
    <View style={[styles.creditPerson, compact && styles.creditPersonCompact]}>
      <Avatar
        color={person.avatarColor}
        imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined}
        label={person.displayName}
        size={compact ? 22 : 28}
      />
      <Text style={styles.creditHandle}>@{person.handle}</Text>
    </View>
  );
}

function MetricDock({
  poem,
  disabled,
  onLikePress,
  onSavePress,
  onSharePress
}: {
  poem: PoemSummary;
  disabled: boolean;
  onLikePress: (isLiked: boolean) => void;
  onSavePress: (isSaved: boolean) => void;
  onSharePress: () => void;
}) {
  return (
    <View style={styles.metricDock}>
      <PoemEngagementBar
        disabled={disabled}
        liked={poem.viewer.liked}
        metrics={{ ...poem.metrics, contributions: poem.metrics.shares ?? poem.metrics.contributions }}
        onLikePress={() => onLikePress(!poem.viewer.liked)}
        onContributionPress={onSharePress}
        onSavePress={() => onSavePress(!poem.viewer.saved)}
        saved={poem.viewer.saved}
        variant="dock"
      />
    </View>
  );
}

function SearchButton() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push("/search" as never)} style={styles.searchButton}>
      <SearchIcon width={26} height={26} />
    </Pressable>
  );
}

function ChevronLeftIcon() {
  return (
    <View style={styles.chevronLeft}>
      <View style={[styles.chevronStroke, styles.chevronStrokeTop]} />
      <View style={[styles.chevronStroke, styles.chevronStrokeBottom]} />
    </View>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <View style={styles.chevronDown}>
      <View
        style={[
          styles.chevronDownStroke,
          styles.chevronDownLeft,
          open && styles.chevronUpLeft
        ]}
      />
      <View
        style={[
          styles.chevronDownStroke,
          styles.chevronDownRight,
          open && styles.chevronUpRight
        ]}
      />
    </View>
  );
}

function getCredits(poem: PoemSummary): NonNullable<PoemSummary["credits"]> {
  return (
    poem.credits ?? {
      startedBy: {
        handle: poem.author.handle.toUpperCase(),
        displayName: poem.author.displayName,
        avatarColor: poem.author.avatarColor,
        avatarUrl: poem.author.avatarUrl
      },
      commentContributors: [],
      quoteContributors: []
    }
  );
}

function formatPoemDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();

  return `${year}/${month}/${day} ${weekday}.`;
}

const fallbackPalette = {
  paper: {
    root: { backgroundColor: "#E8D6B7" },
    bandOne: { backgroundColor: "#F3ECE0" },
    bandTwo: { backgroundColor: "#B89E75" },
    bandThree: { backgroundColor: "#F8F5EF" }
  },
  night: {
    root: { backgroundColor: "#171A2F" },
    bandOne: { backgroundColor: "#293C66" },
    bandTwo: { backgroundColor: "#6E80A7" },
    bandThree: { backgroundColor: "#D8D8E5" }
  }
} as const;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface
  },
  screen: {
    flex: 1,
    backgroundColor: colors.surface
  },
  header: {
    minHeight: 78,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 30,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  backButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2
  },
  chevronLeft: {
    width: 18,
    height: 24
  },
  chevronStroke: {
    position: "absolute",
    left: 6,
    width: 17,
    height: 2.2,
    borderRadius: 2,
    backgroundColor: colors.ink
  },
  chevronStrokeTop: {
    top: 6,
    transform: [{ rotate: "-45deg" }]
  },
  chevronStrokeBottom: {
    bottom: 5,
    transform: [{ rotate: "45deg" }]
  },
  headerAvatar: {
    width: 29,
    height: 29,
    borderRadius: 15,
    marginLeft: 6,
    marginRight: 8
  },
  headerName: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    fontWeight: "600"
  },
  followButton: {
    height: 24,
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  followText: {
    fontSize: 15,
    lineHeight: 18,
    color: colors.white,
    fontWeight: "400"
  },
  searchButton: {
    width: 40,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.surface
  },
  scrollContent: {
    paddingBottom: 330
  },
  loadingWrap: {
    paddingTop: spacing.xxxl
  },
  emptyWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl
  },
  heroImage: {
    width: "100%",
    height: 206,
    backgroundColor: colors.surfaceMuted
  },
  heroFallback: {
    overflow: "hidden"
  },
  heroBand: {
    position: "absolute",
    left: -36,
    right: -36,
    height: 68,
    opacity: 0.82,
    transform: [{ rotate: "-10deg" }]
  },
  heroBandOne: {
    top: 18
  },
  heroBandTwo: {
    top: 82
  },
  heroBandThree: {
    top: 140
  },
  poemPanel: {
    minHeight: 720,
    backgroundColor: colors.surface,
    paddingHorizontal: 25,
    paddingTop: 19,
    paddingBottom: 32
  },
  designedConversation: {
    minHeight: 460,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  detailLayoutCard: {
    marginHorizontal: spacing.lg,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(21,21,21,0.12)",
    shadowColor: colors.black,
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  targetLayoutHighlight: {
    borderColor: "#F2C94C",
    borderWidth: 1
  },
  targetHighlight: {
    backgroundColor: "#FFF7D7",
    borderColor: "#F2C94C",
    borderWidth: 1,
    borderRadius: 8
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 29
  },
  titleMark: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.profileMuted
  },
  poemTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontStyle: "italic",
    color: colors.ink,
    fontWeight: "400"
  },
  lineStack: {
    gap: 17,
    marginBottom: 39
  },
  poemLine: {
    fontSize: 20,
    lineHeight: 22,
    fontStyle: "italic",
    color: colors.ink,
    fontWeight: "400"
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D9D9D9"
  },
  statusBlock: {
    paddingTop: 8,
    paddingBottom: 9
  },
  statusBlockDeprecated: { display: "none" },
  postMeta: { paddingTop: 8, paddingBottom: 9 },
  postMetaTitle: { fontSize: 16, lineHeight: 20, color: colors.ink, fontWeight: "500" },
  postMetaDate: { marginTop: 2, color: "#949494", fontSize: 14, lineHeight: 19 },
  statusTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
    fontStyle: "italic",
    fontWeight: "400"
  },
  statusDate: {
    fontSize: 15,
    lineHeight: 21,
    color: "#949494",
    fontStyle: "italic",
    fontWeight: "400",
    marginTop: 1
  },
  commentSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 15,
    marginBottom: 15
  },
  commentCount: {
    fontSize: 15,
    lineHeight: 18,
    color: colors.ink,
    fontWeight: "400"
  },
  commentSort: {
    fontSize: 13,
    lineHeight: 16,
    color: colors.ink,
    fontWeight: "400"
  },
  commentInput: {
    height: 43,
    borderRadius: radius.pill,
    backgroundColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 18
  },
  commentPlaceholder: {
    fontSize: 15,
    lineHeight: 18,
    color: "#B8B8B8",
    fontWeight: "400"
  },
  commentList: {
    paddingTop: 2
  },
  commentRow: {
    flexDirection: "row",
    paddingTop: 11,
    paddingBottom: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E1E1E1"
  },
  replyRow: { marginLeft: 28, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.line },
  commentAvatar: {
    width: 29,
    height: 29,
    borderRadius: 15,
    marginRight: 14,
    marginTop: 1
  },
  commentBody: {
    flex: 1,
    minWidth: 0
  },
  commentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20
  },
  commentAuthor: {
    fontSize: 17,
    lineHeight: 20,
    color: colors.ink,
    fontWeight: "400",
    marginRight: 4
  },
  commentLevel: { marginLeft: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.black, color: colors.white, fontSize: 9, lineHeight: 12 },
  commentBadge: {
    height: 10,
    borderRadius: 3,
    backgroundColor: "#626262",
    justifyContent: "center",
    paddingHorizontal: 3,
    marginRight: 4
  },
  commentBadgeWarm: {
    backgroundColor: "#8B6A44"
  },
  commentBadgeText: {
    marginLeft: 6,
    fontSize: 10,
    lineHeight: 14,
    color: colors.profileMuted,
    fontWeight: "400"
  },
  commentActions: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  replyLabel: { color: colors.profileMuted, fontSize: 12 },
  commentActionButton: { minWidth: 45, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  heart: { color: colors.ink, fontSize: 24, lineHeight: 24, fontWeight: "300" },
  heartActive: { color: colors.liked },
  commentLikeCount: { color: colors.profileMuted, fontSize: 11 },
  commentAnnotation: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 15,
    color: "#A2A2A2",
    fontWeight: "400"
  },
  commentDate: {
    fontSize: 12,
    lineHeight: 14,
    color: "#A2A2A2",
    fontWeight: "400"
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
    fontWeight: "400",
    marginTop: 3
  },
  creditsPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 68,
    height: 76,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: colors.black,
    paddingHorizontal: 12,
    zIndex: 20,
    overflow: "hidden"
  },
  creditsPanelOpen: {
    height: 242
  },
  creditsSummary: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 5
  },
  creditsSummaryText: {
    fontSize: 15,
    lineHeight: 18,
    color: colors.white,
    fontWeight: "400"
  },
  creditsDividerText: {
    fontSize: 15,
    lineHeight: 18,
    color: colors.white,
    marginHorizontal: 14
  },
  creditsSpacer: {
    flex: 1
  },
  chevronDown: {
    width: 22,
    height: 18,
    marginLeft: 9
  },
  chevronDownStroke: {
    position: "absolute",
    top: 8,
    width: 12,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.white
  },
  chevronDownLeft: {
    left: 1,
    transform: [{ rotate: "45deg" }]
  },
  chevronDownRight: {
    right: 1,
    transform: [{ rotate: "-45deg" }]
  },
  chevronUpLeft: {
    transform: [{ rotate: "-45deg" }]
  },
  chevronUpRight: {
    transform: [{ rotate: "45deg" }]
  },
  creditsDetail: {
    marginTop: -1
  },
  creditsLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#8D8D8D"
  },
  creditsMutedTitle: {
    fontSize: 15,
    lineHeight: 26,
    color: "#BDBDBD",
    fontStyle: "italic",
    fontWeight: "400"
  },
  creditPerson: {
    height: 34,
    flexDirection: "row",
    alignItems: "center"
  },
  creditPersonCompact: {
    height: 24
  },
  creditDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 5
  },
  creditHandle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
    fontStyle: "italic",
    fontWeight: "400"
  },
  creditsColumns: {
    minHeight: 76,
    flexDirection: "row"
  },
  creditsColumn: {
    flex: 1,
    paddingBottom: 6
  },
  creditsColumnDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#8D8D8D",
    marginRight: 14
  },
  creditsColumnTitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "#BDBDBD",
    fontStyle: "italic",
    fontWeight: "400"
  },
  metricDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 68,
    zIndex: 30
  },
  composerRoot: { flex: 1, justifyContent: "flex-end" },
  composerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  composerSheet: { minHeight: 310, paddingHorizontal: 20, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface },
  composerHandle: { alignSelf: "center", width: 42, height: 4, marginTop: 9, borderRadius: radius.pill, backgroundColor: colors.faint },
  composerHeader: { marginTop: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  composerEyebrow: { color: colors.profileMuted, fontSize: 10, letterSpacing: 1.2 },
  composerTitle: { maxWidth: 240, marginTop: 4, color: colors.ink, fontSize: 20, fontWeight: "500" },
  composerSend: { minWidth: 58, minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  composerSendText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  composerInput: { minHeight: 120, marginTop: 18, padding: 14, borderRadius: 15, backgroundColor: colors.white, color: colors.ink, fontSize: 17, lineHeight: 24 },
  composerHint: { marginTop: 9, color: colors.profileMuted, fontSize: 11 },
  notice: { position: "absolute", left: 22, right: 22, bottom: 86, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center" },
  noticeText: { color: colors.white, fontSize: 13 }
});
