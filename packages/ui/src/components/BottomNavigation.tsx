import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@linespace/tokens";
import { ActivityIcon, CreateIcon, MessagesIcon, ReadPostIcon } from "../icon";

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
        const isCreate = item.value === "compose";

        return (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: item.value === value }}
            accessibilityLabel={item.label}
            onPress={() => onChange(item.value)}
            style={[styles.item, isCreate && styles.createItem]}
          >
            <NavIcon selected={item.value === value} value={item.value} />
            {isCreate ? null : (
              <Text style={[styles.label, item.value === value && styles.labelSelected]}>
                {item.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function NavIcon({ selected, value }: { selected: boolean; value: string }) {
  const color = selected ? colors.black : "#9B9B9B";

  if (value === "compose") {
    return <CreateIcon />;
  }

  if (value === "post") {
    return <ReadPostIcon color={color} />;
  }

  if (value === "inbox") {
    return <MessagesIcon color={color} />;
  }

  if (value === "profile") {
    return <View style={styles.profileDot} />;
  }

  return <ActivityIcon color={color} />;
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 69,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: spacing.sm,
    shadowColor: colors.black,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10
  },
  item: {
    minWidth: 58,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  createItem: {
    transform: [{ translateY: -8 }]
  },
  profileDot: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#FF0038"
  },
  label: {
    color: colors.tabMuted,
    fontSize: 10,
    lineHeight: 12
  },
  labelSelected: {
    color: colors.black
  }
});
