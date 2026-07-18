import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  BottomNavigation,
  EmptyState,
  LineSpaceLogoIcon,
  PoemCard,
  SearchIcon,
  type PoemCardModel
} from "@linespace/ui";
import { colors, spacing } from "@linespace/tokens";
import type { FeedSection, PoemSummary } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { usePoemEngagement } from "@/features/poem/usePoemEngagement";
import { getPoemLayoutPresentation } from "@/features/poem/poemPresentation";

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
      <View style={styles.topChrome}>
        <View style={styles.header}>
          <View style={styles.headerButton} />
          <LineSpaceLogoIcon color={colors.black} width={54} height={31} />
          <SearchButton />
        </View>
        <View style={styles.sortRow}>
          {sectionTabs.map((tab) => {
            const active = tab.value === section;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={tab.value}
                onPress={() => setSection(tab.value)}
                style={styles.sortTab}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>
                  {tab.label}
                </Text>
                {active ? <View style={styles.sortIndicator} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

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

function SearchButton() {
  return (
    <Pressable accessibilityRole="button" style={styles.searchButton}>
      <SearchIcon width={26} height={26} />
    </Pressable>
  );
}

function mapPoemToCard(poem: PoemSummary): PoemCardModel {
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
  topChrome: {
    height: 122,
    backgroundColor: colors.surface
  },
  header: {
    height: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 30,
    backgroundColor: colors.surface
  },
  headerButton: {
    width: 44,
    height: 44
  },
  searchButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  sortRow: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 30,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  sortTab: {
    minWidth: 62,
    height: 44,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4
  },
  sortText: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.profileMuted
  },
  sortTextActive: {
    color: colors.ink,
    fontWeight: "600"
  },
  sortIndicator: {
    width: 20,
    height: 2,
    marginTop: 7,
    borderRadius: 1,
    backgroundColor: colors.ink
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
