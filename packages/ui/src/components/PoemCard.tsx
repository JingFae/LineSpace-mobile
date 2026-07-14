import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { PoemArtwork, type ArtworkTone } from "./PoemArtwork";
import { PoemEngagementBar } from "./PoemEngagementBar";
import { Avatar } from "./Avatar";

export type PoemCardModel = {
  id: string;
  title: string;
  lines: string[];
  author: {
    displayName: string;
    handle: string;
    avatarColor: string;
    avatarUrl?: string;
  };
  contributorsCount: number;
  tags: string[];
  statusLabel: string;
  startedAtLabel: string;
  metrics: {
    comments: number;
    commentThreads?: number;
    likes: number;
    contributions: number;
    contributionLines?: number;
    saves: number;
  };
  viewer?: {
    liked: boolean;
    saved: boolean;
  };
  artworkTone: ArtworkTone;
  artworkSource?: ImageSourcePropType;
};

type PoemCardProps = {
  poem: PoemCardModel;
  interactionsDisabled?: boolean;
  onPress?: (id: string) => void;
  onCommentPress?: (id: string) => void;
  onContributionPress?: (id: string) => void;
  onLikePress?: (id: string, isLiked: boolean) => void;
  onSavePress?: (id: string, isSaved: boolean) => void;
};

export function PoemCard({
  poem,
  interactionsDisabled,
  onPress,
  onCommentPress,
  onContributionPress,
  onLikePress,
  onSavePress
}: PoemCardProps) {
  return (
    <View style={styles.root}>
      <Pressable onPress={() => onPress?.(poem.id)} style={styles.contentPressable}>
        <View style={styles.authorRow}>
          <View style={styles.authorIdentity}>
            <Avatar
              color={poem.author.avatarColor}
              imageSource={poem.author.avatarUrl ? { uri: poem.author.avatarUrl } : undefined}
              label={poem.author.displayName}
              size={39}
            />
            <Text style={styles.authorName}>{poem.author.displayName}</Text>
          </View>
          <Text style={styles.contributors}>with {poem.contributorsCount} contributors</Text>
        </View>

        <View style={styles.dots} pointerEvents="none">
          {Array.from({ length: 13 }).map((_, index) => (
            <View key={index} style={styles.dot} />
          ))}
        </View>

        <View style={styles.artworkWrap}>
          <PoemArtwork tone={poem.artworkTone} imageSource={poem.artworkSource} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.bulbEmoji}>💡</Text>
            <Text style={styles.title}>{poem.title}</Text>
          </View>

          <View style={styles.lines}>
            {poem.lines.map((line) => (
              <Text key={line} style={styles.poemLine}>
                {line}
              </Text>
            ))}
          </View>

          <Text style={styles.tags}>{poem.tags.map((tag) => `#${tag}`).join("  |  ")}</Text>

          <View style={styles.status}>
            <View style={styles.statusTitleRow}>
              <View style={styles.sproutMark} />
              <Text style={styles.statusTitle}>{poem.statusLabel}</Text>
            </View>
            <Text style={styles.statusMeta}>started from {poem.startedAtLabel}</Text>
          </View>
        </View>
      </Pressable>

      <PoemEngagementBar
        disabled={interactionsDisabled}
        liked={poem.viewer?.liked}
        metrics={poem.metrics}
        onCommentPress={onCommentPress ? () => onCommentPress(poem.id) : undefined}
        onContributionPress={
          onContributionPress ? () => onContributionPress(poem.id) : undefined
        }
        onLikePress={
          onLikePress ? () => onLikePress(poem.id, !(poem.viewer?.liked ?? false)) : undefined
        }
        onSavePress={
          onSavePress ? () => onSavePress(poem.id, !(poem.viewer?.saved ?? false)) : undefined
        }
        saved={poem.viewer?.saved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 24
  },
  contentPressable: {
    borderRadius: radius.md
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 45,
    paddingHorizontal: 0,
    zIndex: 2
  },
  authorIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatarDot: {
    width: 39,
    height: 39,
    borderRadius: 20
  },
  authorName: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "italic",
    fontFamily: "Brush Script MT"
  },
  contributors: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: "400",
    color: colors.ink
  },
  dots: {
    position: "absolute",
    top: 32,
    left: 54,
    right: 2,
    zIndex: 3,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#F4F4F4"
  },
  artworkWrap: {
    marginTop: 0
  },
  body: {
    minHeight: 298,
    marginTop: 0,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 23,
    paddingTop: 18,
    paddingBottom: 14,
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 25
  },
  bulbEmoji: {
    fontSize: 28,
    lineHeight: 31
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "italic"
  },
  lines: {
    gap: 16,
    marginBottom: 31
  },
  poemLine: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "italic"
  },
  tags: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "400",
    color: colors.muted,
    marginBottom: 11
  },
  status: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingTop: 8
  },
  statusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  sproutMark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    transform: [{ rotate: "-20deg" }]
  },
  statusTitle: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "italic"
  },
  statusMeta: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: "400",
    color: colors.muted,
    fontStyle: "italic"
  }
});
