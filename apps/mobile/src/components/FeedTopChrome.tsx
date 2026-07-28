import { Pressable, StyleSheet, Text, View } from "react-native";
import { LineSpaceLogoIcon, SearchIcon } from "@linespace/ui";
import { colors, spacing } from "@linespace/tokens";

export type FeedTopChromeTab = {
  label: string;
  value: string;
};

export function FeedTopChrome({
  activeValue,
  onSearch,
  onTabChange,
  sectionLabel,
  searchLabel,
  tabs
}: {
  activeValue: string;
  onSearch: () => void;
  onTabChange: (value: string) => void;
  sectionLabel: "Post" | "Thread";
  searchLabel: string;
  tabs: readonly FeedTopChromeTab[];
}) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerButton} />
        <View style={styles.brand}>
          <LineSpaceLogoIcon color={colors.black} height={31} width={54} />
          <View style={styles.brandDivider} />
          <Text style={styles.sectionLabel}>{sectionLabel}</Text>
        </View>
        <Pressable
          accessibilityLabel={searchLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSearch}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <SearchIcon color={colors.ink} height={26} width={26} />
        </Pressable>
      </View>
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.value === activeValue;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.value}
              onPress={() => onTabChange(tab.value)}
              style={styles.tab}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {active ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 122,
    backgroundColor: colors.surface
  },
  header: {
    height: 78,
    paddingTop: 30,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  brandDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: colors.line
  },
  sectionLabel: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0.2
  },
  pressed: { opacity: 0.58 },
  tabs: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  tab: {
    minWidth: 62,
    height: 44,
    paddingTop: 4,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  tabText: {
    color: colors.profileMuted,
    fontSize: 14,
    lineHeight: 19
  },
  tabTextActive: {
    color: colors.ink,
    fontWeight: "600"
  },
  indicator: {
    width: 20,
    height: 2,
    marginTop: 7,
    borderRadius: 1,
    backgroundColor: colors.ink
  }
});
