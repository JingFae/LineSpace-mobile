import { Image, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { Avatar } from "./Avatar";
import { ContentTagRow } from "./ContentTag";
import { LineSpaceAiAvatar } from "./LineSpaceAiAvatar";

export type VersionPostLineModel = {
  lineNumber: number;
  text: string;
  originalText?: string;
  aiChangeNote?: string;
  aiHarmonized?: boolean;
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
  const contributors = [
    ...new Map(lines.map((line) => [line.author.id, line.author])).values()
  ];
  const hasAiChanges = lines.some(
    (line) => line.originalText !== undefined && line.originalText !== line.text
  );
  const hasAiContribution =
    hasAiChanges || lines.some((line) => line.aiHarmonized === true);
  const contributorNames = [
    ...(contributors.length
      ? contributors.map((contributor) => contributor.handle)
      : [publishedBy]),
    ...(hasAiContribution ? ["LineSpace-AI"] : [])
  ].join(", ");
  const contributorCount = contributors.length + (hasAiContribution ? 1 : 0);
  return (
    <View style={[styles.root, backgroundStyles[backgroundRole], style]}>
      {mediaSource ? <Image resizeMode="cover" source={mediaSource} style={styles.media} /> : null}
      {mediaSource ? <View style={[styles.mediaWash, dark && styles.mediaWashDark]} /> : null}
      <Text style={[styles.title, { color: ink }]}>{title || "untitled line"}</Text>
      <View style={styles.lineStack}>
        {lines.map((line) => {
          const segments = line.originalText
            ? buildAiTextSegments(line.originalText, line.text)
            : [{ text: line.text, ai: false }];
          return (
            <View key={`${line.lineNumber}-${line.author.id}-${line.text}`}>
              <Text style={[styles.lineText, { color: ink }]}>
                {segments.map((segment, index) => (
                  <Text
                    key={`${line.lineNumber}:${index}`}
                    style={segment.ai ? styles.aiText : undefined}
                  >
                    {segment.text}
                  </Text>
                ))}
              </Text>
            </View>
          );
        })}
      </View>
      {tags.length ? <ContentTagRow onTagPress={onTagPress} tags={tags} /> : null}
      <View style={[styles.contributorFooter, dark && styles.contributorFooterDark]}>
        <View style={styles.contributorSummary}>
          <View style={styles.contributorStack}>
            {contributors.map((contributor, index) => (
              <View
                key={contributor.id}
                style={[
                  styles.contributorAvatar,
                  dark && styles.contributorAvatarDark,
                  { marginLeft: index === 0 ? 0 : -8 }
                ]}
              >
                <Avatar
                  color={contributor.avatarColor}
                  imageSource={
                    contributor.avatarUrl ? { uri: contributor.avatarUrl } : undefined
                  }
                  label={contributor.displayName}
                  size={28}
                />
              </View>
            ))}
            {hasAiContribution ? (
              <View
                style={[
                  styles.contributorAvatar,
                  dark && styles.contributorAvatarDark,
                  { marginLeft: contributors.length === 0 ? 0 : -8 }
                ]}
              >
                <LineSpaceAiAvatar size={28} />
              </View>
            ) : null}
          </View>
          <Text style={[styles.contributorCount, { color: ink }]}>
            {contributorCount} {contributorCount === 1 ? "contributor" : "contributors"}
          </Text>
        </View>
        <Text style={[styles.byline, { color: ink }]}>by {contributorNames}</Text>
        {hasAiChanges ? (
          <View style={styles.aiLegend}>
            <View style={styles.aiLegendSwatch} />
            <Text style={styles.aiLegendText}>Blue text was harmonized by AI</Text>
          </View>
        ) : null}
      </View>
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
  aiLegend: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    paddingVertical: 2
  },
  aiLegendSwatch: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#367EAF"
  },
  aiLegendText: { color: "#367EAF", fontSize: 10, lineHeight: 13, fontWeight: "700" },
  lineStack: { gap: 8, marginBottom: 18 },
  lineText: { fontFamily: "Georgia", fontSize: 18, lineHeight: 27 },
  aiText: {
    color: "#367EAF",
    fontWeight: "600",
    textDecorationColor: "rgba(54,126,175,0.28)",
    textDecorationLine: "underline"
  },
  contributorFooter: {
    borderTopColor: "rgba(21,21,21,0.18)",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 13
  },
  contributorFooterDark: { borderTopColor: "rgba(255,255,255,0.22)" },
  contributorSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  contributorStack: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  contributorAvatar: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: colors.white
  },
  contributorAvatarDark: {
    borderColor: "rgba(23,25,30,0.9)",
    backgroundColor: "#17191E"
  },
  contributorCount: { marginLeft: 10, fontSize: 11, fontWeight: "700", opacity: 0.62 },
  byline: { marginTop: 9, fontSize: 11, fontWeight: "600", lineHeight: 16, opacity: 0.68 }
});

export type AiTextSegment = { text: string; ai: boolean };

export function buildAiTextSegments(
  original: string,
  harmonized: string
): AiTextSegment[] {
  if (original === harmonized) return [{ text: harmonized, ai: false }];
  const before = tokenizeForAiDiff(original);
  const after = tokenizeForAiDiff(harmonized);
  if (before.length > 500 || after.length > 500) {
    return buildPrefixSuffixSegments(before, after);
  }

  const table = Array.from(
    { length: before.length + 1 },
    () => new Uint16Array(after.length + 1)
  );
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      table[left]![right] =
        before[left] === after[right]
          ? table[left + 1]![right + 1]! + 1
          : Math.max(table[left + 1]![right]!, table[left]![right + 1]!);
    }
  }

  const segments: AiTextSegment[] = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      appendAiSegment(segments, before[left]!, false);
      left += 1;
      right += 1;
    } else if (table[left]![right + 1]! >= table[left + 1]![right]!) {
      appendAiSegment(segments, after[right]!, true);
      right += 1;
    } else {
      left += 1;
    }
  }
  while (right < after.length) {
    appendAiSegment(segments, after[right]!, true);
    right += 1;
  }
  return segments.length ? segments : [{ text: harmonized, ai: true }];
}

function tokenizeForAiDiff(value: string) {
  return value.match(
    /\s+|[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]|[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\s]/gu
  ) ?? [];
}

function buildPrefixSuffixSegments(
  before: string[],
  after: string[]
): AiTextSegment[] {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const segments: AiTextSegment[] = [];
  if (prefix) segments.push({ text: after.slice(0, prefix).join(""), ai: false });
  const changed = after.slice(prefix, after.length - suffix).join("");
  if (changed) segments.push({ text: changed, ai: true });
  if (suffix) {
    segments.push({
      text: after.slice(after.length - suffix).join(""),
      ai: false
    });
  }
  return segments.length ? segments : [{ text: after.join(""), ai: true }];
}

function appendAiSegment(
  segments: AiTextSegment[],
  text: string,
  ai: boolean
) {
  const previous = segments[segments.length - 1];
  if (previous?.ai === ai) {
    previous.text += text;
  } else {
    segments.push({ text, ai });
  }
}
