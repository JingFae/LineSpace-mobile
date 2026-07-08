import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "@linespace/tokens";

type AvatarProps = {
  color: string;
  label: string;
  size?: number;
};

export function Avatar({ color, label, size = 38 }: AvatarProps) {
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
      <Text style={styles.initial}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center"
  },
  initial: {
    ...typography.label,
    color: colors.white
  }
});
