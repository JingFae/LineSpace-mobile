import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { colors, radius } from "@linespace/tokens";

export type PoemLayoutCardModel = {
  title: string;
  lines: string[];
  tags: string[];
  byline: string;
  startedAtLabel: string;
};

type PoemLayoutCardProps = {
  poem: PoemLayoutCardModel;
  backgroundRole: "ruled" | "kraft" | "postcard" | "dark";
  typographyRole: "serif" | "script" | "sans";
  stickerSymbols?: string[];
  mediaSource?: ImageSourcePropType;
  mediaAspectRatio?: number;
  style?: StyleProp<ViewStyle>;
  onTagPress?: (tag: string) => void;
};

/** Render-only poem canvas shared by Layout selection and final preview surfaces. */
export function PoemLayoutCard({
  poem,
  backgroundRole,
  typographyRole,
  stickerSymbols = [],
  mediaSource,
  mediaAspectRatio,
  style,
  onTagPress
}: PoemLayoutCardProps) {
  const dark = backgroundRole === "dark";
  const textColor = dark ? "#F5EFE3" : colors.ink;
  const typeStyle = typographyStyles[typographyRole];
  const mediaHeight = getMediaHeight(mediaAspectRatio);

  return (
    <View
      style={[
        styles.card,
        backgroundStyles[backgroundRole],
        mediaSource ? styles.cardWithMedia : undefined,
        style
      ]}
    >
      <PaperTexture role={backgroundRole} />
      {mediaSource ? (
        <Image
          accessibilityLabel="Attached poem image"
          resizeMode="cover"
          source={mediaSource}
          style={[styles.media, { height: mediaHeight }]}
        />
      ) : null}
      <View style={styles.body}>
        <View style={styles.stickers}>
          {stickerSymbols.map((symbol, index) => (
            <Text key={`${symbol}-${index}`} style={[styles.sticker, { color: textColor }]}>{symbol}</Text>
          ))}
        </View>
        <Text style={[styles.title, typeStyle, { color: textColor }]}>{poem.title}</Text>
        <View style={styles.lines}>
          {poem.lines.map((line, index) => (
            <Text key={`${line}-${index}`} style={[styles.line, typeStyle, { color: textColor }]}>{line}</Text>
          ))}
        </View>
        <View style={styles.tagRow}>
          {poem.tags.map((tag) => (
            <Pressable
              disabled={!onTagPress}
              key={tag}
              onPress={(event) => {
                event.stopPropagation();
                onTagPress?.(tag);
              }}
            >
              <Text style={styles.tags}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.divider, { backgroundColor: dark ? "rgba(255,255,255,0.24)" : "rgba(21,21,21,0.16)" }]} />
        <View style={styles.footer}>
          <Text style={[styles.byline, { color: textColor }]}>by {poem.byline}</Text>
          <Text style={[styles.date, { color: dark ? "#BFC7CE" : colors.profileMuted }]}>{poem.startedAtLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function PaperTexture({ role }: { role: PoemLayoutCardProps["backgroundRole"] }) {
  if (role === "ruled") {
    return <View pointerEvents="none" style={styles.texture}>{Array.from({ length: 12 }, (_, index) => <View key={index} style={[styles.ruledLine, { top: 34 + index * 28 }]} />)}</View>;
  }
  if (role === "kraft") {
    return <View pointerEvents="none" style={styles.texture}><View style={styles.kraftWash} /><Text style={styles.kraftFibres}>·  ·   · ·    ·   · ·</Text></View>;
  }
  if (role === "postcard") {
    return <View pointerEvents="none" style={styles.texture}><View style={styles.postcardTop} /><View style={styles.postcardBottom} /><View style={styles.postcardStamp}><Text style={styles.postcardStampText}>LINE</Text></View></View>;
  }
  return <View pointerEvents="none" style={styles.texture}><View style={styles.moonGlow} /></View>;
}

const scriptFamily = Platform.select({ ios: "Snell Roundhand", android: "cursive", web: "cursive", default: "Georgia" });

const typographyStyles: Record<PoemLayoutCardProps["typographyRole"], TextStyle> = {
  serif: { fontFamily: "Georgia", fontStyle: "italic" },
  script: { fontFamily: scriptFamily, fontStyle: "normal" },
  sans: { fontFamily: "System", fontStyle: "normal" }
};

const backgroundStyles: Record<PoemLayoutCardProps["backgroundRole"], ViewStyle> = {
  ruled: { backgroundColor: "#F4EFE2" },
  kraft: { backgroundColor: "#C6A476" },
  postcard: { backgroundColor: "#EADBC5" },
  dark: { backgroundColor: "#213142" }
};

function getMediaHeight(aspectRatio?: number) {
  if (!aspectRatio) return 210;
  if (aspectRatio >= 1.65) return 176;
  if (aspectRatio >= 1.05) return 218;
  return 282;
}

const styles = StyleSheet.create({
  card: { minHeight: 470, overflow: "hidden", borderRadius: radius.lg },
  cardWithMedia: { minHeight: 540 },
  texture: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  ruledLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(88,111,129,0.16)" },
  kraftWash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(92,58,29,0.05)" },
  kraftFibres: { position: "absolute", left: 12, right: 12, top: 18, color: "rgba(72,44,24,0.18)", fontSize: 24, letterSpacing: 8 },
  postcardTop: { position: "absolute", left: -5, right: -5, top: 5, height: 6, backgroundColor: "rgba(157,93,77,0.62)", transform: [{ rotate: "-1deg" }] },
  postcardBottom: { position: "absolute", left: -5, right: -5, bottom: 5, height: 6, backgroundColor: "rgba(68,107,132,0.55)", transform: [{ rotate: "1deg" }] },
  postcardStamp: { position: "absolute", right: 18, top: 20, width: 48, height: 38, borderWidth: 1, borderColor: "rgba(118,72,57,0.52)", alignItems: "center", justifyContent: "center", transform: [{ rotate: "5deg" }] },
  postcardStampText: { color: "rgba(118,72,57,0.62)", fontSize: 9, letterSpacing: 1 },
  moonGlow: { position: "absolute", right: -25, top: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(242,231,199,0.08)" },
  media: {
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(21,21,21,0.12)"
  },
  tagRow: { minHeight: 20, marginTop: "auto", paddingTop: 24, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  body: { flex: 1, minHeight: 320, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18 },
  stickers: { position: "absolute", right: 20, top: 16, flexDirection: "row", gap: 4, opacity: 0.65 },
  sticker: { fontSize: 24, lineHeight: 29 },
  title: { paddingRight: 46, fontSize: 27, lineHeight: 34 },
  lines: { marginTop: 22, gap: 10 },
  line: { fontSize: 19, lineHeight: 27 },
  tags: {
    color: "#1677D2",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    fontWeight: "600",
    textShadowColor: "rgba(48,156,255,0.38)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7
  },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 9, marginBottom: 9 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  byline: { fontSize: 12, lineHeight: 16 },
  date: { fontSize: 10, lineHeight: 14 }
});
