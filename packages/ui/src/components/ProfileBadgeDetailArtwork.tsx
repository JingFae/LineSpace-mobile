import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { SvgUri } from "react-native-svg";

declare const require: (path: string) => ImageSourcePropType;

const detailArtwork = {
  creator: require("../icon/badge/Ink_weaver_detail.svg"),
  reviewer: require("../icon/badge/soul_echo_detail.svg")
} as const;

export function ProfileBadgeDetailArtwork({
  variant,
  width = 160
}: {
  variant: "creator" | "reviewer";
  width?: number;
}) {
  const source = Image.resolveAssetSource(detailArtwork[variant]);
  const height = Math.round(width * 1.2);

  return (
    <View style={[styles.frame, { height, width }]}>
      <SvgUri height={height} uri={source.uri} width={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center"
  }
});
