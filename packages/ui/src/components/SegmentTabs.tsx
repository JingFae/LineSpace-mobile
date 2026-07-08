import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@linespace/tokens";

export type SegmentTab<TValue extends string> = {
  value: TValue;
  label: string;
};

type SegmentTabsProps<TValue extends string> = {
  tabs: readonly SegmentTab<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  variant?: "plain" | "bar";
};

export function SegmentTabs<TValue extends string>({
  tabs,
  value,
  onChange,
  variant = "plain"
}: SegmentTabsProps<TValue>) {
  return (
    <View style={[styles.root, variant === "bar" && styles.bar]}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, active && variant === "bar" && styles.activeBarTab]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: spacing.xs
  },
  tab: {
    minHeight: 38,
    minWidth: 68,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  activeBarTab: {
    backgroundColor: colors.surfaceMuted
  },
  label: {
    ...typography.label,
    color: colors.muted
  },
  activeLabel: {
    color: colors.ink
  }
});
