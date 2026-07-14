import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  Avatar,
  BottomNavigation,
  EmptyState,
  MenuIcon,
  ProfilePostCard,
  SearchIcon,
  SettingsIcon,
  type ProfilePostCardModel
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type {
  UserConnectionKind,
  UserConnectionPage,
  UserProfileContentItem,
  UserProfileContentSection,
  UserProfileDetails
} from "@linespace/api-client";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

declare const require: (path: string) => ImageSourcePropType;

const profileHeaderArtwork = require("../../../assets/profile/profile-header-water.png");
const profileAvatarArtwork = require("../../../assets/profile/profile-avatar-water.png");
const profilePostArtwork = require("../../../assets/profile/profile-post-mountain.png");
const profileEditRoute = "/profile/edit" as Href;

const contentTabs: Array<{ value: UserProfileContentSection; label: string }> = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "comments" },
  { value: "quotes", label: "quotas" },
  { value: "saves", label: "saves" }
];

export function ProfileScreen() {
  const [section, setSection] = useState<UserProfileContentSection>("posts");
  const [connectionKind, setConnectionKind] = useState<UserConnectionKind | null>(null);

  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });
  const contentQuery = useQuery({
    queryKey: ["user-profile-content", currentUserId, section],
    queryFn: () => lineSpaceApi.listUserProfileContent(currentUserId, section)
  });
  const connectionsQuery = useQuery({
    queryKey: ["user-connections", currentUserId, connectionKind],
    enabled: connectionKind !== null,
    queryFn: () =>
      lineSpaceApi.listUserConnections(currentUserId, connectionKind!, {
        limit: 20,
        viewerId: currentUserId
      })
  });

  const cards = useMemo(
    () => (contentQuery.data?.items ?? []).map(mapProfileContentToCard),
    [contentQuery.data]
  );

  return (
    <AppScreen
      contentContainerStyle={styles.screen}
      padded={false}
      scroll={false}
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {profileQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : profileQuery.isError || !profileQuery.data ? (
          <View style={styles.errorState}>
            <EmptyState
              body="The profile API did not return a user record."
              title="Profile unavailable"
            />
          </View>
        ) : (
          <>
            <ProfileHero
              onConnectionsPress={setConnectionKind}
              onLikesAndSavesPress={() => setSection("saves")}
              profile={profileQuery.data}
            />

            <View style={styles.contentPanel}>
              <ProfileContentTabs section={section} onChange={setSection} />

              {contentQuery.isLoading ? (
                <View style={styles.contentLoading}>
                  <ActivityIndicator color={colors.ink} />
                </View>
              ) : contentQuery.isError ? (
                <EmptyState
                  body="This profile section could not be loaded."
                  title="Content unavailable"
                />
              ) : cards.length === 0 ? (
                <EmptyState
                  body="Content returned by this section will appear here."
                  title={`No ${section} yet`}
                />
              ) : (
                <View style={styles.grid}>
                  {cards.map((card) => (
                    <View key={card.model.id} style={styles.gridItem}>
                      <ProfilePostCard
                        imageSource={card.imageSource}
                        item={card.model}
                        onPress={() => {
                          if (card.poemId) {
                            router.push({
                              pathname: "/poem/[id]",
                              params: { id: card.poemId }
                            });
                          }
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
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
        onChange={(value) => router.push(tabRoutes[value])}
        value="profile"
      />

      <ConnectionSheet
        isLoading={connectionsQuery.isLoading}
        kind={connectionKind}
        onClose={() => setConnectionKind(null)}
        page={connectionsQuery.data}
      />
    </AppScreen>
  );
}

function ProfileHero({
  profile,
  onConnectionsPress,
  onLikesAndSavesPress
}: {
  profile: UserProfileDetails;
  onConnectionsPress: (kind: UserConnectionKind) => void;
  onLikesAndSavesPress: () => void;
}) {
  const avatarSource = profile.avatarUrl ? { uri: profile.avatarUrl } : profileAvatarArtwork;

  return (
    <View style={styles.hero}>
      <Image
        resizeMode="cover"
        source={profileHeaderArtwork}
        style={styles.heroBackground}
      />

      <View style={styles.heroActions}>
        <Pressable accessibilityLabel="Open profile menu" hitSlop={12} style={styles.iconButton}>
          <MenuIcon />
        </Pressable>
        <View style={styles.heroActionsRight}>
          <Pressable accessibilityLabel="Search" hitSlop={12} style={styles.iconButton}>
            <SearchIcon height={22} width={22} />
          </Pressable>
          <Pressable
            accessibilityLabel="Profile settings"
            hitSlop={12}
            onPress={() => router.push(profileEditRoute)}
            style={styles.iconButton}
          >
            <SettingsIcon />
          </Pressable>
        </View>
      </View>

      <View style={styles.identityRow}>
        <Image resizeMode="cover" source={avatarSource} style={styles.avatarImage} />
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.displayName}>
              {profile.displayName}
            </Text>
            <View style={styles.levelPill}>
              <Text style={styles.levelText}>level.{profile.level}</Text>
            </View>
            {profile.badges.slice(0, 1).map((badge) => (
              <View key={badge.id} style={styles.badgePill}>
                {badge.symbol ? <Text style={styles.badgeSymbol}>{badge.symbol}</Text> : null}
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.linespaceId}>linespace ID: {profile.linespaceId}</Text>
          <Text numberOfLines={1} style={styles.bio}>
            {profile.bio}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <ProfileStat
          label="follower"
          onPress={() => onConnectionsPress("followers")}
          value={profile.stats.followers}
        />
        <ProfileStat
          label="following"
          onPress={() => onConnectionsPress("following")}
          value={profile.stats.following}
        />
        <ProfileStat
          label="likes & saves"
          onPress={onLikesAndSavesPress}
          value={profile.stats.likesAndSaves}
        />
      </View>
    </View>
  );
}

function ProfileStat({
  value,
  label,
  onPress
}: {
  value: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${value} ${label}`}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ProfileContentTabs({
  section,
  onChange
}: {
  section: UserProfileContentSection;
  onChange: (section: UserProfileContentSection) => void;
}) {
  return (
    <View style={styles.tabs}>
      {contentTabs.map((tab) => {
        const selected = tab.value === section;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={styles.tab}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ConnectionSheet({
  kind,
  page,
  isLoading,
  onClose
}: {
  kind: UserConnectionKind | null;
  page?: UserConnectionPage;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={kind !== null}
    >
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close list" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{kind ?? "connections"}</Text>
              <Text style={styles.sheetCount}>{page?.total ?? 0} people</Text>
            </View>
            <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {(page?.items ?? []).map((person) => (
                <View key={person.id} style={styles.connectionRow}>
                  <Avatar
                    color={person.avatarColor}
                    imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined}
                    label={person.displayName}
                    size={42}
                  />
                  <View style={styles.connectionCopy}>
                    <Text style={styles.connectionName}>{person.displayName}</Text>
                    <Text style={styles.connectionHandle}>@{person.handle}</Text>
                    {person.bio ? (
                      <Text numberOfLines={1} style={styles.connectionBio}>
                        {person.bio}
                      </Text>
                    ) : null}
                  </View>
                  {person.isFollowing ? (
                    <View style={styles.followingPill}>
                      <Text style={styles.followingText}>following</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function mapProfileContentToCard(item: UserProfileContentItem): {
  model: ProfilePostCardModel;
  poemId?: string;
  imageSource: ImageSourcePropType;
} {
  return {
    model: {
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      tags: item.tags,
      finishedAtLabel: formatProfileDate(item.finishedAt),
      highlightCount: item.highlightCount,
      muted: item.muted
    },
    poemId: item.poemId,
    imageSource: item.artworkUrl ? { uri: item.artworkUrl } : profilePostArtwork
  };
}

function formatProfileDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  return `${year}/${month}/${day} ${weekday}.`;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.profileCanvas
  },
  screen: {
    backgroundColor: colors.profileCanvas
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.profileCanvas
  },
  scrollContent: {
    paddingBottom: 96,
    backgroundColor: colors.profileCanvas
  },
  loadingState: {
    minHeight: 640,
    alignItems: "center",
    justifyContent: "center"
  },
  errorState: {
    minHeight: 640,
    paddingHorizontal: spacing.lg,
    justifyContent: "center"
  },
  hero: {
    height: 288,
    overflow: "hidden",
    backgroundColor: colors.profileCanvas
  },
  heroBackground: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: 304,
    opacity: 0.2
  },
  heroActions: {
    height: 48,
    paddingHorizontal: 18,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  identityRow: {
    marginTop: 20,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "flex-start"
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.faint
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 16,
    paddingTop: 1
  },
  nameRow: {
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center"
  },
  displayName: {
    maxWidth: 82,
    marginRight: 2,
    color: colors.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "400"
  },
  levelPill: {
    height: 17,
    minWidth: 53,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center"
  },
  levelText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "400"
  },
  badgePill: {
    height: 17,
    maxWidth: 88,
    marginLeft: 3,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.badge,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  badgeSymbol: {
    marginRight: 1,
    color: colors.badgeWarm,
    fontSize: 11,
    lineHeight: 14
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "400"
  },
  linespaceId: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 14
  },
  bio: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21
  },
  statsRow: {
    marginTop: 34,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  stat: {
    width: "31%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md
  },
  statPressed: {
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  statValue: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "400",
    fontVariant: ["tabular-nums"]
  },
  statLabel: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "400"
  },
  contentPanel: {
    minHeight: 580,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.profileCanvas,
    overflow: "hidden"
  },
  tabs: {
    height: 63,
    paddingTop: 24,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  tab: {
    flex: 1,
    height: 38,
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabel: {
    color: colors.tabMuted,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400"
  },
  tabLabelActive: {
    color: colors.ink
  },
  grid: {
    paddingHorizontal: 15,
    paddingBottom: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16
  },
  gridItem: {
    width: "48%"
  },
  contentLoading: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center"
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)"
  },
  sheet: {
    maxHeight: "68%",
    minHeight: 360,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    marginTop: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.faint
  },
  sheetHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "500"
  },
  sheetCount: {
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 16
  },
  closeGlyph: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "300"
  },
  sheetLoading: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center"
  },
  connectionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  connectionCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12
  },
  connectionName: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500"
  },
  connectionHandle: {
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 15
  },
  connectionBio: {
    marginTop: 2,
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 15
  },
  followingPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center"
  },
  followingText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 14
  }
});
