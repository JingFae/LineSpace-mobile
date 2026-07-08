import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen, Avatar, BottomNavigation, EmptyState, PoemArtwork } from "@linespace/ui";
import { colors, radius, spacing, typography } from "@linespace/tokens";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { mainTabs, tabRoutes } from "@/navigation/tabs";

type PoemDetailScreenProps = {
  id?: string;
};

export function PoemDetailScreen({ id }: PoemDetailScreenProps) {
  const poemQuery = useQuery({
    queryKey: ["poem", id],
    enabled: Boolean(id),
    queryFn: () => lineSpaceApi.getPoem(id!)
  });

  return (
    <AppScreen scroll contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>LineSpace</Text>
        <Pressable accessibilityRole="button" style={styles.follow}>
          <Text style={styles.followText}>Follow</Text>
        </Pressable>
      </View>

      {poemQuery.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : poemQuery.isError || !poemQuery.data ? (
        <EmptyState
          title="Poem not found"
          body="The detail route is wired. Connect the API to return poem records by id."
        />
      ) : (
        <View>
          <View style={styles.authorRow}>
            <Avatar
              color={poemQuery.data.author.avatarColor}
              label={poemQuery.data.author.displayName}
            />
            <View>
              <Text style={styles.authorName}>{poemQuery.data.author.displayName}</Text>
              <Text style={styles.authorHandle}>@{poemQuery.data.author.handle}</Text>
            </View>
          </View>

          <PoemArtwork tone={poemQuery.data.artworkTone} />

          <View style={styles.poemBody}>
            <Text style={styles.poemTitle}>{poemQuery.data.title}</Text>
            {poemQuery.data.lines.map((line) => (
              <Text key={line} style={styles.poemLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.tags}>
              {poemQuery.data.tags.map((tag) => `#${tag}`).join("  |  ")}
            </Text>
          </View>

          <View style={styles.metaPanel}>
            <Text style={styles.metaTitle}>
              {poemQuery.data.status === "growing" ? "Poem Growing" : "Final Poem"}
            </Text>
            <Text style={styles.metaText}>
              with {poemQuery.data.contributorsCount} contributors
            </Text>
          </View>

          <Text style={styles.commentCount}>{poemQuery.data.metrics.comments} comments</Text>
          <View style={styles.commentInput}>
            <Text style={styles.commentPlaceholder}>Comment a line...</Text>
          </View>
        </View>
      )}

      <BottomNavigation
        items={mainTabs}
        value="home"
        onChange={(value) => router.push(tabRoutes[value])}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingTop: spacing.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md
  },
  back: {
    minWidth: 54
  },
  backText: {
    ...typography.label,
    color: colors.ink
  },
  title: {
    ...typography.body,
    color: colors.ink
  },
  follow: {
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: colors.black,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  followText: {
    ...typography.label,
    color: colors.white
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  authorName: {
    ...typography.label,
    color: colors.ink
  },
  authorHandle: {
    ...typography.caption,
    color: colors.muted
  },
  poemBody: {
    paddingVertical: spacing.xl
  },
  poemTitle: {
    ...typography.poemTitle,
    color: colors.ink,
    fontStyle: "italic",
    marginBottom: spacing.lg
  },
  poemLine: {
    ...typography.poemLine,
    color: colors.ink,
    fontStyle: "italic",
    marginBottom: spacing.md
  },
  tags: {
    ...typography.label,
    color: colors.muted,
    marginTop: spacing.md
  },
  metaPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg
  },
  metaTitle: {
    ...typography.label,
    color: colors.ink,
    fontStyle: "italic"
  },
  metaText: {
    ...typography.label,
    color: colors.muted
  },
  commentCount: {
    ...typography.body,
    color: colors.ink,
    marginBottom: spacing.sm
  },
  commentInput: {
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surfacePressed,
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  commentPlaceholder: {
    ...typography.label,
    color: colors.muted
  }
});
