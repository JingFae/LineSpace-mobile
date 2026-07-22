import { Image, Platform, StyleSheet, View, type ImageSourcePropType } from "react-native";
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
  const source = detailArtwork[variant];
  const height = Math.round(width * 1.2);

  // react-native-web intentionally does not implement Image.resolveAssetSource.
  // Let its Image component resolve the Metro asset module directly instead.
  if (Platform.OS === "web") {
    return (
      <View style={[styles.frame, { height, width }]}>
        <Image resizeMode="contain" source={source} style={{ height, width }} />
      </View>
    );
  }

  const resolved = Image.resolveAssetSource(source);
  if (!resolved?.uri) {
    return (
      <View style={[styles.frame, { height, width }]}>
        <Image resizeMode="contain" source={source} style={{ height, width }} />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height, width }]}>
      <SvgUri height={height} uri={resolved.uri} width={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center"
  }
});
