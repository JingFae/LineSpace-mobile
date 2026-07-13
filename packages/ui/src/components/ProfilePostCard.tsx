import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { colors, radius } from "@linespace/tokens";

export type ProfilePostCardModel = {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  finishedAtLabel: string;
  highlightCount?: number;
  muted?: boolean;
};

type ProfilePostCardProps = {
  item: ProfilePostCardModel;
  imageSource: ImageSourcePropType;
  onPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

/** Compact two-column profile content card translated from the Profile Figma frame. */
export function ProfilePostCard({
  item,
  imageSource,
  onPress,
  style
}: ProfilePostCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress?.(item.id)}
      style={({ pressed }) => [
        styles.root,
        item.muted && styles.muted,
        pressed && styles.pressed,
        style
      ]}
    >
      <View style={styles.artworkWrap}>
        <Image resizeMode="cover" source={imageSource} style={styles.artwork} />
        <Text numberOfLines={1} style={styles.tags}>
          {item.tags.map((tag) => `#${tag}`).join("｜")}
        </Text>
        {item.highlightCount === undefined ? null : (
          <Text style={styles.highlightCount}>{item.highlightCount}</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.date}>
          finished in {item.finishedAtLabel}
        </Text>
        <View style={styles.divider} />
        <Text numberOfLines={1} style={styles.excerpt}>
          {item.excerpt}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm
  },
  muted: {
    opacity: 0.3
  },
  pressed: {
    opacity: 0.72
  },
  artworkWrap: {
    height: 100,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: colors.faint
  },
  artwork: {
    width: "100%",
    height: "100%"
  },
  tags: {
    position: "absolute",
    left: 9,
    right: 24,
    bottom: 6,
    color: colors.white,
    fontSize: 9,
    lineHeight: 12
  },
  highlightCount: {
    position: "absolute",
    right: 8,
    bottom: 5,
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontStyle: "italic"
  },
  body: {
    height: 88,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: colors.surfaceWarm,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "400",
    fontStyle: "italic"
  },
  date: {
    color: colors.profileMuted,
    fontSize: 9,
    lineHeight: 12,
    fontStyle: "italic"
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 5,
    marginBottom: 5,
    backgroundColor: "#E0DDD6"
  },
  excerpt: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 16,
    fontStyle: "italic"
  }
});
