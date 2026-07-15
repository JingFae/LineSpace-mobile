import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { colors, radius } from "@linespace/tokens";

export type ArtworkTone = "water" | "paper" | "night";

type PoemArtworkProps = {
  tone: ArtworkTone;
  imageSource?: ImageSourcePropType;
};

const toneColors: Record<ArtworkTone, readonly [string, string, string, string]> = {
  water: ["#123C52", "#2E6B7E", "#CFE8E0", "#9BC96A"],
  paper: ["#E8D6B7", "#F3ECE0", "#B89E75", "#F8F5EF"],
  night: ["#171A2F", "#293C66", "#6E80A7", "#D8D8E5"]
};

export function PoemArtwork({ tone, imageSource }: PoemArtworkProps) {
  const palette = toneColors[tone];

  if (imageSource) {
    return <Image source={imageSource} resizeMode="cover" style={styles.root} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: palette[0] }]}>
      <View style={[styles.band, styles.bandOne, { backgroundColor: palette[1] }]} />
      <View style={[styles.band, styles.bandTwo, { backgroundColor: palette[2] }]} />
      <View style={[styles.band, styles.bandThree, { backgroundColor: palette[3] }]} />
      <View style={[styles.band, styles.bandFour, { backgroundColor: palette[1] }]} />
      <View style={[styles.streak, styles.streakOne, { backgroundColor: palette[2] }]} />
      <View style={[styles.streak, styles.streakTwo, { backgroundColor: palette[3] }]} />
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 180,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  band: {
    position: "absolute",
    height: 66,
    left: -38,
    right: -38,
    opacity: 0.88,
    transform: [{ rotate: "-10deg" }]
  },
  bandOne: {
    top: 18
  },
  bandTwo: {
    top: 66,
    opacity: 0.84
  },
  bandThree: {
    top: 114,
    opacity: 0.76
  },
  bandFour: {
    top: 154,
    opacity: 0.52
  },
  streak: {
    position: "absolute",
    height: 22,
    borderRadius: 999,
    opacity: 0.65,
    transform: [{ rotate: "-13deg" }]
  },
  streakOne: {
    left: 12,
    right: 86,
    top: 42
  },
  streakTwo: {
    left: 92,
    right: 12,
    top: 132
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.10)"
  }
});
