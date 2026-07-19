import { Pressable, StyleSheet, Text, View } from "react-native";

type ContentTagProps = {
  tag: string;
  onPress?: (tag: string) => void;
};

/** A single, reusable visual language for navigable Post and Thread tags. */
export function ContentTag({ tag, onPress }: ContentTagProps) {
  const normalized = tag.trim().replace(/^#+/, "");
  if (!normalized) return null;

  return (
    <Pressable
      accessibilityLabel={`Open #${normalized}`}
      accessibilityRole={onPress ? "link" : undefined}
      disabled={!onPress}
      hitSlop={6}
      onPress={(event) => {
        event.stopPropagation();
        onPress?.(normalized);
      }}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <Text style={styles.label}>#{normalized}</Text>
    </Pressable>
  );
}

export function ContentTagRow({
  tags,
  onTagPress
}: {
  tags: readonly string[];
  onTagPress?: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <ContentTag key={tag} onPress={onTagPress} tag={tag} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10
  },
  pressable: {
    minHeight: 22,
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.66,
    transform: [{ scale: 0.98 }]
  },
  label: {
    color: "#1677D2",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    fontWeight: "600",
    textShadowColor: "rgba(48, 156, 255, 0.38)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7
  }
});
