import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@linespace/tokens";

type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xl,
    marginTop: spacing.xl
  },
  title: {
    ...typography.body,
    color: colors.ink,
    marginBottom: spacing.sm
  },
  body: {
    ...typography.label,
    color: colors.muted
  }
});
