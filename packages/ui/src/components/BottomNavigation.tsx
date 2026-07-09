import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@linespace/tokens";

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
            onPress={() => onChange(item.value)}
            style={[styles.item, isCreate && styles.createItem]}
          >
            <NavIcon value={item.value} />
          </Pressable>
        );
      })}
    </View>
  );
}

function NavIcon({ value }: { value: string }) {
  if (value === "compose") {
    return (
      <View style={styles.createIcon}>
        <Text style={styles.createGlyph}>+</Text>
      </View>
    );
  }

  if (value === "discover") {
    return <BookIcon color={colors.black} />;
  }

  if (value === "comments") {
    return <BubbleIcon color="#9B9B9B" />;
  }

  if (value === "profile") {
    return <View style={styles.profileDot} />;
  }

  return <ScrollIcon color="#9B9B9B" />;
}

function ScrollIcon({ color }: { color: string }) {
  return (
    <View style={[styles.scrollIcon, { borderColor: color }]}>
      <View style={[styles.scrollRoll, { borderColor: color }]} />
      <View style={[styles.scrollLine, { backgroundColor: color }]} />
      <View style={[styles.scrollLineShort, { backgroundColor: color }]} />
    </View>
  );
}

function BookIcon({ color }: { color: string }) {
  return (
    <View style={styles.bookIcon}>
      <View style={[styles.bookPage, styles.bookLeft, { borderColor: color }]} />
      <View style={[styles.bookPage, styles.bookRight, { borderColor: color }]} />
      <View style={[styles.bookSpine, { backgroundColor: color }]} />
      <View style={[styles.bookBaseLeft, { backgroundColor: color }]} />
      <View style={[styles.bookBaseRight, { backgroundColor: color }]} />
    </View>
  );
}

function BubbleIcon({ color }: { color: string }) {
  return (
    <View style={[styles.bubbleIcon, { borderColor: color }]}>
      <View style={[styles.bubbleLine, { backgroundColor: color }]} />
      <View style={[styles.bubbleLineShort, { backgroundColor: color }]} />
      <View style={[styles.bubbleTail, { borderColor: color }]} />
    </View>
  );
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
  createIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    borderColor: colors.black
  },
  createGlyph: {
    color: colors.white,
    fontSize: 43,
    lineHeight: 45,
    fontWeight: "300"
  },
  profileDot: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#FF0038"
  },
  scrollIcon: {
    width: 26,
    height: 30,
    borderWidth: 2,
    borderRadius: 4
  },
  scrollRoll: {
    position: "absolute",
    left: -8,
    top: 0,
    width: 13,
    height: 30,
    borderWidth: 2,
    borderRightWidth: 0,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7
  },
  scrollLine: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 12,
    height: 2,
    borderRadius: 1
  },
  scrollLineShort: {
    position: "absolute",
    left: 8,
    top: 16,
    width: 8,
    height: 2,
    borderRadius: 1
  },
  bookIcon: {
    width: 33,
    height: 31
  },
  bookPage: {
    position: "absolute",
    top: 1,
    width: 16,
    height: 24,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4
  },
  bookLeft: {
    left: 0,
    borderRightWidth: 0,
    transform: [{ skewY: "8deg" }]
  },
  bookRight: {
    right: 0,
    borderLeftWidth: 0,
    transform: [{ skewY: "-8deg" }]
  },
  bookSpine: {
    position: "absolute",
    left: 15,
    top: 3,
    width: 3,
    height: 24,
    borderRadius: 2
  },
  bookBaseLeft: {
    position: "absolute",
    left: 2,
    bottom: 0,
    width: 14,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: "13deg" }]
  },
  bookBaseRight: {
    position: "absolute",
    right: 2,
    bottom: 0,
    width: 14,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: "-13deg" }]
  },
  bubbleIcon: {
    width: 31,
    height: 28,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  bubbleLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
    marginBottom: 5
  },
  bubbleLineShort: {
    width: 8,
    height: 2,
    borderRadius: 1
  },
  bubbleTail: {
    position: "absolute",
    left: 4,
    bottom: -5,
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "-18deg" }]
  }
});
