import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { Avatar } from "./Avatar";
import { ContentTagRow } from "./ContentTag";

export type VersionPostLineModel = {
  lineNumber: number;
  text: string;
  author: {
    id: string;
    displayName: string;
    handle: string;
    avatarColor: string;
    avatarUrl?: string;
  };
};

export function VersionPostLayoutCard({
  title,
  lines,
  tags,
  publishedBy,
  backgroundRole = "ruled",
  mediaSource,
  onTagPress,
  style
}: {
  title: string;
  lines: VersionPostLineModel[];
  tags: string[];
  publishedBy: string;
  backgroundRole?: "ruled" | "kraft" | "postcard" | "dark";
  mediaSource?: ImageSourcePropType;
  onTagPress?: (tag: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = backgroundRole === "dark";
  const ink = dark ? colors.white : colors.ink;
  return (
    <View style={[styles.root, backgroundStyles[backgroundRole], style]}>
      {mediaSource ? <Image resizeMode="cover" source={mediaSource} style={styles.media} /> : null}
      {mediaSource ? <View style={[styles.mediaWash, dark && styles.mediaWashDark]} /> : null}
      <Text style={[styles.title, { color: ink }]}>{title || "untitled line"}</Text>
      <View style={styles.lineStack}>
        {lines.map((line) => (
          <View key={`${line.lineNumber}-${line.author.id}-${line.text}`} style={styles.lineRow}>
            <Avatar
              color={line.author.avatarColor}
              imageSource={line.author.avatarUrl ? { uri: line.author.avatarUrl } : undefined}
              label={line.author.displayName}
              size={30}
            />
            <View style={styles.lineCopy}>
              <Text style={[styles.author, { color: ink }]}>@{line.author.handle}</Text>
              <Text style={[styles.lineText, { color: ink }]}>{line.text}</Text>
            </View>
            <View style={[styles.lineBadge, dark && styles.lineBadgeDark]}>
              <Text style={[styles.lineBadgeText, { color: ink }]}>Line {line.lineNumber}</Text>
            </View>
          </View>
        ))}
      </View>
      {tags.length ? <ContentTagRow onTagPress={onTagPress} tags={tags} /> : null}
      <Text style={[styles.byline, { color: ink }]}>published by {publishedBy}</Text>
    </View>
  );
}

const backgroundStyles = StyleSheet.create({
  ruled: { backgroundColor: "#F6F2EA" },
  kraft: { backgroundColor: "#D8C5A6" },
  postcard: { backgroundColor: "#E7EEF0" },
  dark: { backgroundColor: "#17191E" }
});

const styles = StyleSheet.create({
  root: {
    borderColor: "rgba(21,21,21,0.10)",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingVertical: 24,
    position: "relative"
  },
  media: { ...StyleSheet.absoluteFillObject, height: "100%", opacity: 0.3, width: "100%" },
  mediaWash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.48)" },
  mediaWashDark: { backgroundColor: "rgba(0,0,0,0.46)" },
  title: { fontFamily: "Georgia", fontSize: 27, fontWeight: "700", lineHeight: 34, marginBottom: 15 },
  lineStack: { gap: 2, marginBottom: 18 },
  lineRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, paddingVertical: 9 },
  lineCopy: { flex: 1, minWidth: 0 },
  author: { fontSize: 11, fontWeight: "700", lineHeight: 14, opacity: 0.66 },
  lineText: { fontFamily: "Georgia", fontSize: 17, lineHeight: 25, marginTop: 3 },
  lineBadge: { backgroundColor: "rgba(255,255,255,0.62)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  lineBadgeDark: { backgroundColor: "rgba(255,255,255,0.12)" },
  lineBadgeText: { fontSize: 10, fontWeight: "800", opacity: 0.7 },
  byline: { borderTopColor: "rgba(21,21,21,0.18)", borderTopWidth: StyleSheet.hairlineWidth, fontSize: 11, fontWeight: "600", marginTop: 14, opacity: 0.68, paddingTop: 12 }
});
