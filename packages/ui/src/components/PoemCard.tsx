import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@linespace/tokens";
import { Avatar } from "./Avatar";
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
    likes: number;
    contributions: number;
    saves: number;
  };
  artworkTone: ArtworkTone;
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
          <Avatar color={poem.author.avatarColor} label={poem.author.displayName} />
          <Text style={styles.authorName}>{poem.author.displayName}</Text>
        </View>
        <Text style={styles.contributors}>with {poem.contributorsCount} contributors</Text>
      </View>

      <PoemArtwork tone={poem.artworkTone} />

      <View style={styles.body}>
        <Text style={styles.title}>{poem.title}</Text>
        <View style={styles.lines}>
          {poem.lines.map((line) => (
            <Text key={line} style={styles.poemLine}>
              {line}
            </Text>
          ))}
        </View>

        <Text style={styles.tags}>{poem.tags.map((tag) => `#${tag}`).join("  |  ")}</Text>

        <View style={styles.status}>
          <Text style={styles.statusTitle}>{poem.statusLabel}</Text>
          <Text style={styles.statusMeta}>started from {poem.startedAtLabel}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Metric label="comments" value={poem.metrics.comments} />
        <Metric label="likes" value={poem.metrics.likes} />
        <Metric label="lines" value={poem.metrics.contributions} />
        <Metric label="saves" value={poem.metrics.saves} />
      </View>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
    shadowColor: colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  authorIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  authorName: {
    ...typography.label,
    color: colors.ink,
    fontStyle: "italic"
  },
  contributors: {
    ...typography.label,
    color: colors.ink
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md
  },
  title: {
    ...typography.poemTitle,
    color: colors.ink,
    fontStyle: "italic",
    marginBottom: spacing.md
  },
  lines: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  poemLine: {
    ...typography.poemLine,
    color: colors.ink,
    fontStyle: "italic"
  },
  tags: {
    ...typography.label,
    color: colors.muted,
    marginBottom: spacing.md
  },
  status: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingTop: spacing.sm
  },
  statusTitle: {
    ...typography.label,
    color: colors.ink,
    fontStyle: "italic"
  },
  statusMeta: {
    ...typography.label,
    color: colors.muted,
    fontStyle: "italic"
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: spacing.sm
  },
  metric: {
    alignItems: "center",
    minWidth: 56
  },
  metricIcon: {
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    marginBottom: 2
  },
  metricValue: {
    ...typography.caption,
    color: colors.ink
  },
  metricLabel: {
    ...typography.caption,
    color: colors.muted
  }
});
