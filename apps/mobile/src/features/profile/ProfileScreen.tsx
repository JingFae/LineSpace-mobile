import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  Avatar,
  BottomNavigation,
  EmptyState,
  MenuIcon,
  ProfileBadgeArtwork,
  ProfileBadgeDetailArtwork,
  SearchIcon,
  SettingsIcon
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type {
  UserCollectionKind,
  UserConnectionKind,
  UserConnectionPage,
  UserExperience,
  UserProfileContentItem,
  UserProfileContentSection,
  UserProfileDetails,
  UserThreadRelation
} from "@linespace/api-client";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { useGuestAccess } from "@/auth/GuestAccessProvider";
import { getMediaAspectRatio } from "@/features/poem/poemPresentation";

declare const require: (path: string) => ImageSourcePropType;

const profileHeaderArtwork = require("../../../assets/profile/profile-header-water.png");
const profileAvatarArtwork = require("../../../assets/profile/profile-avatar-water.png");
const profilePostArtwork = require("../../../assets/profile/profile-post-mountain.png");

const guestProfile: UserProfileDetails = {
  id: "guest-profile",
  linespaceId: "guest",
  handle: "guest",
  displayName: "Guest Reader",
  avatarColor: "#F5324A",
  bio: "Exploring public lines before creating a space of my own.",
  level: 0,
  experience: { creator: 0, reviewer: 0, total: 0, level: 0, levelProgress: 0, nextLevelAt: 20 },
  badges: [],
  stats: { followers: 0, following: 0, likesAndSaves: 0 },
  contentCounts: { posts: 0, threads: 0, comments: 0, saves: 0 },
  visibility: { posts: true, threads: true, comments: true, saves: true }
};

type ProfileScreenProps = { userId?: string };

const contentTabs: Array<{ value: UserProfileContentSection; label: string }> = [
  { value: "posts", label: "Posts" },
  { value: "threads", label: "Threads" },
  { value: "saves", label: "Saves" },
  { value: "comments", label: "Comments" }
];

type BadgeVariant = "creator" | "reviewer";
const badgeUnlockXp = 20;
const badgeDetails: Record<BadgeVariant, {
  description: string;
  emotionalNote: string;
  requirement: string;
}> = {
  creator: {
    description: "Weave a passing feeling into words that others can hold. Every poem leaves a little more of your voice in LineSpace.",
    emotionalNote: "Your words deserve to be discovered—and may be exactly what another reader needs today.",
    requirement: "Reach 20 Creator XP"
  },
  reviewer: {
    description: "A thoughtful response tells a writer that their feelings were heard and their words did not disappear into silence.",
    emotionalNote: "One sincere comment can become the gentle reason someone chooses to keep writing.",
    requirement: "Reach 20 Reviewer XP"
  }
};

export function ProfileScreen({ userId }: ProfileScreenProps) {
  const { changePassword, logout, user: authUser } = useAuth();
  const { isGuest, requireAccount } = useGuestAccess();
  const currentUserId = authUser?.id ?? "";
  const isGuestOwnProfile = isGuest && !userId;
  const profileUserId = userId ?? (isGuestOwnProfile ? guestProfile.id : currentUserId);
  const isOwner = isGuestOwnProfile || profileUserId === currentUserId;
  const [section, setSection] = useState<UserProfileContentSection>("posts");
  const [threadRelation, setThreadRelation] = useState<UserThreadRelation>("started");
  const [saveCollection, setSaveCollection] = useState<UserCollectionKind>("liked");
  const [saveKind, setSaveKind] = useState<"post" | "thread" | "comment">("post");
  const [connectionKind, setConnectionKind] = useState<UserConnectionKind | null>(null);
  const [showExperience, setShowExperience] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [managedPost, setManagedPost] = useState<UserProfileContentItem | null>(null);
  const [managedThread, setManagedThread] = useState<UserProfileContentItem | null>(null);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["user-profile", profileUserId],
    queryFn: () => lineSpaceApi.getUserProfile(profileUserId),
    enabled: profileUserId.length > 0 && !isGuestOwnProfile
  });
  const contentQuery = useQuery({
    queryKey: ["user-profile-content", profileUserId, section, threadRelation, saveCollection, saveKind],
    queryFn: () =>
      lineSpaceApi.listUserProfileContent(profileUserId, section, {
        viewerId: currentUserId,
        threadRelation: section === "threads" ? threadRelation : undefined,
        collection: section === "saves" ? saveCollection : undefined,
        contentKind: section === "saves" ? saveKind : undefined
      }),
    enabled: profileUserId.length > 0 && !isGuestOwnProfile
  });
  const draftsQuery = useQuery({
    queryKey: ["user-drafts", profileUserId],
    enabled: isOwner && profileUserId.length > 0 && !isGuestOwnProfile,
    queryFn: () => lineSpaceApi.listUserDrafts(profileUserId)
  });
  const connectionsQuery = useQuery({
    queryKey: ["user-connections", profileUserId, connectionKind],
    enabled: connectionKind !== null && profileUserId.length > 0,
    queryFn: () =>
      lineSpaceApi.listUserConnections(profileUserId, connectionKind!, {
        limit: 20,
        viewerId: currentUserId
      })
  });

  const items = useMemo(() => isGuestOwnProfile ? [] : contentQuery.data?.items ?? [], [contentQuery.data, isGuestOwnProfile]);
  const displayedProfile = isGuestOwnProfile ? guestProfile : profileQuery.data;
  const displayedContentQuery = isGuestOwnProfile
    ? { isLoading: false, isError: false, data: { visible: true } }
    : contentQuery;
  const deletePost = useMutation({
    mutationFn: (poemId: string) => lineSpaceApi.deletePoem({ poemId, userId: currentUserId }),
    onSuccess: (result) => {
      setManagedPost(null);
      queryClient.removeQueries({ queryKey: ["poem", result.poemId] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
    }
  });
  const deleteThread = useMutation({
    mutationFn: (threadId: string) => lineSpaceApi.deleteThread({ threadId, userId: currentUserId }),
    onSuccess: (result) => {
      setManagedThread(null);
      queryClient.removeQueries({ queryKey: ["thread-detail", result.threadId] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
    }
  });

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
        {!isGuestOwnProfile && profileQuery.isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : !displayedProfile || (!isGuestOwnProfile && profileQuery.isError) ? (
          <View style={styles.errorState}>
            <EmptyState
              body="The profile API did not return a user record."
              title="Profile unavailable"
            />
          </View>
        ) : (
          <ProfileLoaded
            contentQuery={displayedContentQuery}
            draftsCount={draftsQuery.data?.total ?? 0}
            experience={displayedProfile.experience}
            isOwner={isOwner}
            itemSection={section}
            items={items}
            onConnectionsPress={isGuestOwnProfile ? () => undefined : setConnectionKind}
            onExperiencePress={() => setShowExperience(true)}
            onLikesAndSavesPress={() => setSection("saves")}
            onManagePost={(item) => {
              deletePost.reset();
              setManagedPost(item);
            }}
            onManageThread={(item) => {
              deleteThread.reset();
              setManagedThread(item);
            }}
            onSettingsPress={() => setShowSettings(true)}
            onSectionChange={setSection}
            onThreadRelationChange={setThreadRelation}
            onSaveCollectionChange={setSaveCollection}
            onSaveKindChange={setSaveKind}
            profile={displayedProfile}
          />
        )}
      </ScrollView>
      <BottomNavigation
        items={mainTabs}
        profileAvatar={
          displayedProfile
            ? {
                color: displayedProfile.avatarColor,
                imageSource: displayedProfile.avatarUrl
                  ? { uri: displayedProfile.avatarUrl }
                  : undefined,
                label: displayedProfile.displayName
              }
            : undefined
        }
        onChange={(value) => {
          if (value === "compose" && !requireAccount("publish your own writing")) return;
          if (value === "inbox" && !requireAccount("open your inbox")) return;
          router.push(tabRoutes[value]);
        }}
        value="profile"
      />
      <ExperienceSheet
        experience={displayedProfile?.experience}
        onClose={() => setShowExperience(false)}
        visible={showExperience}
      />
      <ConnectionSheet
        isLoading={connectionsQuery.isLoading}
        kind={connectionKind}
        onClose={() => setConnectionKind(null)}
        page={connectionsQuery.data}
      />
      <ProfileSettingsSheet
        onClose={() => setShowSettings(false)}
        onEditProfile={() => {
          setShowSettings(false);
          if (requireAccount("edit your profile")) router.push("/profile/edit" as Href);
        }}
        onChangePassword={() => {
          setShowSettings(false);
          if (requireAccount("change your password")) setShowPasswordChange(true);
        }}
        onLogout={() => {
          setShowSettings(false);
          void logout();
        }}
        visible={showSettings}
      />
      <PasswordChangeSheet
        onClose={() => setShowPasswordChange(false)}
        onSubmit={changePassword}
        visible={showPasswordChange}
      />
      <ManagePostSheet
        error={deletePost.isError}
        item={managedPost}
        onClose={() => {
          deletePost.reset();
          setManagedPost(null);
        }}
        onDelete={(poemId) => deletePost.mutate(poemId)}
        onEdit={(poemId) => {
          setManagedPost(null);
          router.push({
            pathname: "/(tabs)/compose",
            params: { type: "post", session: `edit-${poemId}-${Date.now()}`, editPostId: poemId }
          } as unknown as Href);
        }}
        pending={deletePost.isPending}
      />
      <ManageThreadSheet
        error={deleteThread.isError}
        item={managedThread}
        onClose={() => {
          deleteThread.reset();
          setManagedThread(null);
        }}
        onDelete={(threadId) => deleteThread.mutate(threadId)}
        onEdit={(threadId) => {
          setManagedThread(null);
          router.push({
            pathname: "/(tabs)/compose",
            params: { type: "thread", session: `edit-thread-${threadId}-${Date.now()}`, editThreadId: threadId }
          } as unknown as Href);
        }}
        pending={deleteThread.isPending}
      />
    </AppScreen>
  );
}

function ProfileLoaded({
  profile,
  experience,
  isOwner,
  items,
  itemSection,
  draftsCount,
  contentQuery,
  onConnectionsPress,
  onExperiencePress,
  onLikesAndSavesPress,
  onManagePost,
  onManageThread,
  onSettingsPress,
  onSectionChange,
  onThreadRelationChange,
  onSaveCollectionChange,
  onSaveKindChange
}: {
  profile: UserProfileDetails;
  experience: UserExperience;
  isOwner: boolean;
  items: UserProfileContentItem[];
  itemSection: UserProfileContentSection;
  draftsCount: number;
  contentQuery: { isLoading: boolean; isError: boolean; data?: { visible: boolean } };
  onConnectionsPress: (kind: UserConnectionKind) => void;
  onExperiencePress: () => void;
  onLikesAndSavesPress: () => void;
  onManagePost: (item: UserProfileContentItem) => void;
  onManageThread: (item: UserProfileContentItem) => void;
  onSettingsPress: () => void;
  onSectionChange: (section: UserProfileContentSection) => void;
  onThreadRelationChange: (relation: UserThreadRelation) => void;
  onSaveCollectionChange: (collection: UserCollectionKind) => void;
  onSaveKindChange: (kind: "post" | "thread" | "comment") => void;
}) {
  const [threadRelation, setThreadRelation] = useState<UserThreadRelation>("started");
  const [saveCollection, setSaveCollection] = useState<UserCollectionKind>("liked");
  const [saveKind, setSaveKind] = useState<"post" | "thread" | "comment">("post");
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [enter]);

  return (
    <Animated.View
      style={[
        styles.loaded,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] })
            }
          ]
        }
      ]}
    >
      <ProfileHero
        experience={experience}
        isOwner={isOwner}
        onConnectionsPress={onConnectionsPress}
        onExperiencePress={onExperiencePress}
        onLikesAndSavesPress={onLikesAndSavesPress}
        onSettingsPress={onSettingsPress}
        profile={profile}
      />
      <View style={styles.contentPanel}>
        <ProfileContentTabs section={itemSection} onChange={onSectionChange} />
        {itemSection === "threads" ? (
          <SubTabs
            labels={["started", "participated"]}
            onChange={(value) => {
              setThreadRelation(value);
              onThreadRelationChange(value);
            }}
            value={threadRelation}
          />
        ) : null}
        {itemSection === "saves" ? (
          <>
            <SubTabs
              labels={["liked", "saved"]}
              onChange={(value) => {
                setSaveCollection(value);
                onSaveCollectionChange(value);
              }}
              value={saveCollection}
            />
            <SubTabs
              labels={["post", "thread", "comment"]}
              onChange={(value) => {
                setSaveKind(value);
                onSaveKindChange(value);
              }}
              value={saveKind}
            />
          </>
        ) : null}
        {itemSection === "posts" && isOwner ? (
          <DraftEntry
            count={draftsCount}
            onPress={() => router.push("/profile/drafts" as Href)}
          />
        ) : null}
        {contentQuery.isLoading ? (
          <View style={styles.contentLoading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : !contentQuery.data?.visible ? (
          <EmptyState body="This section is private." title="Only the author can see it" />
        ) : contentQuery.isError ? (
          <EmptyState
            body="This profile section could not be loaded."
            title="Content unavailable"
          />
        ) : items.length === 0 ? (
          <EmptyState body="Content returned by this section will appear here." title={`No ${itemSection} yet`} />
        ) : (
          <View style={styles.itemStack}>
            {items.map((item) => (
              <ProfileContentCard
                item={item}
                key={item.id}
                onManage={
                  isOwner && itemSection === "posts" && item.kind === "post"
                    ? onManagePost
                    : isOwner &&
                        itemSection === "threads" &&
                        item.kind === "thread" &&
                        item.threadRelation === "started"
                      ? onManageThread
                      : undefined
                }
              />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function ProfileHero({
  profile,
  experience,
  isOwner,
  onConnectionsPress,
  onExperiencePress,
  onLikesAndSavesPress,
  onSettingsPress
}: {
  profile: UserProfileDetails;
  experience: UserExperience;
  isOwner: boolean;
  onConnectionsPress: (kind: UserConnectionKind) => void;
  onExperiencePress: () => void;
  onLikesAndSavesPress: () => void;
  onSettingsPress: () => void;
}) {
  const avatarSource = profile.avatarUrl ? { uri: profile.avatarUrl } : profileAvatarArtwork;
  return (
    <View style={styles.hero}>
      <Image resizeMode="cover" source={profileHeaderArtwork} style={styles.heroBackground} />
      <View style={styles.heroShade} />
      <View style={styles.heroActions}>
        <Pressable
          accessibilityLabel={isOwner ? "Open profile settings" : "Open profile menu"}
          hitSlop={12}
          onPress={isOwner ? onSettingsPress : undefined}
          style={styles.iconButton}
        >
          <MenuIcon />
        </Pressable>
        <View style={styles.heroActionsRight}>
          <Pressable accessibilityLabel="Search" hitSlop={12} style={styles.iconButton}>
            <SearchIcon height={22} width={22} />
          </Pressable>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Profile settings"
              hitSlop={12}
              onPress={onSettingsPress}
              style={styles.iconButton}
            >
              <SettingsIcon />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.identityRow}>
        <View style={styles.avatarFrame}>
          <Image resizeMode="cover" source={avatarSource} style={styles.avatarImage} />
          <View style={styles.avatarSpark} />
        </View>
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.displayName}>{profile.displayName}</Text>
            <Pressable onPress={onExperiencePress} style={styles.levelButton}>
              <LevelMark level={experience.level} size={27} />
              <Text style={styles.levelText}>Level {experience.level}</Text>
            </Pressable>
          </View>
          <Text style={styles.linespaceId}>linespace ID · {profile.linespaceId}</Text>
          <Text numberOfLines={2} style={styles.bio}>{profile.bio || "No signature yet"}</Text>
        </View>
      </View>
      <Pressable onPress={onExperiencePress} style={styles.experienceBarCard}>
        <View style={styles.experienceBarHeader}>
          <Text style={styles.experienceBarTitle}>Ink journey</Text>
          <Text style={styles.experienceTotal}>{experience.total} XP{experience.nextLevelAt ? ` · ${experience.nextLevelAt - experience.total} to next` : " · max level"}</Text>
        </View>
        <View style={styles.experienceTrack}>
          <View style={[styles.experienceFill, { width: `${Math.round(experience.levelProgress * 100)}%` }]} />
        </View>
      </Pressable>
      <BadgeGallery badges={profile.badges} experience={experience} />
      <View style={styles.statsRow}>
        <ProfileStat label="followers" onPress={() => onConnectionsPress("followers")} value={profile.stats.followers} />
        <ProfileStat label="following" onPress={() => onConnectionsPress("following")} value={profile.stats.following} />
        <ProfileStat label="likes & saves" onPress={onLikesAndSavesPress} value={profile.stats.likesAndSaves} />
      </View>
    </View>
  );
}

function LevelMark({ level, size = 34 }: { level: number; size?: number }) {
  const shades = ["#E8E4DD", "#D9D3C9", "#C9C0B3", "#B6AA9B", "#9C8D7B", "#837362", "#685746", "#4E3D31", "#342A23", "#1F1915", "#0B0A09"];
  const tone = shades[Math.max(0, Math.min(10, level))] ?? shades[0];
  return (
    <View style={[styles.levelMark, { backgroundColor: tone, height: size, width: size, borderRadius: size / 2 }]}>
      <View style={[styles.levelMarkInner, { borderRadius: size / 2, height: size * 0.58, width: size * 0.58 }]} />
    </View>
  );
}

function BadgeGallery({
  badges,
  experience
}: {
  badges: UserProfileDetails["badges"];
  experience: UserExperience;
}) {
  const [selectedBadge, setSelectedBadge] = useState<BadgeVariant | null>(null);
  const detailEnter = useRef(new Animated.Value(0)).current;
  const detailScale = useRef(new Animated.Value(0)).current;
  const creatorUnlocked = experience.creator >= badgeUnlockXp || badges.some((badge) => badge.category === "creator" || badge.id === "badge-ink-weaver");
  const reviewerUnlocked = experience.reviewer >= badgeUnlockXp || badges.some((badge) => badge.category === "reviewer" || badge.id === "badge-soul-echo");

  useEffect(() => {
    if (!selectedBadge) return;
    detailEnter.setValue(0);
    detailScale.setValue(0);
    Animated.parallel([
      Animated.timing(detailEnter, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(detailScale, {
        toValue: 1,
        damping: 12,
        stiffness: 150,
        useNativeDriver: true
      })
    ]).start();
  }, [detailEnter, detailScale, selectedBadge]);

  const toggleBadge = (variant: BadgeVariant) => {
    if (selectedBadge !== variant) {
      detailEnter.stopAnimation();
      detailScale.stopAnimation();
      setSelectedBadge(variant);
      return;
    }
    Animated.parallel([
      Animated.timing(detailEnter, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(detailScale, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        setSelectedBadge((current) => current === variant ? null : current);
      }
    });
  };

  const selectedXp = selectedBadge === "creator" ? experience.creator : experience.reviewer;
  const selectedUnlocked = selectedBadge === "creator" ? creatorUnlocked : reviewerUnlocked;

  return (
    <View style={styles.badgeGallery}>
      <View style={styles.badgeSectionHeader}>
        <Text style={styles.badgeSectionLabel}>EARNED MARKS</Text>
        <Text style={styles.badgeSectionHint}>tap a badge to explore</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRail}>
        <BadgeCard label="Ink Weaver" onPress={() => toggleBadge("creator")} selected={selectedBadge === "creator"} subtitle="Creator certification" unlocked={creatorUnlocked} remaining={Math.max(0, badgeUnlockXp - experience.creator)} variant="creator" />
        <BadgeCard label="Soul Echo" onPress={() => toggleBadge("reviewer")} selected={selectedBadge === "reviewer"} subtitle="Reviewer certification" unlocked={reviewerUnlocked} remaining={Math.max(0, badgeUnlockXp - experience.reviewer)} variant="reviewer" />
      </ScrollView>
      {selectedBadge ? (
        <Animated.View
          style={[
            styles.badgeDetailMotion,
            {
              opacity: detailEnter,
              transform: [
                { translateY: detailEnter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                { scale: detailScale.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }
              ]
            }
          ]}
        >
          <BadgeDetail experience={selectedXp} onClose={() => toggleBadge(selectedBadge)} unlocked={selectedUnlocked} variant={selectedBadge} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function BadgeCard({
  label,
  subtitle,
  unlocked,
  remaining,
  variant,
  selected,
  onPress
}: {
  label: string;
  subtitle: string;
  unlocked: boolean;
  remaining: number;
  variant: BadgeVariant;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Shows badge details and unlock progress"
      accessibilityRole="button"
      accessibilityState={{ expanded: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.badgeCard, selected && styles.badgeCardSelected, !unlocked && styles.badgeCardLocked, pressed && styles.badgeCardPressed]}
    >
      <ProfileBadgeArtwork muted={!unlocked} size={52} variant={variant} />
      <View style={styles.badgeCardCopy}>
        <Text style={styles.badgeCardTitle}>{label}</Text>
        <Text style={styles.badgeCardSubtitle}>{unlocked ? subtitle : `${remaining} XP to unlock`}</Text>
      </View>
    </Pressable>
  );
}

function BadgeDetail({
  variant,
  experience,
  unlocked,
  onClose
}: {
  variant: BadgeVariant;
  experience: number;
  unlocked: boolean;
  onClose: () => void;
}) {
  const detail = badgeDetails[variant];
  const progress = Math.min(1, Math.max(0, experience / badgeUnlockXp));
  const remaining = Math.max(0, badgeUnlockXp - experience);

  return (
    <View style={[styles.badgeDetail, variant === "creator" ? styles.badgeDetailCreator : styles.badgeDetailReviewer]}>
      <Pressable accessibilityLabel="Close badge details" hitSlop={10} onPress={onClose} style={styles.badgeDetailClose}>
        <Text style={styles.badgeDetailCloseText}>×</Text>
      </Pressable>
      <View style={styles.badgeDetailArtwork}>
        <ProfileBadgeDetailArtwork variant={variant} width={144} />
      </View>
      <Text style={styles.badgeDetailDescription}>{detail.description}</Text>
      <View style={styles.badgeEmotionNote}>
        <Text style={styles.badgeEmotionMark}>{variant === "creator" ? "✦" : "♡"}</Text>
        <Text style={styles.badgeEmotionText}>{detail.emotionalNote}</Text>
      </View>
      <View style={styles.badgeProgressCard}>
        <View style={styles.badgeProgressHeader}>
          <View style={styles.badgeProgressCopy}>
            <Text style={styles.badgeProgressLabel}>HOW TO EARN</Text>
            <Text style={styles.badgeProgressRequirement}>{detail.requirement}</Text>
          </View>
          <Text style={styles.badgeProgressValue}>{Math.min(experience, badgeUnlockXp)}/{badgeUnlockXp} XP</Text>
        </View>
        <View style={styles.badgeProgressTrack}>
          <View style={[styles.badgeProgressFill, variant === "reviewer" && styles.badgeProgressFillReviewer, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.badgeProgressStatus}>
          {unlocked ? "Award earned — this mark now belongs to your profile." : `${remaining} XP more, and this mark will light up for you.`}
        </Text>
      </View>
    </View>
  );
}

function ProfileStat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
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
      {contentTabs.map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab.value === section }}
          key={tab.value}
          onPress={() => onChange(tab.value)}
          style={styles.tab}
        >
          <Text style={[styles.tabLabel, tab.value === section && styles.tabLabelActive]}>{tab.label}</Text>
          {tab.value === section ? <View style={styles.tabIndicator} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function SubTabs<T extends string>({
  labels,
  value,
  onChange
}: {
  labels: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.subTabs}
      style={styles.subTabsScroll}
    >
      {labels.map((label) => (
        <Pressable
          key={label}
          onPress={() => onChange(label)}
          style={[styles.subTab, label === value && styles.subTabActive]}
        >
          <Text style={[styles.subTabText, label === value && styles.subTabTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function DraftEntry({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.draftEntry, pressed && styles.cardPressed]}
    >
      <View style={styles.draftArtwork}><Text style={styles.draftGlyph}>＋</Text></View>
      <View style={styles.draftCopy}>
        <Text style={styles.draftTitle}>Drafts</Text>
        <Text style={styles.draftSubtitle}>{count ? `${count} saved ${count === 1 ? "draft" : "drafts"}` : "your unfinished lines live here"}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ProfileContentCard({
  item,
  onManage
}: {
  item: UserProfileContentItem;
  onManage?: (item: UserProfileContentItem) => void;
}) {
  const open = () => {
    if (item.threadId) {
      router.push({ pathname: "/thread/[id]", params: { id: item.threadId } } as unknown as Href);
      return;
    }
    if (item.poemId) {
      router.push({
        pathname: "/poem/[id]",
        params: {
          id: item.poemId,
          commentId: item.commentId,
          targetKind: item.kind === "comment" ? "comment" : "post"
        }
      } as unknown as Href);
    }
  };
  if (item.kind === "thread") {
    return (
      <Pressable onPress={open} style={({ pressed }) => [styles.threadCard, pressed && styles.cardPressed]}>
        {onManage ? (
          <Pressable
            accessibilityLabel={`Manage ${item.title}`}
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              onManage(item);
            }}
            style={styles.postManageButton}
          >
            <Text style={styles.postManageGlyph}>•••</Text>
          </Pressable>
        ) : null}
        <View style={styles.threadCardHeader}>
          <Text style={styles.eyebrow}>{item.threadRelation === "started" ? "STARTED" : "JOINED"} · THREAD</Text>
          <Text style={styles.dateText}>{formatProfileDate(item.finishedAt)}</Text>
        </View>
        <Text style={styles.threadTitle}>{item.title}</Text>
        <Text style={styles.threadExcerpt}>{item.excerpt}</Text>
        <Text style={styles.threadHint}>Open thread →</Text>
      </Pressable>
    );
  }
  if (item.kind === "comment") {
    return (
      <Pressable onPress={open} style={({ pressed }) => [styles.commentCard, pressed && styles.cardPressed]}>
        <Text style={styles.commentLabel}>COMMENT</Text>
        <Text style={styles.commentText}>{item.excerpt}</Text>
        {item.reference ? <Text style={styles.commentReference}>in {item.reference.kind === "post" ? "post" : "reply"}: “{item.reference.text}”</Text> : null}
        <Text style={styles.dateText}>{formatProfileDate(item.finishedAt)}</Text>
      </Pressable>
    );
  }
  const imageSource = item.media?.kind === "image"
    ? { uri: item.media.uri }
    : item.artworkUrl
      ? { uri: item.artworkUrl }
      : profilePostArtwork;
  const mediaAspectRatio = item.media?.kind === "image" ? getMediaAspectRatio(item.media) : undefined;
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.postCard, item.muted && styles.mutedCard, pressed && styles.cardPressed]}>
      {onManage ? (
        <Pressable
          accessibilityLabel={`Manage ${item.title}`}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            onManage(item);
          }}
          style={styles.postManageButton}
        >
          <Text style={styles.postManageGlyph}>•••</Text>
        </Pressable>
      ) : null}
      <View style={[styles.postArtworkFrame, mediaAspectRatio ? { aspectRatio: mediaAspectRatio } : undefined]}>
        <Image resizeMode="cover" source={imageSource} style={styles.postArtwork} />
        <View style={styles.postArtworkShade} />
        <Text style={styles.postArtworkLabel}>{item.media?.kind === "image" ? "POST · IMAGE" : "POST"}</Text>
      </View>
      <View style={styles.postCopy}>
        <View style={styles.postHeader}>
          <Text numberOfLines={1} style={styles.postTitle}>{item.title}</Text>
          {item.collection ? <Text style={styles.collectionTag}>{item.collection}</Text> : null}
        </View>
        <Text numberOfLines={3} style={styles.postExcerpt}>{item.excerpt}</Text>
        <View style={styles.postFooter}>
          <Text style={styles.postMeta}>{formatProfileDate(item.finishedAt)}</Text>
          <Text style={styles.postMeta}>{item.highlightCount ?? 0} highlights</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ManagePostSheet({
  item,
  pending,
  error,
  onClose,
  onEdit,
  onDelete
}: {
  item: UserProfileContentItem | null;
  pending: boolean;
  error: boolean;
  onClose: () => void;
  onEdit: (poemId: string) => void;
  onDelete: (poemId: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (!item) setConfirmingDelete(false);
  }, [item]);
  const poemId = item?.poemId;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close post actions" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.managePostSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.managePostEyebrow}>YOUR POST</Text>
          <Text numberOfLines={2} style={styles.managePostTitle}>{item?.title}</Text>
          {confirmingDelete ? (
            <View style={styles.manageConfirmBox}>
              <Text style={styles.manageConfirmTitle}>Delete this post?</Text>
              <Text style={styles.manageConfirmCopy}>The post, its comments, likes and saves will be permanently removed.</Text>
              {error ? <Text style={styles.manageError}>The post could not be deleted. Please try again.</Text> : null}
              <View style={styles.manageActionsRow}>
                <Pressable disabled={pending} onPress={() => setConfirmingDelete(false)} style={styles.manageSecondaryButton}>
                  <Text style={styles.manageSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable disabled={pending || !poemId} onPress={() => poemId && onDelete(poemId)} style={styles.manageDeleteButton}>
                  <Text style={styles.manageDeleteText}>{pending ? "Deleting…" : "Delete"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable disabled={!poemId} onPress={() => poemId && onEdit(poemId)} style={styles.manageActionButton}>
                <Text style={styles.manageActionTitle}>Edit in Compose</Text>
                <Text style={styles.manageActionHint}>Keep the same post, comments and engagement</Text>
              </Pressable>
              <Pressable disabled={!poemId} onPress={() => setConfirmingDelete(true)} style={[styles.manageActionButton, styles.manageDangerAction]}>
                <Text style={styles.manageDangerTitle}>Delete post</Text>
                <Text style={styles.manageActionHint}>A confirmation is required</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ManageThreadSheet({
  item,
  pending,
  error,
  onClose,
  onEdit,
  onDelete
}: {
  item: UserProfileContentItem | null;
  pending: boolean;
  error: boolean;
  onClose: () => void;
  onEdit: (threadId: string) => void;
  onDelete: (threadId: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (!item) setConfirmingDelete(false);
  }, [item]);
  const threadId = item?.threadId;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(item)}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close thread actions" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.managePostSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.managePostEyebrow}>YOUR STARTED THREAD</Text>
          <Text numberOfLines={2} style={styles.managePostTitle}>{item?.title}</Text>
          {confirmingDelete ? (
            <View style={styles.manageConfirmBox}>
              <Text style={styles.manageConfirmTitle}>Delete this thread?</Text>
              <Text style={styles.manageConfirmCopy}>
                Its continuation tree, versions, likes and saves will be permanently removed.
              </Text>
              {error ? <Text style={styles.manageError}>The thread could not be deleted. Please try again.</Text> : null}
              <View style={styles.manageActionsRow}>
                <Pressable disabled={pending} onPress={() => setConfirmingDelete(false)} style={styles.manageSecondaryButton}>
                  <Text style={styles.manageSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable disabled={pending || !threadId} onPress={() => threadId && onDelete(threadId)} style={styles.manageDeleteButton}>
                  <Text style={styles.manageDeleteText}>{pending ? "Deleting…" : "Delete"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable disabled={!threadId} onPress={() => threadId && onEdit(threadId)} style={styles.manageActionButton}>
                <Text style={styles.manageActionTitle}>Edit thread setup</Text>
                <Text style={styles.manageActionHint}>Update title, first line, rules, tags and visibility</Text>
              </Pressable>
              <Pressable disabled={!threadId} onPress={() => setConfirmingDelete(true)} style={[styles.manageActionButton, styles.manageDangerAction]}>
                <Text style={styles.manageDangerTitle}>Delete thread</Text>
                <Text style={styles.manageActionHint}>Only threads you started can be deleted</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ProfileSettingsSheet({
  visible,
  onClose,
  onEditProfile,
  onChangePassword,
  onLogout
}: {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    if (!visible) setConfirmingLogout(false);
  }, [visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close settings" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.settingsSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>YOUR SPACE</Text>
              <Text style={styles.sheetTitle}>Settings</Text>
            </View>
            <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose}>
              <Text style={styles.closeGlyph}>×</Text>
            </Pressable>
          </View>
          {confirmingLogout ? (
            <View style={styles.logoutConfirm}>
              <View style={styles.logoutConfirmMark}>
                <Text style={styles.logoutConfirmGlyph}>↗</Text>
              </View>
              <Text style={styles.logoutConfirmTitle}>Leave this session?</Text>
              <Text style={styles.logoutConfirmCopy}>
                Your poems stay safe. You can return whenever you are ready.
              </Text>
              <View style={styles.logoutConfirmActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingLogout(false)}
                  style={styles.logoutCancel}
                >
                  <Text style={styles.logoutCancelText}>Keep writing</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onLogout}
                  style={styles.logoutConfirmButton}
                >
                  <Text style={styles.logoutConfirmButtonText}>Log out</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.settingsIntro}>
                Keep your profile close to how you want to be found.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onEditProfile}
                style={({ pressed }) => [styles.settingsRow, pressed && styles.cardPressed]}
              >
                <View style={styles.settingsRowIcon}>
                  <Text style={styles.settingsRowGlyph}>✎</Text>
                </View>
                <View style={styles.settingsRowCopy}>
                  <Text style={styles.settingsRowTitle}>Edit profile</Text>
                  <Text style={styles.settingsRowSubtitle}>Name, bio, avatar and visibility</Text>
                </View>
                <Text style={styles.settingsChevron}>›</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onChangePassword}
                style={({ pressed }) => [styles.settingsRow, pressed && styles.cardPressed]}
              >
                <View style={[styles.settingsRowIcon, styles.passwordRowIcon]}>
                  <Text style={styles.settingsRowGlyph}>◇</Text>
                </View>
                <View style={styles.settingsRowCopy}>
                  <Text style={styles.settingsRowTitle}>Change password</Text>
                  <Text style={styles.settingsRowSubtitle}>Keep your LineSpace account secure</Text>
                </View>
                <Text style={styles.settingsChevron}>›</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmingLogout(true)}
                style={({ pressed }) => [
                  styles.settingsRow,
                  styles.settingsDangerRow,
                  pressed && styles.cardPressed
                ]}
              >
                <View style={[styles.settingsRowIcon, styles.settingsDangerIcon]}>
                  <Text style={[styles.settingsRowGlyph, styles.settingsDangerGlyph]}>↗</Text>
                </View>
                <View style={styles.settingsRowCopy}>
                  <Text style={[styles.settingsRowTitle, styles.settingsDangerTitle]}>Log out</Text>
                  <Text style={styles.settingsRowSubtitle}>End this session on this device</Text>
                </View>
                <Text style={[styles.settingsChevron, styles.settingsDangerTitle]}>›</Text>
              </Pressable>
            </>
          )}
          <Text style={styles.settingsVersion}>LineSpace · made for lines in progress</Text>
        </View>
      </View>
    </Modal>
  );
}

function PasswordChangeSheet({
  visible,
  onClose,
  onSubmit
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswords(false);
    setSubmitting(false);
    setError(null);
    setSaved(false);
  }, [visible]);

  const submit = async () => {
    if (submitting) return;
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Choose a password different from your current password.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Use 8–128 characters with uppercase, lowercase, and a number.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ currentPassword, newPassword, confirmPassword });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password could not be changed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close password settings" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.passwordSheet}>
          <View style={styles.sheetHandle} />
          {saved ? (
            <View style={styles.passwordSuccess}>
              <View style={styles.passwordSuccessMark}><Text style={styles.passwordSuccessGlyph}>✓</Text></View>
              <Text style={styles.passwordSuccessTitle}>Password updated</Text>
              <Text style={styles.passwordSuccessCopy}>Your new password is ready for the next time you sign in.</Text>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.passwordPrimaryButton}>
                <Text style={styles.passwordPrimaryText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetEyebrow}>ACCOUNT SECURITY</Text>
                  <Text style={styles.sheetTitle}>Change password</Text>
                </View>
                <Pressable accessibilityLabel="Close" disabled={submitting} hitSlop={10} onPress={onClose}>
                  <Text style={styles.closeGlyph}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.settingsIntro}>Confirm your current password, then choose a new one.</Text>
              <PasswordInput label="Current password" onChangeText={setCurrentPassword} secure={!showPasswords} value={currentPassword} />
              <PasswordInput label="New password" onChangeText={setNewPassword} secure={!showPasswords} value={newPassword} />
              <PasswordInput label="Confirm new password" onChangeText={setConfirmPassword} secure={!showPasswords} value={confirmPassword} />
              <Pressable accessibilityRole="button" onPress={() => setShowPasswords((value) => !value)} style={styles.passwordVisibilityButton}>
                <Text style={styles.passwordVisibilityText}>{showPasswords ? "Hide passwords" : "Show passwords"}</Text>
              </Pressable>
              {error ? <Text style={styles.passwordError}>{error}</Text> : null}
              <Text style={styles.passwordHint}>8–128 characters · uppercase · lowercase · number</Text>
              <Pressable
                accessibilityRole="button"
                disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
                onPress={submit}
                style={[styles.passwordPrimaryButton, (submitting || !currentPassword || !newPassword || !confirmPassword) && styles.passwordPrimaryDisabled]}
              >
                <Text style={styles.passwordPrimaryText}>{submitting ? "Updating…" : "Update password"}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function PasswordInput({ label, value, secure, onChangeText }: { label: string; value: string; secure: boolean; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.passwordField}>
      <Text style={styles.passwordFieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder="••••••••"
        placeholderTextColor={colors.profileMuted}
        maxLength={128}
        secureTextEntry={secure}
        style={styles.passwordInput}
        value={value}
      />
    </View>
  );
}

function ExperienceSheet({
  experience,
  visible,
  onClose
}: {
  experience?: UserExperience;
  visible: boolean;
  onClose: () => void;
}) {
  if (!experience) return null;
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close experience" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.experienceSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>LEVEL JOURNEY</Text>
              <Text style={styles.sheetTitle}>Your ink has weight.</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose}><Text style={styles.closeGlyph}>×</Text></Pressable>
          </View>
          <View style={styles.experienceTotalCard}>
            <LevelMark level={experience.level} size={58} />
            <View style={styles.experienceTotalCopy}>
              <Text style={styles.experienceLevel}>Level {experience.level}</Text>
              <Text style={styles.experienceTotalLarge}>{experience.total} XP total</Text>
              <Text style={styles.experienceHint}>{experience.nextLevelAt ? `${experience.nextLevelAt - experience.total} XP until Level ${experience.level + 1}` : "You reached the highest level. XP keeps accumulating."}</Text>
            </View>
          </View>
          <ExperienceCategory label="Creator" value={experience.creator} tone="#B8860B" detail="Publish, participate, and inspire reactions." />
          <ExperienceCategory label="Reviewer" value={experience.reviewer} tone="#475569" detail="Comment, respond, and echo good work." />
          <Text style={styles.experienceRule}>Every 10 XP raises your level. At 20 XP in a category, its badge unlocks.</Text>
        </View>
      </View>
    </Modal>
  );
}

function ExperienceCategory({ label, value, tone, detail }: { label: string; value: number; tone: string; detail: string }) {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryHeading}><Text style={styles.categoryLabel}>{label}</Text><Text style={styles.categoryValue}>{value} XP</Text></View>
      <View style={styles.categoryTrack}><View style={[styles.categoryFill, { backgroundColor: tone, width: `${Math.min(100, Math.round((value / 20) * 100))}%` }]} /></View>
      <Text style={styles.categoryDetail}>{detail}</Text>
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
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={kind !== null}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close list" onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>PEOPLE</Text>
              <Text style={styles.sheetTitle}>{kind ?? "connections"}</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={onClose}><Text style={styles.closeGlyph}>×</Text></Pressable>
          </View>
          {isLoading ? (
            <View style={styles.sheetLoading}><ActivityIndicator color={colors.ink} /></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {(page?.items ?? []).map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => router.push({ pathname: "/profile/[id]", params: { id: person.id } } as unknown as Href)}
                  style={({ pressed }) => [styles.connectionRow, pressed && styles.cardPressed]}
                >
                  <Avatar color={person.avatarColor} imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined} label={person.displayName} size={44} />
                  <View style={styles.connectionCopy}>
                    <Text style={styles.connectionName}>{person.displayName}</Text>
                    <Text style={styles.connectionHandle}>@{person.handle}</Text>
                    {person.bio ? <Text numberOfLines={1} style={styles.connectionBio}>{person.bio}</Text> : null}
                  </View>
                  <Text style={styles.connectionArrow}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatProfileDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return `${date.getFullYear()}/${`${date.getMonth() + 1}`.padStart(2, "0")}/${`${date.getDate()}`.padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { backgroundColor: colors.profileCanvas, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 108 },
  loaded: { backgroundColor: colors.profileCanvas },
  loadingState: { alignItems: "center", justifyContent: "center", minHeight: 680 },
  errorState: { justifyContent: "center", minHeight: 680, paddingHorizontal: spacing.lg },
  hero: { backgroundColor: "#F0EDE6", minHeight: 390, overflow: "hidden", paddingBottom: 22 },
  heroBackground: { ...StyleSheet.absoluteFillObject, height: 370, opacity: 0.2, width: "100%" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(250,249,246,0.18)" },
  heroActions: { alignItems: "center", flexDirection: "row", height: 58, justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 10 },
  heroActionsRight: { flexDirection: "row", gap: 10 },
  iconButton: { alignItems: "center", borderRadius: radius.pill, height: 34, justifyContent: "center", width: 34 },
  identityRow: { alignItems: "flex-start", flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: 19 },
  avatarFrame: { position: "relative" },
  avatarImage: { backgroundColor: colors.faint, borderColor: colors.white, borderRadius: 43, borderWidth: 3, height: 86, width: 86 },
  avatarSpark: { backgroundColor: "#F8B500", borderColor: "#F0EDE6", borderRadius: 6, borderWidth: 2, bottom: 4, height: 12, position: "absolute", right: 2, width: 12 },
  identityCopy: { flex: 1, marginLeft: 15, minWidth: 0, paddingTop: 4 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  displayName: { color: colors.ink, flexShrink: 1, fontSize: 25, fontWeight: "700", lineHeight: 30 },
  levelButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.65)", borderColor: "rgba(21,21,21,0.12)", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 6, paddingVertical: 4 },
  levelText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  levelMark: { alignItems: "center", justifyContent: "center" },
  levelMarkInner: { backgroundColor: "rgba(255,255,255,0.58)", borderColor: "rgba(255,255,255,0.75)", borderWidth: 1 },
  linespaceId: { color: colors.profileMuted, fontSize: 11, marginTop: 6 },
  bio: { color: colors.ink, fontSize: 15, lineHeight: 20, marginTop: 4 },
  experienceBarCard: { backgroundColor: "rgba(255,255,255,0.6)", borderColor: "rgba(21,21,21,0.08)", borderRadius: 15, borderWidth: 1, marginHorizontal: spacing.lg, marginTop: 18, padding: 12 },
  experienceBarHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  experienceBarTitle: { color: colors.ink, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  experienceTotal: { color: colors.profileMuted, fontSize: 11 },
  experienceTrack: { backgroundColor: "rgba(21,21,21,0.1)", borderRadius: 4, height: 7, marginTop: 9, overflow: "hidden" },
  experienceFill: { backgroundColor: colors.ink, borderRadius: 4, height: "100%" },
  badgeGallery: { marginTop: 17 },
  badgeSectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  badgeSectionLabel: { color: colors.profileMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  badgeSectionHint: { color: colors.profileMuted, fontSize: 9, fontStyle: "italic", opacity: 0.8 },
  badgeRail: { gap: 10, paddingHorizontal: spacing.lg, paddingTop: 8 },
  badgeCard: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.72)", borderColor: "rgba(21,21,21,0.08)", borderRadius: 15, borderWidth: 1, flexDirection: "row", minHeight: 72, paddingHorizontal: 8, width: 190 },
  badgeCardSelected: { backgroundColor: "rgba(255,255,255,0.94)", borderColor: "rgba(184,134,11,0.34)", shadowColor: colors.black, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 10 },
  badgeCardPressed: { transform: [{ scale: 0.985 }] },
  badgeCardLocked: { opacity: 0.62 },
  badgeCardCopy: { flex: 1, marginLeft: 3 },
  badgeCardTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  badgeCardSubtitle: { color: colors.profileMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  badgeDetailMotion: { marginHorizontal: spacing.lg, marginTop: 10 },
  badgeDetail: { alignItems: "center", borderColor: "rgba(21,21,21,0.08)", borderRadius: 22, borderWidth: 1, overflow: "hidden", paddingBottom: 18, paddingHorizontal: 17, paddingTop: 12, position: "relative" },
  badgeDetailCreator: { backgroundColor: "#FFF9E9" },
  badgeDetailReviewer: { backgroundColor: "#F3F4F8" },
  badgeDetailClose: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 16, height: 32, justifyContent: "center", position: "absolute", right: 10, top: 10, width: 32, zIndex: 2 },
  badgeDetailCloseText: { color: colors.ink, fontSize: 22, fontWeight: "300", lineHeight: 25 },
  badgeDetailArtwork: { alignItems: "center", height: 175, justifyContent: "center", overflow: "hidden" },
  badgeDetailDescription: { color: colors.inkSoft, fontSize: 13, lineHeight: 21, marginTop: 5, textAlign: "center" },
  badgeEmotionNote: { alignItems: "flex-start", backgroundColor: "rgba(255,255,255,0.62)", borderRadius: 14, flexDirection: "row", gap: 9, marginTop: 13, paddingHorizontal: 13, paddingVertical: 11, width: "100%" },
  badgeEmotionMark: { color: "#B8860B", fontSize: 16, lineHeight: 20 },
  badgeEmotionText: { color: colors.ink, flex: 1, fontFamily: "Georgia", fontSize: 12, fontStyle: "italic", lineHeight: 19 },
  badgeProgressCard: { backgroundColor: "rgba(255,255,255,0.76)", borderColor: "rgba(21,21,21,0.07)", borderRadius: 15, borderWidth: 1, marginTop: 11, padding: 12, width: "100%" },
  badgeProgressHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  badgeProgressCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  badgeProgressLabel: { color: colors.profileMuted, fontSize: 8, fontWeight: "800", letterSpacing: 1.25 },
  badgeProgressRequirement: { color: colors.ink, fontSize: 12, fontWeight: "700", marginTop: 4 },
  badgeProgressValue: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  badgeProgressTrack: { backgroundColor: "rgba(21,21,21,0.1)", borderRadius: 4, height: 6, marginTop: 11, overflow: "hidden" },
  badgeProgressFill: { backgroundColor: "#D9A928", borderRadius: 4, height: "100%" },
  badgeProgressFillReviewer: { backgroundColor: "#65758A" },
  badgeProgressStatus: { color: colors.profileMuted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  statsRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 9, paddingHorizontal: spacing.lg },
  stat: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 39, width: "31%" },
  statPressed: { backgroundColor: "rgba(255,255,255,0.62)" },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: "700", lineHeight: 24 },
  statLabel: { color: colors.profileMuted, fontSize: 11, lineHeight: 14, marginTop: 1 },
  contentPanel: { backgroundColor: colors.profileCanvas, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -1, minHeight: 580, paddingBottom: 24 },
  tabs: { alignItems: "center", borderBottomColor: "rgba(21,21,21,0.08)", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 48, paddingHorizontal: 12, paddingTop: 2 },
  tab: { alignItems: "center", flex: 1, height: 45, justifyContent: "center", position: "relative" },
  tabLabel: { color: colors.tabMuted, fontSize: 13, fontWeight: "600" },
  tabLabelActive: { color: colors.ink, fontWeight: "800" },
  tabIndicator: { backgroundColor: colors.ink, borderRadius: 2, bottom: 0, height: 3, position: "absolute", width: 22 },
  subTabsScroll: { flexGrow: 0, height: 43 },
  subTabs: { alignItems: "center", gap: 7, paddingHorizontal: spacing.lg, paddingVertical: 5 },
  subTab: { backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 5 },
  subTabActive: { backgroundColor: colors.ink },
  subTabText: { color: colors.tabMuted, fontSize: 11, fontWeight: "600" },
  subTabTextActive: { color: colors.white },
  draftEntry: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.7)", borderColor: "rgba(21,21,21,0.1)", borderRadius: 17, borderWidth: 1, flexDirection: "row", marginBottom: 15, marginHorizontal: spacing.lg, padding: 12 },
  draftArtwork: { alignItems: "center", backgroundColor: "#E4DED2", borderRadius: 13, height: 60, justifyContent: "center", width: 60 },
  draftGlyph: { color: colors.ink, fontSize: 28, fontWeight: "300" },
  draftCopy: { flex: 1, marginLeft: 13 },
  draftTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  draftSubtitle: { color: colors.profileMuted, fontSize: 11, marginTop: 4 },
  chevron: { color: colors.ink, fontSize: 27, fontWeight: "300" },
  itemStack: { gap: 12, paddingHorizontal: spacing.lg, paddingTop: 5 },
  postCard: { backgroundColor: colors.white, borderRadius: 19, overflow: "hidden" },
  postManageButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 17, height: 34, justifyContent: "center", position: "absolute", right: 10, top: 10, width: 42, zIndex: 3 },
  postManageGlyph: { color: colors.ink, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  mutedCard: { opacity: 0.46 },
  postArtworkFrame: { backgroundColor: colors.faint, height: 164, overflow: "hidden" },
  postArtwork: { height: "100%", width: "100%" },
  postArtworkShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  postArtworkLabel: { bottom: 11, color: colors.white, fontSize: 10, fontWeight: "700", left: 13, letterSpacing: 1 },
  postCopy: { paddingHorizontal: 15, paddingVertical: 13 },
  postHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  postTitle: { color: colors.ink, flex: 1, fontSize: 20, fontWeight: "700" },
  collectionTag: { backgroundColor: colors.surfaceWarm, borderRadius: radius.pill, color: colors.profileMuted, fontSize: 10, marginLeft: 8, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  postExcerpt: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 7 },
  postFooter: { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", marginTop: 13, paddingTop: 9 },
  postMeta: { color: colors.profileMuted, fontSize: 11 },
  threadCard: { backgroundColor: colors.white, borderRadius: 19, padding: 17, position: "relative" },
  threadCardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingRight: 48 },
  eyebrow: { color: colors.profileMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  dateText: { color: colors.profileMuted, fontSize: 11 },
  threadTitle: { color: colors.ink, fontSize: 19, fontWeight: "700", marginTop: 12 },
  threadExcerpt: { color: colors.ink, fontSize: 15, lineHeight: 22, marginTop: 7 },
  threadHint: { color: colors.accent, fontSize: 12, fontWeight: "700", marginTop: 13 },
  commentCard: { backgroundColor: colors.white, borderRadius: 19, padding: 17 },
  commentLabel: { color: colors.profileMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  commentText: { color: colors.ink, fontSize: 19, fontWeight: "700", lineHeight: 27, marginTop: 11 },
  commentReference: { color: colors.profileMuted, fontSize: 12, lineHeight: 18, marginTop: 11 },
  cardPressed: { opacity: 0.72 },
  contentLoading: { alignItems: "center", justifyContent: "center", minHeight: 220 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  managePostSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 30, paddingHorizontal: spacing.lg },
  managePostEyebrow: { color: colors.profileMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 16 },
  managePostTitle: { color: colors.ink, fontSize: 23, fontWeight: "700", lineHeight: 29, marginBottom: 18, marginTop: 5 },
  manageActionButton: { backgroundColor: colors.white, borderColor: "rgba(21,21,21,0.08)", borderRadius: 17, borderWidth: 1, marginTop: 9, paddingHorizontal: 16, paddingVertical: 15 },
  manageActionTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  manageActionHint: { color: colors.profileMuted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  manageDangerAction: { backgroundColor: "#FFF8F8", borderColor: "rgba(190,35,50,0.14)" },
  manageDangerTitle: { color: "#B3263B", fontSize: 16, fontWeight: "700" },
  manageConfirmBox: { backgroundColor: "#FFF8F8", borderRadius: 18, padding: 17 },
  manageConfirmTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  manageConfirmCopy: { color: colors.profileMuted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  manageError: { color: "#B3263B", fontSize: 11, marginTop: 10 },
  manageActionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  manageSecondaryButton: { alignItems: "center", backgroundColor: colors.white, borderRadius: 14, flex: 1, paddingVertical: 12 },
  manageSecondaryText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  manageDeleteButton: { alignItems: "center", backgroundColor: "#B3263B", borderRadius: 14, flex: 1, paddingVertical: 12 },
  manageDeleteText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "68%", minHeight: 360, paddingBottom: 24, paddingHorizontal: 20 },
  experienceSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 27, paddingHorizontal: spacing.lg },
  settingsSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
    paddingHorizontal: spacing.lg
  },
  passwordSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 28, paddingHorizontal: spacing.lg },
  sheetHandle: { alignSelf: "center", backgroundColor: colors.faint, borderRadius: radius.pill, height: 4, marginTop: 9, width: 42 },
  sheetHeader: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 76 },
  sheetEyebrow: { color: colors.profileMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  sheetTitle: { color: colors.ink, fontSize: 24, fontWeight: "700", marginTop: 4 },
  closeGlyph: { color: colors.ink, fontSize: 28, fontWeight: "300" },
  settingsIntro: { color: colors.profileMuted, fontSize: 13, lineHeight: 19, marginTop: 15 },
  settingsRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    minHeight: 72,
    paddingHorizontal: 12
  },
  settingsDangerRow: { backgroundColor: "#FFF7F5", borderColor: "#F6D9D4" },
  settingsRowIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceWarm,
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  settingsDangerIcon: { backgroundColor: "#FFE6E1" },
  passwordRowIcon: { backgroundColor: "#E9EEF7" },
  settingsRowGlyph: { color: colors.ink, fontSize: 21, fontWeight: "500" },
  settingsDangerGlyph: { color: colors.accent, transform: [{ rotate: "90deg" }] },
  settingsRowCopy: { flex: 1, marginLeft: 12 },
  settingsRowTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  settingsDangerTitle: { color: colors.accent },
  settingsRowSubtitle: { color: colors.profileMuted, fontSize: 11, marginTop: 4 },
  settingsChevron: { color: colors.ink, fontSize: 27, fontWeight: "300", marginLeft: 8 },
  logoutConfirm: {
    alignItems: "center",
    backgroundColor: "#FFF7F5",
    borderColor: "#F6D9D4",
    borderRadius: 19,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 20
  },
  logoutConfirmMark: {
    alignItems: "center",
    backgroundColor: "#FFE6E1",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    width: 50
  },
  logoutConfirmGlyph: { color: colors.accent, fontSize: 24, transform: [{ rotate: "90deg" }] },
  logoutConfirmTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: 13 },
  logoutConfirmCopy: { color: colors.profileMuted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: "center" },
  logoutConfirmActions: { flexDirection: "row", gap: 8, marginTop: 17, width: "100%" },
  logoutCancel: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46
  },
  logoutCancelText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  logoutConfirmButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 13,
    flex: 1,
    justifyContent: "center",
    minHeight: 46
  },
  logoutConfirmButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  settingsVersion: { color: colors.profileMuted, fontSize: 10, letterSpacing: 0.3, marginTop: 22, textAlign: "center" },
  passwordField: { marginTop: 14 },
  passwordFieldLabel: { color: colors.ink, fontSize: 11, fontWeight: "800", letterSpacing: 0.3, marginBottom: 7 },
  passwordInput: { backgroundColor: colors.white, borderColor: colors.line, borderRadius: 15, borderWidth: 1, color: colors.ink, fontSize: 16, height: 52, paddingHorizontal: 14 },
  passwordVisibilityButton: { alignSelf: "flex-start", justifyContent: "center", minHeight: 36 },
  passwordVisibilityText: { color: colors.accent, fontSize: 11, fontWeight: "800" },
  passwordError: { backgroundColor: "#FFF0EE", borderRadius: 11, color: "#B3263B", fontSize: 11, lineHeight: 16, paddingHorizontal: 11, paddingVertical: 9 },
  passwordHint: { color: colors.profileMuted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  passwordPrimaryButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 15, justifyContent: "center", marginTop: 16, minHeight: 52, width: "100%" },
  passwordPrimaryDisabled: { opacity: 0.42 },
  passwordPrimaryText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  passwordSuccess: { alignItems: "center", paddingBottom: 4, paddingTop: 22 },
  passwordSuccessMark: { alignItems: "center", backgroundColor: "#E7F5EA", borderRadius: 28, height: 56, justifyContent: "center", width: 56 },
  passwordSuccessGlyph: { color: "#2F7B45", fontSize: 25, fontWeight: "800" },
  passwordSuccessTitle: { color: colors.ink, fontFamily: "Georgia", fontSize: 24, marginTop: 15 },
  passwordSuccessCopy: { color: colors.profileMuted, fontSize: 12, lineHeight: 18, marginTop: 7, textAlign: "center" },
  experienceTotalCard: { alignItems: "center", backgroundColor: colors.surfaceWarm, borderRadius: 18, flexDirection: "row", marginTop: 17, padding: 14 },
  experienceTotalCopy: { flex: 1, marginLeft: 13 },
  experienceLevel: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  experienceTotalLarge: { color: colors.ink, fontSize: 22, fontWeight: "700", marginTop: 2 },
  experienceHint: { color: colors.profileMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  categoryRow: { marginTop: 19 },
  categoryHeading: { flexDirection: "row", justifyContent: "space-between" },
  categoryLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  categoryValue: { color: colors.profileMuted, fontSize: 12, fontWeight: "700" },
  categoryTrack: { backgroundColor: "rgba(21,21,21,0.09)", borderRadius: 3, height: 6, marginTop: 8, overflow: "hidden" },
  categoryFill: { borderRadius: 3, height: "100%" },
  categoryDetail: { color: colors.profileMuted, fontSize: 11, marginTop: 5 },
  experienceRule: { color: colors.profileMuted, fontSize: 11, lineHeight: 17, marginTop: 22 },
  sheetLoading: { alignItems: "center", justifyContent: "center", minHeight: 220 },
  connectionRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 76 },
  connectionCopy: { flex: 1, marginLeft: 12 },
  connectionName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  connectionHandle: { color: colors.profileMuted, fontSize: 12, marginTop: 2 },
  connectionBio: { color: colors.inkSoft, fontSize: 12, marginTop: 3 },
  connectionArrow: { color: colors.ink, fontSize: 24, fontWeight: "300" }
});
