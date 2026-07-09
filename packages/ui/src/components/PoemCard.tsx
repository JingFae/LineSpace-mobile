import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { PoemArtwork, type ArtworkTone } from "./PoemArtwork";

export type PoemCardModel = {
  id: string;
  title: string;
  lines: string[];
  author: {
    displayName: string;
    handle: string;
    avatarColor: string;
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
  artworkTone: ArtworkTone;
  artworkSource?: ImageSourcePropType;
};

type PoemCardProps = {
  poem: PoemCardModel;
  onPress?: (id: string) => void;
};

export function PoemCard({ poem, onPress }: PoemCardProps) {
  return (
    <Pressable onPress={() => onPress?.(poem.id)} style={styles.root}>
      <View style={styles.authorRow}>
        <View style={styles.authorIdentity}>
          <View style={[styles.avatarDot, { backgroundColor: poem.author.avatarColor }]} />
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

      <View style={styles.actions}>
        <Metric
          kind="comment"
          primary={formatMetricLead(poem.metrics.commentThreads, poem.metrics.comments)}
          secondary={formatMetricTail(poem.metrics.commentThreads, poem.metrics.comments)}
        />
        <Metric kind="heart" primary={`${poem.metrics.likes}`} />
        <Metric
          kind="contribution"
          primary={formatMetricLead(poem.metrics.contributionLines, poem.metrics.contributions)}
          secondary={formatMetricTail(poem.metrics.contributionLines, poem.metrics.contributions)}
        />
        <Metric kind="save" primary={`${poem.metrics.saves}`} />
      </View>
    </Pressable>
  );
}

function Metric({
  kind,
  primary,
  secondary
}: {
  kind: "comment" | "heart" | "contribution" | "save";
  primary: string;
  secondary?: string;
}) {
  return (
    <View style={styles.metric}>
      <MetricIcon kind={kind} />
      <Text style={styles.metricValue}>
        {primary}
        {secondary ? <Text style={styles.metricSecondary}>/{secondary}</Text> : null}
      </Text>
    </View>
  );
}

function MetricIcon({ kind }: { kind: "comment" | "heart" | "contribution" | "save" }) {
  if (kind === "heart") {
    return <Text style={styles.heartIcon}>♡</Text>;
  }

  if (kind === "save") {
    return (
      <View style={styles.saveIcon}>
        <View style={styles.saveNotch} />
      </View>
    );
  }

  if (kind === "contribution") {
    return (
      <View style={styles.contributionIcon}>
        <View style={styles.arrowStem} />
        <View style={styles.arrowHeadLeft} />
        <View style={styles.arrowHeadRight} />
        <View style={styles.uploadTray} />
      </View>
    );
  }

  return (
    <View style={styles.commentIcon}>
      <View style={styles.commentLine} />
      <View style={styles.commentTail} />
    </View>
  );
}

function formatMetricLead(current: number | undefined, total: number) {
  return current === undefined ? `${total}` : `${current}`;
}

function formatMetricTail(current: number | undefined, total: number) {
  return current === undefined ? undefined : `${total}`;
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 24
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
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: 2,
    paddingTop: 10,
    paddingBottom: 6,
    shadowColor: colors.black,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  metric: {
    alignItems: "center",
    minWidth: 62,
    justifyContent: "flex-start"
  },
  commentIcon: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  commentLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.ink
  },
  commentTail: {
    position: "absolute",
    left: 5,
    bottom: -4,
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.ink,
    transform: [{ rotate: "-18deg" }]
  },
  heartIcon: {
    fontSize: 46,
    lineHeight: 31,
    color: colors.ink
  },
  contributionIcon: {
    width: 32,
    height: 32
  },
  arrowStem: {
    position: "absolute",
    left: 15,
    top: 1,
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.ink
  },
  arrowHeadLeft: {
    position: "absolute",
    left: 7,
    top: 4,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.ink,
    transform: [{ rotate: "-45deg" }]
  },
  arrowHeadRight: {
    position: "absolute",
    right: 6,
    top: 4,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.ink,
    transform: [{ rotate: "45deg" }]
  },
  uploadTray: {
    position: "absolute",
    left: 3,
    right: 3,
    bottom: 0,
    height: 14,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8
  },
  saveIcon: {
    width: 25,
    height: 32,
    borderWidth: 2.2,
    borderColor: colors.ink,
    borderRadius: 5
  },
  saveNotch: {
    position: "absolute",
    left: 8,
    bottom: -2,
    width: 10,
    height: 10,
    borderLeftWidth: 2.4,
    borderBottomWidth: 2.4,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    transform: [{ rotate: "-45deg" }]
  },
  metricValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.ink
  },
  metricSecondary: {
    color: colors.muted
  }
});
