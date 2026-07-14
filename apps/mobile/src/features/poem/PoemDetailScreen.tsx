import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  Avatar,
  CommentIcon,
  EmptyState,
  PoemEngagementBar,
  SearchIcon
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemComment, PoemCreditPerson, PoemSummary } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { usePoemEngagement } from "./usePoemEngagement";

declare const require: (path: string) => ImageSourcePropType;

const waterArtwork = require("../../../assets/preview-water.png");
const detailBackground = "#F6F7F7";
const figmaAccent = "#FF0038";

type PoemDetailScreenProps = {
  id?: string;
};

export function PoemDetailScreen({ id }: PoemDetailScreenProps) {
  const [creditsOpen, setCreditsOpen] = useState(false);
  const engagement = usePoemEngagement();
  const poemQuery = useQuery({
    queryKey: ["poem", id, currentUserId],
    enabled: Boolean(id),
    queryFn: () => lineSpaceApi.getPoem(id!, currentUserId)
  });

  const poem = poemQuery.data ?? undefined;

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
          <PoemDetailContent poem={poem} />
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
            poem={poem}
          />
        </>
      ) : null}
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
        <Avatar
          color={avatarColor ?? colors.accent}
          imageSource={poem?.author.avatarUrl ? { uri: poem.author.avatarUrl } : undefined}
          label={poem?.author.displayName ?? "LineSpace"}
          size={34}
        />
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

function PoemDetailContent({ poem }: { poem: PoemSummary }) {
  return (
    <View>
      <HeroArtwork poem={poem} />
      <View style={styles.poemPanel}>
        <View style={styles.titleRow}>
          <Text style={styles.bulbEmoji}>💡</Text>
          <Text style={styles.poemTitle}>{poem.title}</Text>
        </View>

        <View style={styles.lineStack}>
          {poem.lines.map((line) => (
            <Text key={line} style={styles.poemLine}>
              {line}
            </Text>
          ))}
        </View>

        <Text style={styles.tags}>{poem.tags.map((tag) => `#${tag}`).join("  |  ")}</Text>

        <View style={styles.divider} />

        <View style={styles.statusBlock}>
          <Text style={styles.statusTitle}>
            🌱{poem.status === "growing" ? "Poem Growing" : "Final Poem"}
          </Text>
          <Text style={styles.statusDate}>started from {formatPoemDate(poem.startedAt)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.commentSummary}>
          <Text style={styles.commentCount}>{poem.metrics.comments} comments</Text>
          <Text style={styles.commentSort}>newst</Text>
        </View>

        <View style={styles.commentInput}>
          <CommentIcon color="#9B9B9B" height={23} width={23} />
          <Text style={styles.commentPlaceholder}>Comment a line...</Text>
        </View>

        <View style={styles.commentList}>
          {(poem.comments ?? []).map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))}
        </View>
      </View>
    </View>
  );
}

function HeroArtwork({ poem }: { poem: PoemSummary }) {
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

function CommentRow({ comment }: { comment: PoemComment }) {
  const avatarColor = comment.author.handle === "lili" ? figmaAccent : comment.author.avatarColor;

  return (
    <View style={styles.commentRow}>
      <Avatar
        color={avatarColor}
        imageSource={comment.author.avatarUrl ? { uri: comment.author.avatarUrl } : undefined}
        label={comment.author.displayName}
        size={30}
      />
      <View style={styles.commentBody}>
        <View style={styles.commentNameRow}>
          <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
          {comment.badgeLabel ? (
            <View
              style={[
                styles.commentBadge,
                comment.badgeTone === "warm" && styles.commentBadgeWarm
              ]}
            >
              <Text style={styles.commentBadgeText}>{comment.badgeLabel}</Text>
            </View>
          ) : null}
          {comment.annotation ? (
            <Text numberOfLines={1} style={styles.commentAnnotation}>
              {comment.annotation}
            </Text>
          ) : null}
        </View>
        <Text style={styles.commentDate}>{comment.dateLabel}</Text>
        <Text style={styles.commentText}>{comment.body}</Text>
      </View>
    </View>
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
  onSavePress
}: {
  poem: PoemSummary;
  disabled: boolean;
  onLikePress: (isLiked: boolean) => void;
  onSavePress: (isSaved: boolean) => void;
}) {
  return (
    <View style={styles.metricDock}>
      <PoemEngagementBar
        disabled={disabled}
        liked={poem.viewer.liked}
        metrics={poem.metrics}
        onLikePress={() => onLikePress(!poem.viewer.liked)}
        onSavePress={() => onSavePress(!poem.viewer.saved)}
        saved={poem.viewer.saved}
        variant="dock"
      />
    </View>
  );
}

function SearchButton() {
  return (
    <Pressable accessibilityRole="button" style={styles.searchButton}>
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
    backgroundColor: detailBackground
  },
  screen: {
    flex: 1,
    backgroundColor: detailBackground
  },
  header: {
    height: 100,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 25,
    paddingRight: 20,
    paddingTop: 30
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  backButton: {
    width: 24,
    height: 44,
    justifyContent: "flex-start",
    marginRight: 4
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
    fontSize: 20,
    lineHeight: 24,
    color: colors.ink,
    fontWeight: "400"
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
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  scroll: {
    flex: 1,
    backgroundColor: detailBackground
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
    height: 197,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 29
  },
  bulbEmoji: {
    fontSize: 28,
    lineHeight: 32
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
  tags: {
    fontSize: 20,
    lineHeight: 24,
    color: "#949494",
    fontWeight: "400",
    marginBottom: 10
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D9D9D9"
  },
  statusBlock: {
    paddingTop: 8,
    paddingBottom: 9
  },
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
    fontSize: 6,
    lineHeight: 8,
    color: colors.white,
    fontWeight: "400"
  },
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
  }
});
