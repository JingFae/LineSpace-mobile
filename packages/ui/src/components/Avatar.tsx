import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { colors, typography } from "@linespace/tokens";

type AvatarProps = {
  color: string;
  label: string;
  size?: number;
  imageSource?: ImageSourcePropType;
};

export function Avatar({ color, label, size = 38, imageSource }: AvatarProps) {
  const initial = label.trim().slice(0, 1).toUpperCase();

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color
        }
      ]}
    >
      {imageSource ? (
        <Image
          accessibilityLabel={`${label} profile photo`}
          source={imageSource}
          style={styles.image}
        />
      ) : (
        <Text style={styles.initial}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  initial: {
    ...typography.label,
    color: colors.white
  }
});
