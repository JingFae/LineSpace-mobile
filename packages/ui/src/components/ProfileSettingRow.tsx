import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@linespace/tokens";
import { ChevronRightIcon } from "../icon";

type ProfileSettingRowProps = {
  label: string;
  value: string;
  onPress: () => void;
  valueMuted?: boolean;
  accessibilityHint?: string;
};

/** Reusable editable profile field row for the LineSpace settings surface. */
export function ProfileSettingRow({
  label,
  value,
  onPress,
  valueMuted = false,
  accessibilityHint
}: ProfileSettingRowProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={2} style={[styles.value, valueMuted && styles.valueMuted]}>
          {value}
        </Text>
      </View>
      <ChevronRightIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center"
  },
  pressed: {
    backgroundColor: colors.surfacePressed
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginRight: 12
  },
  label: {
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 16
  },
  value: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22
  },
  valueMuted: {
    color: colors.tabMuted
  }
});
