import { Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { colors, spacing } from "@linespace/tokens";
import { ActivityIcon, CreateIcon, MessagesIcon, ReadPostIcon } from "../icon";
import { Avatar } from "./Avatar";

export type BottomNavItem<TValue extends string> = {
  value: TValue;
  label: string;
};

type BottomNavigationProps<TValue extends string> = {
  items: readonly BottomNavItem<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  profileAvatar?: {
    color: string;
    label: string;
    imageSource?: ImageSourcePropType;
  };
};

export function BottomNavigation<TValue extends string>({
  items,
  value,
  onChange,
  profileAvatar
}: BottomNavigationProps<TValue>) {
  return (
    <View style={styles.root}>
      {items.map((item) => {
        const isCreate = item.value === "compose";

        return (
          <Pressable
            key={item.value}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: item.value === value }}
            onPress={() => onChange(item.value)}
            style={[styles.item, isCreate && styles.createItem]}
          >
            <NavIcon
              profileAvatar={profileAvatar}
              selected={item.value === value}
              value={item.value}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function NavIcon({
  selected,
  value,
  profileAvatar
}: {
  selected: boolean;
  value: string;
  profileAvatar?: BottomNavigationProps<string>["profileAvatar"];
}) {
  const color = selected ? colors.black : "#9B9B9B";

  if (value === "compose") {
    return <CreateIcon />;
  }

  if (value === "discover") {
    return <ReadPostIcon color={color} />;
  }

  if (value === "comments") {
    return <MessagesIcon color={color} />;
  }

  if (value === "profile") {
    return profileAvatar ? (
      <Avatar
        color={profileAvatar.color}
        imageSource={profileAvatar.imageSource}
        label={profileAvatar.label}
        size={29}
      />
    ) : (
      <View style={styles.profileDot} />
    );
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
  }
});
