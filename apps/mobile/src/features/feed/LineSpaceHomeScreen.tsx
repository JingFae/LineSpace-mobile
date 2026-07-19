import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  BottomNavigation,
  EmptyState,
  PoemCard,
  type PoemCardModel
} from "@linespace/ui";
import { colors, spacing } from "@linespace/tokens";
import type { FeedSection, PoemSummary } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { usePoemEngagement } from "@/features/poem/usePoemEngagement";
import { getPoemLayoutPresentation } from "@/features/poem/poemPresentation";
import { FeedTopChrome } from "@/components/FeedTopChrome";

declare const require: (path: string) => ImageSourcePropType;

const waterArtwork = require("../../../assets/preview-water.png");
const sectionTabs: Array<{ value: FeedSection; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "following", label: "Follow" }
];

export function LineSpaceHomeScreen() {
  const [section, setSection] = useState<FeedSection>("latest");
  const engagement = usePoemEngagement();
  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });

  const feedQuery = useQuery({
    queryKey: ["feed", section, currentUserId],
    queryFn: () => lineSpaceApi.listFeed({ section, viewerId: currentUserId })
  });

  const poems = useMemo(
    () => (feedQuery.data ?? []).map(mapPoemToCard),
    [feedQuery.data]
  );

  return (
    <AppScreen
      scroll={false}
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <FeedTopChrome
        activeValue={section}
        onSearch={() => router.push("/search" as Href)}
        onTabChange={(value) => setSection(value as FeedSection)}
        searchLabel="Search LineSpace"
        tabs={sectionTabs}
      />

      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
        {feedQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
          </View>
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
              interactionsDisabled={engagement.isPending}
              poem={poem}
              onAuthorPress={(userId) => router.push({ pathname: "/profile/[id]", params: { id: userId } } as unknown as Href)}
              onCommentPress={(id) =>
                router.push({ pathname: "/poem/[id]", params: { id } })
              }
              onContributionPress={(id) =>
                router.push({ pathname: "/poem/share/[id]", params: { id } } as unknown as Href)
              }
              onLikePress={(id, isLiked) =>
                engagement.setCollection(id, "liked", isLiked)
              }
              onPress={(id) => router.push({ pathname: "/poem/[id]", params: { id } })}
              onSavePress={(id, isSaved) =>
                engagement.setCollection(id, "saved", isSaved)
              }
              onTagPress={(tag) => router.push({ pathname: "/tags/[tag]", params: { tag, section: "posts" } } as unknown as Href)}
            />
          ))
        )}
      </ScrollView>

      <BottomNavigation
        items={mainTabs}
        profileAvatar={
          profileQuery.data
            ? {
                color: profileQuery.data.avatarColor,
                imageSource: profileQuery.data.avatarUrl
                  ? { uri: profileQuery.data.avatarUrl }
                  : undefined,
                label: profileQuery.data.displayName
              }
            : undefined
        }
        value="post"
        onChange={(value) => {
          if (value === "compose") {
            router.push({
              pathname: "/(tabs)/compose",
              params: { session: `${Date.now()}` }
            } as Href);
            return;
          }
          router.push(tabRoutes[value]);
        }}
      />

    </AppScreen>
  );
}

export function mapPoemToCard(poem: PoemSummary): PoemCardModel {
  return {
    id: poem.id,
    title: poem.title,
    lines: poem.lines,
    author: {
      id: poem.author.id,
      displayName: poem.author.displayName,
      handle: poem.author.handle,
      avatarColor: poem.author.avatarColor,
      avatarUrl: poem.author.avatarUrl
    },
    contributorsCount: poem.contributorsCount,
    tags: poem.tags,
    statusLabel: poem.status === "growing" ? "Poem Growing" : "Final Poem",
    startedAtLabel: formatPoemDate(poem.startedAt),
    metrics: { ...poem.metrics, contributions: poem.metrics.shares ?? poem.metrics.contributions },
    viewer: poem.viewer,
    artworkTone: poem.artworkTone,
    artworkSource: poem.artworkUrl
      ? { uri: poem.artworkUrl }
      : poem.artworkTone === "water"
        ? waterArtwork
        : undefined,
    layout: getPoemLayoutPresentation(poem)
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
  safeArea: {
    backgroundColor: colors.surface
  },
  screen: {
    backgroundColor: colors.surface
  },
  feed: {
    flex: 1,
    backgroundColor: colors.surface
  },
  feedContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 96
  },
  loadingWrap: {
    paddingTop: spacing.xxxl
  }
});
