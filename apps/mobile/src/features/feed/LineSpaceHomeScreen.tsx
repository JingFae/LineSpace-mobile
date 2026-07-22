import { router, type Href } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
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
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { usePoemEngagement } from "@/features/poem/usePoemEngagement";
import { getPoemLayoutPresentation } from "@/features/poem/poemPresentation";
import { FeedTopChrome } from "@/components/FeedTopChrome";
import { useGuestAccess } from "@/auth/GuestAccessProvider";

declare const require: (path: string) => ImageSourcePropType;

const waterArtwork = require("../../../assets/preview-water.png");
const sectionTabs: Array<{ value: FeedSection; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "popular", label: "Popular" },
  { value: "following", label: "Follow" }
];
const feedPageSize = 3;

export function LineSpaceHomeScreen() {
  const { user: authUser } = useAuth();
  const { requireAccount } = useGuestAccess();
  const currentUserId = authUser?.id ?? "";
  const [section, setSection] = useState<FeedSection>("latest");
  const engagement = usePoemEngagement();
  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId),
    enabled: true
  });

  const feedQuery = useInfiniteQuery({
    queryKey: ["feed", section, currentUserId],
    queryFn: ({ pageParam }) =>
      lineSpaceApi.listFeed({
        section,
        viewerId: currentUserId,
        cursor: pageParam,
        limit: feedPageSize
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === feedPageSize ? lastPage.at(-1)?.id : undefined,
    enabled: currentUserId.length > 0
  });

  const poems = useMemo(
    () => {
      const seen = new Set<string>();
      return (feedQuery.data?.pages ?? [])
        .flat()
        .filter((poem) => !seen.has(poem.id) && Boolean(seen.add(poem.id)))
        .map(mapPoemToCard);
    },
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
        onTabChange={(value) => {
          const next = value as FeedSection;
          if (next === "following" && !requireAccount("view your following feed")) return;
          setSection(next);
        }}
        searchLabel="Search LineSpace"
        tabs={sectionTabs}
      />

      <FlatList
        contentContainerStyle={styles.feedContent}
        data={poems}
        keyExtractor={(poem) => poem.id}
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            void feedQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
            onRefresh={() => void feedQuery.refetch()}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item: poem }) => (
          <FeedCardReveal>
            <PoemCard
              poem={poem}
              onAuthorPress={(userId) => router.push({ pathname: "/profile/[id]", params: { id: userId } } as unknown as Href)}
              onCommentPress={(id) =>
                router.push({ pathname: "/poem/[id]", params: { id } })
              }
              onContributionPress={(id) => {
                if (requireAccount("share this post")) router.push({ pathname: "/poem/share/[id]", params: { id } } as unknown as Href);
              }}
              onLikePress={(id, isLiked) =>
                engagement.setCollection(id, "liked", isLiked)
              }
              onPress={(id) => router.push({ pathname: "/poem/[id]", params: { id } })}
              onSavePress={(id, isSaved) =>
                engagement.setCollection(id, "saved", isSaved)
              }
              onTagPress={(tag) => router.push({ pathname: "/tags/[tag]", params: { tag, section: "posts" } } as unknown as Href)}
            />
          </FeedCardReveal>
        )}
        ListEmptyComponent={
          feedQuery.isLoading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={colors.accent} /></View>
          ) : feedQuery.isError ? (
            <EmptyState title="Feed unavailable" body="Pull down to try loading the feed again." />
          ) : (
            <EmptyState title="No posts yet" body="Published posts from the community will appear here." />
          )
        }
        ListFooterComponent={
          feedQuery.isFetchingNextPage
            ? <View style={styles.pageLoader}><ActivityIndicator color={colors.accent} /></View>
            : null
        }
        showsVerticalScrollIndicator={false}
        style={styles.feed}
      />

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
            if (!requireAccount("publish your own writing")) return;
            router.push({
              pathname: "/(tabs)/compose",
              params: { session: `${Date.now()}` }
            } as Href);
            return;
          }
          if (value === "inbox" && !requireAccount("open your inbox")) return;
          router.push(tabRoutes[value]);
        }}
      />

    </AppScreen>
  );
}

function FeedCardReveal({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
      }}
    >
      {children}
    </Animated.View>
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
    layout: getPoemLayoutPresentation(poem),
    versionLines: poem.versionLines?.map((line) => ({
      ...line,
      author: { ...line.author }
    }))
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
  },
  pageLoader: {
    paddingVertical: spacing.lg
  }
});
