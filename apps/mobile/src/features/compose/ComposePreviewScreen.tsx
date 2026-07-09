import type { Href } from "expo-router";
import { router } from "expo-router";
import { createElement } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import { mockPoems } from "@linespace/api-client";
import { AppScreen } from "@linespace/ui";
import { colors, radius, spacing, typography } from "@linespace/tokens";

declare const require: (path: string) => ImageSourcePropType;

type SearchParamValue = string | string[] | undefined;

type ComposePreviewScreenProps = {
  params: Record<string, SearchParamValue>;
};

const defaultPreviewArtwork = require("../../../assets/preview-water.png");
const screenBackground = "#F6F7F7";
const mutedText = "#949494";

export function ComposePreviewScreen({ params }: ComposePreviewScreenProps) {
  const fallbackPoem = mockPoems[0]!;
  const title = getParam(params.title) || fallbackPoem.title;
  const bodyLines = getBodyLines(getParam(params.body), fallbackPoem.lines);
  const displayName = getParam(params.name) || fallbackPoem.author.displayName;
  const tags = getTags(getParam(params.tag), fallbackPoem.tags);
  const mediaUri = getParam(params.mediaUri);
  const mediaKind = getParam(params.mediaKind);

  return (
    <AppScreen
      scroll={false}
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
        <Text style={styles.headerTitle}>layout</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/(tabs)" as Href)}
          style={styles.doneButton}
        >
          <Text style={styles.doneText}>done</Text>
        </Pressable>
      </View>

      <View style={styles.canvas}>
        <View style={styles.previewCard}>
          <PreviewMedia uri={mediaUri} kind={mediaKind} />
          <View style={styles.cardBody}>
            <Text style={styles.poemTitle}>💡{title}</Text>
            <View style={styles.poemLines}>
              {bodyLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.poemLine}>
                  {line}
                </Text>
              ))}
            </View>
            <Text numberOfLines={1} style={styles.tags}>
              {tags.map((tag) => `#${tag}`).join("  |  ")}
            </Text>
            <View style={styles.cardDivider} />
            <Text style={styles.status}>🌱Poem Growing</Text>
            <Text style={styles.startedAt}>started from {formatPoemDate(fallbackPoem.startedAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.toolbar}>
        <ToolButton label="▣" />
        <ToolButton label="T" />
        <ToolButton label="≡" />
        <ToolButton label="♭" />
        <Text style={styles.previewAction}>Preview</Text>
      </View>

      <View pointerEvents="none" style={styles.authorGhost}>
        <Text style={styles.authorGhostText}>@{displayName}</Text>
      </View>
    </AppScreen>
  );
}

function PreviewMedia({ uri, kind }: { uri: string; kind: string }) {
  if (uri && kind === "video") {
    if (Platform.OS === "web") {
      return (
        <View style={styles.mediaFrame}>
          {createElement("video", {
            controls: true,
            src: uri,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block"
            }
          })}
        </View>
      );
    }

    return (
      <View style={styles.videoFrame}>
        <Text style={styles.videoFrameText}>Video attached</Text>
      </View>
    );
  }

  return (
    <Image
      source={uri ? ({ uri } as ImageSourcePropType) : defaultPreviewArtwork}
      resizeMode="cover"
      style={styles.mediaFrame}
    />
  );
}

function ToolButton({ label }: { label: string }) {
  return (
    <Pressable accessibilityRole="button" style={styles.toolButton}>
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

function getParam(value: SearchParamValue): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getBodyLines(value: string, fallbackLines: string[]) {
  const lines = value
    .split(/\\n|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : fallbackLines;
}

function getTags(value: string, fallbackTags: string[]) {
  const tags = value
    .split(/[,\s#|]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : fallbackTags;
}

function formatPoemDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();

  return `${year}/${month}/${day} ${weekday}.`;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: screenBackground
  },
  screen: {
    flex: 1,
    backgroundColor: screenBackground,
    paddingBottom: 0
  },
  header: {
    height: 101,
    backgroundColor: colors.white,
    justifyContent: "flex-end",
    paddingBottom: 12
  },
  closeButton: {
    position: "absolute",
    left: 11,
    bottom: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  closeGlyph: {
    color: colors.black,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "300"
  },
  headerTitle: {
    alignSelf: "center",
    color: colors.black,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400"
  },
  doneButton: {
    position: "absolute",
    right: 14,
    bottom: 10,
    minHeight: 32,
    justifyContent: "center"
  },
  doneText: {
    color: "#868686",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400"
  },
  canvas: {
    flex: 1,
    paddingHorizontal: 19,
    paddingTop: 109,
    paddingBottom: 86,
    backgroundColor: screenBackground
  },
  previewCard: {
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.white
  },
  mediaFrame: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfacePressed
  },
  videoFrame: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfacePressed
  },
  videoFrameText: {
    ...typography.body,
    color: colors.ink
  },
  cardBody: {
    minHeight: 298,
    paddingHorizontal: 23,
    paddingTop: 17,
    paddingBottom: 14,
    backgroundColor: colors.white
  },
  poemTitle: {
    color: colors.black,
    fontSize: 26,
    lineHeight: 32,
    fontStyle: "italic",
    fontWeight: "400",
    marginBottom: 18
  },
  poemLines: {
    gap: 12,
    marginBottom: 24
  },
  poemLine: {
    color: colors.black,
    fontSize: 20,
    lineHeight: 23,
    fontStyle: "italic",
    fontWeight: "400"
  },
  tags: {
    color: mutedText,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 10
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginBottom: 8
  },
  status: {
    color: colors.black,
    fontSize: 16,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "400"
  },
  startedAt: {
    color: mutedText,
    fontSize: 15,
    lineHeight: 20,
    fontStyle: "italic"
  },
  toolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 69,
    flexDirection: "row",
    alignItems: "center",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.white,
    paddingLeft: 45,
    paddingRight: 30,
    gap: 20
  },
  toolButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.3,
    borderColor: colors.black,
    alignItems: "center",
    justifyContent: "center"
  },
  toolLabel: {
    color: colors.black,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "400"
  },
  previewAction: {
    color: colors.black,
    fontSize: 20,
    lineHeight: 24,
    marginLeft: spacing.sm
  },
  authorGhost: {
    position: "absolute",
    left: 42,
    top: 241,
    opacity: 0
  },
  authorGhostText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20
  }
});
