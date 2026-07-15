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
  postedAtLabel: string;
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
          <Text style={styles.timestamp}>{poem.postedAtLabel}</Text>
        </View>

        <View style={styles.cardClip}>
          <PoemArtwork tone={poem.artworkTone} imageSource={poem.artworkSource} />

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
    marginBottom: 24,
    width: "100%",
    maxWidth: 365,
    alignSelf: "center"
  },
  contentPressable: {
    borderRadius: radius.md
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 37,
    paddingHorizontal: 0,
    zIndex: 2
  },
  authorIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  avatarDot: {
    width: 29,
    height: 29,
    borderRadius: 15
  },
  avatarImage: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted
  },
  authorName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "normal"
  },
  timestamp: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "400",
    color: "rgba(0, 0, 0, 0.5)"
  },
  cardClip: {
    overflow: "hidden",
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md
  },
  body: {
    marginTop: -1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 23,
    paddingTop: 16,
    paddingBottom: 25,
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
    marginBottom: 15
  },
  bulbEmoji: {
    fontSize: 24,
    lineHeight: 28
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "italic"
  },
  lines: {
    gap: 18,
    marginBottom: 19
  },
  poemLine: {
    fontSize: 20,
    lineHeight: 23,
    fontWeight: "400",
    color: colors.ink,
    fontStyle: "italic"
  },
  tags: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.profileMuted
  }
});
