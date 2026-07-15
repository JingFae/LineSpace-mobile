import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  BottomNavigation,
  CreateFlowSheet,
  EmptyState,
  PoemCard,
  SearchIcon,
  SegmentTabs,
  type PoemCardModel,
  type SegmentTab
} from "@linespace/ui";
import { colors, spacing } from "@linespace/tokens";
import type { FeedFilter, FeedSection, PoemSummary } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { usePoemEngagement } from "@/features/poem/usePoemEngagement";

declare const require: (path: string) => ImageSourcePropType;

const waterArtwork = require("../../../assets/preview-water.png");
const homeBackground = "#F6F7F7";

const sectionTabs: SegmentTab<FeedSection>[] = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "following", label: "follow" }
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
  const [createOpen, setCreateOpen] = useState(false);
  const engagement = usePoemEngagement();
  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });

  const feedQuery = useQuery({
    queryKey: ["feed", section, filter, currentUserId],
    queryFn: () => lineSpaceApi.listFeed({ section, filter, viewerId: currentUserId })
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
          <View style={styles.sectionTabs}>
            <SegmentTabs tabs={sectionTabs} value={section} onChange={setSection} />
          </View>
          <SearchButton />
        </View>

        <View style={styles.filterWrap}>
          <SegmentTabs tabs={filterTabs} value={filter} onChange={setFilter} variant="bar" />
        </View>
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
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
              onCommentPress={(id) =>
                router.push({ pathname: "/poem/[id]", params: { id } })
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
        value="home"
        onChange={(value) => {
          if (value === "compose") {
            setCreateOpen(true);
            return;
          }
          router.push(tabRoutes[value]);
        }}
      />

      <CreateFlowSheet
        onClose={() => setCreateOpen(false)}
        onDraftPress={() => {
          setCreateOpen(false);
          router.push({
            pathname: "/(tabs)/compose",
            params: { session: `${Date.now()}` }
          } as Href);
        }}
        visible={createOpen}
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
      displayName: poem.author.displayName,
      handle: poem.author.handle,
      avatarColor: poem.author.avatarColor,
      avatarUrl: poem.author.avatarUrl
    },
    contributorsCount: poem.contributorsCount,
    tags: poem.tags,
    statusLabel: poem.status === "growing" ? "Poem Growing" : "Final Poem",
    startedAtLabel: formatPoemDate(poem.startedAt),
    metrics: poem.metrics,
    viewer: poem.viewer,
    artworkTone: poem.artworkTone,
    artworkSource: poem.artworkTone === "water" ? waterArtwork : undefined
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
    backgroundColor: homeBackground
  },
  screen: {
    backgroundColor: homeBackground
  },
  topChrome: {
    height: 144,
    backgroundColor: colors.surface
  },
  header: {
    height: 101,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 73,
    paddingRight: 28,
    paddingTop: 44,
    backgroundColor: colors.surface
  },
  sectionTabs: {
    flex: 1,
    paddingRight: 12
  },
  searchButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center"
  },
  filterWrap: {
    backgroundColor: colors.surface,
    height: 43,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F8F8F8",
    paddingHorizontal: 25
  },
  feed: {
    flex: 1,
    backgroundColor: homeBackground
  },
  feedContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 96
  },
  loadingWrap: {
    paddingTop: spacing.xxxl
  }
});
