import { StyleSheet, View } from "react-native";
import { colors, radius } from "@linespace/tokens";

export type ArtworkTone = "water" | "paper" | "night";

type PoemArtworkProps = {
  tone: ArtworkTone;
};

const toneColors: Record<ArtworkTone, readonly [string, string, string, string]> = {
  water: ["#123C52", "#2E6B7E", "#CFE8E0", "#9BC96A"],
  paper: ["#E8D6B7", "#F3ECE0", "#B89E75", "#F8F5EF"],
  night: ["#171A2F", "#293C66", "#6E80A7", "#D8D8E5"]
};

export function PoemArtwork({ tone }: PoemArtworkProps) {
  const palette = toneColors[tone];

  return (
    <View style={[styles.root, { backgroundColor: palette[0] }]}>
      <View style={[styles.band, styles.bandOne, { backgroundColor: palette[1] }]} />
      <View style={[styles.band, styles.bandTwo, { backgroundColor: palette[2] }]} />
      <View style={[styles.band, styles.bandThree, { backgroundColor: palette[3] }]} />
      <View style={styles.scrim} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 170,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  band: {
    position: "absolute",
    height: 56,
    left: -28,
    right: -28,
    opacity: 0.9,
    transform: [{ rotate: "-9deg" }]
  },
  bandOne: {
    top: 22
  },
  bandTwo: {
    top: 70,
    opacity: 0.82
  },
  bandThree: {
    top: 112,
    opacity: 0.72
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.14)"
  }
});
