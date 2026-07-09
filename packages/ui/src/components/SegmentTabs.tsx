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
            style={[
              styles.tab,
              variant === "plain" && styles.primaryTab,
              variant === "bar" && styles.barTab,
              active && variant === "bar" && styles.activeBarTab
            ]}
          >
            <Text
              style={[
                styles.label,
                variant === "plain" && styles.primaryLabel,
                variant === "bar" && styles.filterLabel,
                active && styles.activeLabel
              ]}
            >
              {tab.label}
            </Text>
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
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface
  },
  tab: {
    minHeight: 38,
    minWidth: 68,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  primaryTab: {
    minHeight: 58,
    minWidth: 72
  },
  barTab: {
    minHeight: 43,
    minWidth: 52
  },
  activeBarTab: {
    backgroundColor: colors.surface
  },
  label: {
    ...typography.label,
    color: colors.muted
  },
  primaryLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400"
  },
  filterLabel: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "400"
  },
  activeLabel: {
    color: colors.ink
  }
});
