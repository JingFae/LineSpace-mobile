import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { CommentIcon, LikeIcon, SaveIcon, ShareIcon } from "../icon";

export type PoemEngagementMetrics = {
  comments: number;
  likes: number;
  contributions: number;
  saves: number;
};

type PoemEngagementBarProps = {
  metrics: PoemEngagementMetrics;
  liked?: boolean;
  saved?: boolean;
  disabled?: boolean;
  variant?: "card" | "dock";
  onCommentPress?: () => void;
  onLikePress?: () => void;
  onContributionPress?: () => void;
  onSavePress?: () => void;
};

type MetricKind = "comment" | "like" | "contribution" | "save";

export function PoemEngagementBar({
  metrics,
  liked = false,
  saved = false,
  disabled = false,
  variant = "card",
  onCommentPress,
  onLikePress,
  onContributionPress,
  onSavePress
}: PoemEngagementBarProps) {
  return (
    <View style={[styles.root, variant === "dock" ? styles.dock : styles.card]}>
      <MetricButton
        accessibilityLabel={`${metrics.comments} comments`}
        count={metrics.comments}
        disabled={disabled}
        kind="comment"
        onPress={onCommentPress}
      />
      <MetricButton
        accessibilityLabel={`${metrics.likes} likes`}
        active={liked}
        count={metrics.likes}
        disabled={disabled}
        kind="like"
        onPress={onLikePress}
      />
      <MetricButton
        accessibilityLabel={`${metrics.contributions} contributions`}
        count={metrics.contributions}
        disabled={disabled}
        kind="contribution"
        onPress={onContributionPress}
      />
      <MetricButton
        accessibilityLabel={`${metrics.saves} saves`}
        active={saved}
        count={metrics.saves}
        disabled={disabled}
        kind="save"
        onPress={onSavePress}
      />
    </View>
  );
}

function MetricButton({
  accessibilityLabel,
  active = false,
  count,
  disabled,
  kind,
  onPress
}: {
  accessibilityLabel: string;
  active?: boolean;
  count: number;
  disabled: boolean;
  kind: MetricKind;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      disabled={disabled || !onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.metric, pressed && styles.metricPressed]}
    >
      <View style={styles.iconSlot}>{renderMetricIcon(kind, active)}</View>
      <Text style={styles.metricValue}>{count}</Text>
    </Pressable>
  );
}

function renderMetricIcon(kind: MetricKind, active: boolean) {
  if (kind === "like") {
    return <LikeIcon activeColor={colors.liked} filled={active} />;
  }

  if (kind === "save") {
    return <SaveIcon activeColor={colors.saved} filled={active} />;
  }

  if (kind === "contribution") {
    return <ShareIcon />;
  }

  return <CommentIcon />;
}

const styles = StyleSheet.create({
  root: {
    height: 68,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    paddingTop: 9,
    paddingBottom: 5
  },
  card: {
    borderRadius: radius.md,
    marginTop: 2,
    shadowColor: colors.black,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  dock: {
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17
  },
  metric: {
    minWidth: 58,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: radius.sm
  },
  metricPressed: {
    backgroundColor: colors.surfacePressed
  },
  iconSlot: {
    width: 34,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  metricValue: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "400",
    color: colors.ink,
    fontVariant: ["tabular-nums"]
  }
});
