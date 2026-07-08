import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@linespace/tokens";

export type BottomNavItem<TValue extends string> = {
  value: TValue;
  label: string;
};

type BottomNavigationProps<TValue extends string> = {
  items: readonly BottomNavItem<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
};

export function BottomNavigation<TValue extends string>({
  items,
  value,
  onChange
}: BottomNavigationProps<TValue>) {
  return (
    <View style={styles.root}>
      {items.map((item) => {
        const active = item.value === value;
        const isCreate = item.value === "compose";

        return (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.value)}
            style={[styles.item, isCreate && styles.createItem, active && styles.activeItem]}
          >
            <View
              style={[
                styles.icon,
                isCreate && styles.createIcon,
                active && !isCreate && styles.activeIcon
              ]}
            >
              {isCreate ? <Text style={styles.createGlyph}>+</Text> : null}
            </View>
            {!isCreate ? <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm
  },
  item: {
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  createItem: {
    transform: [{ translateY: -10 }]
  },
  activeItem: {},
  icon: {
    width: 24,
    height: 24,
    borderWidth: 1.8,
    borderColor: colors.ink,
    borderRadius: radius.sm
  },
  activeIcon: {
    backgroundColor: colors.accent
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  createGlyph: {
    color: colors.white,
    fontSize: 34,
    lineHeight: 36
  },
  label: {
    ...typography.caption,
    color: colors.muted
  },
  activeLabel: {
    color: colors.ink
  }
});
