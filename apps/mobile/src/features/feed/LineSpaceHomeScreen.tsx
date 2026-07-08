import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  BottomNavigation,
  EmptyState,
  PoemCard,
  SegmentTabs,
  type PoemCardModel,
  type SegmentTab
} from "@linespace/ui";
import { colors, spacing, typography } from "@linespace/tokens";
import type { FeedFilter, FeedSection, PoemSummary } from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { mainTabs, tabRoutes } from "@/navigation/tabs";

const sectionTabs: SegmentTab<FeedSection>[] = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "following", label: "Follow" }
];

const filterTabs: SegmentTab<FeedFilter>[] = [
  { value: "all", label: "All" },
  { value: "most-contributed", label: "Most Contributed" },
  { value: "growing", label: "Growing" },
  { value: "final", label: "Final" }
];

export function LineSpaceHomeScreen() {
  const [section, setSection] = useState<FeedSection>("latest");
  const [filter, setFilter] = useState<FeedFilter>("all");

  const feedQuery = useQuery({
    queryKey: ["feed", section, filter],
    queryFn: () => lineSpaceApi.listFeed({ section, filter })
  });

  const poems = useMemo(
    () => (feedQuery.data ?? []).map(mapPoemToCard),
    [feedQuery.data]
  );

  return (
    <AppScreen scroll={false} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>LineSpace</Text>
        <Pressable accessibilityRole="button" style={styles.searchButton}>
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
      </View>

      <SegmentTabs tabs={sectionTabs} value={section} onChange={setSection} />
      <View style={styles.filterWrap}>
        <SegmentTabs tabs={filterTabs} value={filter} onChange={setFilter} variant="bar" />
      </View>

      <View style={styles.feed}>
        {feedQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : feedQuery.isError ? (
          <EmptyState
            title="Feed unavailable"
            body="The feed request failed. Keep this branch behind the API client so the screen remains stable."
          />
        ) : poems.length === 0 ? (
          <EmptyState
            title="No poems here yet"
            body="This filter is ready for real API data when the backend is connected."
          />
        ) : (
          poems.map((poem) => (
            <PoemCard
              key={poem.id}
              poem={poem}
              onPress={(id) => router.push({ pathname: "/poem/[id]", params: { id } })}
            />
          ))
        )}
      </View>

      <BottomNavigation
        items={mainTabs}
        value="home"
        onChange={(value) => router.push(tabRoutes[value])}
      />
    </AppScreen>
  );
}

function mapPoemToCard(poem: PoemSummary): PoemCardModel {
  return {
    id: poem.id,
    title: poem.title,
    lines: poem.lines,
    author: {
      displayName: poem.author.displayName,
      handle: poem.author.handle,
      avatarColor: poem.author.avatarColor
    },
    contributorsCount: poem.contributorsCount,
    tags: poem.tags,
    statusLabel: poem.status === "growing" ? "Poem Growing" : "Final Poem",
    startedAtLabel: formatPoemDate(poem.startedAt),
    metrics: poem.metrics,
    artworkTone: poem.artworkTone
  };
}

function formatPoemDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();

  return `${year}/${month}/${day} ${weekday}.`;
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
  brand: {
    ...typography.title,
    color: colors.ink,
    letterSpacing: 0
  },
  searchButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  searchText: {
    ...typography.label,
    color: colors.ink
  },
  filterWrap: {
    marginHorizontal: -spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg
  },
  feed: {
    flex: 1
  }
});
