import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import { colors, radius } from "@linespace/tokens";
import { Avatar } from "./Avatar";
import { PoemArtwork, type ArtworkTone } from "./PoemArtwork";
import { PoemEngagementBar } from "./PoemEngagementBar";
import { PoemLayoutCard } from "./PoemLayoutCard";
import { ContentTagRow } from "./ContentTag";
import { VersionPostLayoutCard, type VersionPostLineModel } from "./VersionPostLayoutCard";

export type PoemCardModel = {
  id: string;
  title: string;
  lines: string[];
  author: {
    id: string;
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
  layout?: {
    backgroundRole: "ruled" | "kraft" | "postcard" | "dark";
    typographyRole: "serif" | "script" | "sans";
    stickerSymbols: string[];
    mediaSource?: ImageSourcePropType;
    mediaAspectRatio?: number;
  };
  versionLines?: VersionPostLineModel[];
};

type PoemCardProps = {
  poem: PoemCardModel;
  interactionsDisabled?: boolean;
  onPress?: (id: string) => void;
  onAuthorPress?: (userId: string) => void;
  onCommentPress?: (id: string) => void;
  onContributionPress?: (id: string) => void;
  onLikePress?: (id: string, isLiked: boolean) => void;
  onSavePress?: (id: string, isSaved: boolean) => void;
  onTagPress?: (tag: string) => void;
};

export function PoemCard({
  poem,
  interactionsDisabled,
  onPress,
  onAuthorPress,
  onCommentPress,
  onContributionPress,
  onLikePress,
  onSavePress,
  onTagPress
}: PoemCardProps) {
  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => onPress?.(poem.id)}
        style={styles.contentPressable}
      >
        <View style={styles.authorRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onAuthorPress?.(poem.author.id)}
            style={styles.authorIdentity}
          >
            <Avatar
              color={poem.author.avatarColor}
              imageSource={
                poem.author.avatarUrl ? { uri: poem.author.avatarUrl } : undefined
              }
              label={poem.author.displayName}
              size={32}
            />
            <View style={styles.authorCopy}>
              <Text numberOfLines={1} style={styles.authorName}>
                {poem.author.displayName}
              </Text>
              <Text numberOfLines={1} style={styles.authorHandle}>
                @{poem.author.handle}
              </Text>
            </View>
          </Pressable>
          <Text numberOfLines={1} style={styles.contributors}>
            {poem.contributorsCount > 1
              ? `${poem.contributorsCount} contributors`
              : "original post"}
          </Text>
        </View>

        {poem.versionLines?.length ? (
          <VersionPostLayoutCard
            backgroundRole={poem.layout?.backgroundRole}
            lines={poem.versionLines}
            mediaSource={poem.layout?.mediaSource}
            onTagPress={onTagPress}
            publishedBy={poem.author.displayName}
            style={styles.layoutCard}
            tags={poem.tags}
            title={poem.title}
          />
        ) : poem.layout ? (
          <PoemLayoutCard
            backgroundRole={poem.layout.backgroundRole}
            mediaAspectRatio={poem.layout.mediaAspectRatio}
            mediaSource={poem.layout.mediaSource}
            onTagPress={onTagPress}
            poem={{
              title: poem.title,
              lines: poem.lines,
              tags: poem.tags,
              byline: poem.author.displayName,
              startedAtLabel: poem.startedAtLabel
            }}
            stickerSymbols={poem.layout.stickerSymbols}
            style={styles.layoutCard}
            typographyRole={poem.layout.typographyRole}
          />
        ) : (
          <>
            <View style={styles.artworkWrap}>
              <PoemArtwork
                imageSource={poem.artworkSource}
                tone={poem.artworkTone}
              />
            </View>

            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.titleMark}>✦</Text>
                <Text style={styles.title}>{poem.title}</Text>
              </View>

              <View style={styles.lines}>
                {poem.lines.map((line, index) => (
                  <Text key={`${line}-${index}`} style={styles.poemLine}>
                    {line}
                  </Text>
                ))}
              </View>

              <View style={styles.tagRow}>
                <ContentTagRow onTagPress={onTagPress} tags={poem.tags} />
              </View>

              <Text style={styles.startedMeta}>
                started {poem.startedAtLabel}
              </Text>
            </View>
          </>
        )}
      </Pressable>

      <PoemEngagementBar
        disabled={interactionsDisabled}
        liked={poem.viewer?.liked}
        metrics={poem.metrics}
        onCommentPress={
          onCommentPress ? () => onCommentPress(poem.id) : undefined
        }
        onContributionPress={
          onContributionPress
            ? () => onContributionPress(poem.id)
            : undefined
        }
        onLikePress={
          onLikePress
            ? () => onLikePress(poem.id, !(poem.viewer?.liked ?? false))
            : undefined
        }
        onSavePress={
          onSavePress
            ? () => onSavePress(poem.id, !(poem.viewer?.saved ?? false))
            : undefined
        }
        saved={poem.viewer?.saved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
    backgroundColor: colors.surface
  },
  contentPressable: {
    borderRadius: radius.lg
  },
  authorRow: {
    minHeight: 56,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  authorIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  authorCopy: {
    flex: 1,
    minWidth: 0
  },
  authorName: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.ink
  },
  authorHandle: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: colors.profileMuted
  },
  contributors: {
    maxWidth: "42%",
    marginLeft: 10,
    fontSize: 12,
    lineHeight: 16,
    color: colors.profileMuted
  },
  layoutCard: {
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(21,21,21,0.10)",
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3
  },
  artworkWrap: {
    overflow: "hidden",
    borderRadius: radius.lg
  },
  body: {
    minHeight: 260,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  titleRow: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  titleMark: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.profileMuted
  },
  title: {
    flex: 1,
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "500",
    color: colors.ink
  },
  lines: {
    marginBottom: 24,
    gap: 10
  },
  poemLine: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 27,
    color: colors.ink
  },
  tagRow: {
    marginBottom: 11,
    minHeight: 22
  },
  startedMeta: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted
  }
});
