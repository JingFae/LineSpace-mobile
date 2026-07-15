import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  SearchIcon,
  SettingsIcon
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type {
  UserCollectionKind,
  UserConnectionKind,
  UserConnectionPage,
  UserProfileContentItem,
  UserProfileContentSection,
  UserProfileDetails,
  UserThreadRelation
} from "@linespace/api-client";
import { mainTabs, tabRoutes } from "@/navigation/tabs";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";

declare const require: (path: string) => ImageSourcePropType;

const profileHeaderArtwork = require("../../../assets/profile/profile-header-water.png");
const profileAvatarArtwork = require("../../../assets/profile/profile-avatar-water.png");
const profilePostArtwork = require("../../../assets/profile/profile-post-mountain.png");

type ProfileScreenProps = { userId?: string };

const contentTabs: Array<{ value: UserProfileContentSection; label: string }> = [
  { value: "posts", label: "post" },
  { value: "threads", label: "thread" },
  { value: "saves", label: "save" },
  { value: "comments", label: "comment" }
];

export function ProfileScreen({ userId = currentUserId }: ProfileScreenProps) {
  const { logout } = useAuth();
  const isOwner = userId === currentUserId;
  const [section, setSection] = useState<UserProfileContentSection>("posts");
  const [threadRelation, setThreadRelation] = useState<UserThreadRelation>("started");
  const [saveCollection, setSaveCollection] = useState<UserCollectionKind>("liked");
  const [saveKind, setSaveKind] = useState<"post" | "thread" | "comment">("post");
  const [connectionKind, setConnectionKind] = useState<UserConnectionKind | null>(null);

  const profileQuery = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => lineSpaceApi.getUserProfile(userId)
  });
  const contentQuery = useQuery({
    queryKey: ["user-profile-content", userId, section, threadRelation, saveCollection, saveKind],
    queryFn: () =>
      lineSpaceApi.listUserProfileContent(userId, section, {
        viewerId: currentUserId,
        threadRelation: section === "threads" ? threadRelation : undefined,
        collection: section === "saves" ? saveCollection : undefined,
        contentKind: section === "saves" ? saveKind : undefined
      })
  });
  const draftsQuery = useQuery({
    queryKey: ["user-drafts", userId],
    enabled: isOwner,
    queryFn: () => lineSpaceApi.listUserDrafts(userId)
  });
  const connectionsQuery = useQuery({
    queryKey: ["user-connections", userId, connectionKind],
    enabled: connectionKind !== null,
    queryFn: () => lineSpaceApi.listUserConnections(userId, connectionKind!, { limit: 20, viewerId: currentUserId })
  });

  const items = useMemo(() => contentQuery.data?.items ?? [], [contentQuery.data]);

  return (
    <AppScreen contentContainerStyle={styles.screen} padded={false} scroll={false} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={styles.scroll}>
        {profileQuery.isLoading ? (
          <View style={styles.loadingState}><ActivityIndicator color={colors.accent} /></View>
        ) : profileQuery.isError || !profileQuery.data ? (
          <View style={styles.errorState}><EmptyState body="The profile API did not return a user record." title="Profile unavailable" /></View>
        ) : (
          <>
            <ProfileHero
              isOwner={isOwner}
              onConnectionsPress={setConnectionKind}
              onLikesAndSavesPress={() => setSection("saves")}
              onLogoutPress={() =>
                Alert.alert("Log out of LineSpace?", "Your local poems and mock data will stay on this device.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Log out", style: "destructive", onPress: () => void logout() }
                ])
              }
              profile={profileQuery.data}
            />
            <View style={styles.contentPanel}>
              <ProfileContentTabs section={section} onChange={setSection} />
              {section === "threads" ? <SubTabs labels={["started", "participated"]} value={threadRelation} onChange={setThreadRelation} /> : null}
              {section === "saves" ? (
                <>
                  <SubTabs labels={["liked", "saved"]} value={saveCollection} onChange={setSaveCollection} />
                  <SubTabs labels={["post", "thread", "comment"]} value={saveKind} onChange={setSaveKind} />
                </>
              ) : null}
              {section === "posts" && isOwner ? (
                <DraftEntry count={draftsQuery.data?.total ?? 0} onPress={() => router.push("/profile/drafts" as Href)} />
              ) : null}
              {contentQuery.isLoading ? (
                <View style={styles.contentLoading}><ActivityIndicator color={colors.ink} /></View>
              ) : !contentQuery.data?.visible ? (
                <EmptyState body="This section is private." title="Only the author can see it" />
              ) : contentQuery.isError ? (
                <EmptyState body="This profile section could not be loaded." title="Content unavailable" />
              ) : items.length === 0 ? (
                <EmptyState body="Content returned by this section will appear here." title={`No ${section} yet`} />
              ) : (
                <View style={section === "threads" ? styles.singleColumn : styles.itemStack}>
                  {items.map((item) => <ProfileContentCard item={item} key={item.id} />)}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <BottomNavigation
        items={mainTabs}
        profileAvatar={profileQuery.data ? { color: profileQuery.data.avatarColor, imageSource: profileQuery.data.avatarUrl ? { uri: profileQuery.data.avatarUrl } : undefined, label: profileQuery.data.displayName } : undefined}
        onChange={(value) => router.push(tabRoutes[value])}
        value="profile"
      />
      <ConnectionSheet isLoading={connectionsQuery.isLoading} kind={connectionKind} onClose={() => setConnectionKind(null)} page={connectionsQuery.data} />
    </AppScreen>
  );
}

function ProfileHero({ profile, isOwner, onConnectionsPress, onLikesAndSavesPress, onLogoutPress }: { profile: UserProfileDetails; isOwner: boolean; onConnectionsPress: (kind: UserConnectionKind) => void; onLikesAndSavesPress: () => void; onLogoutPress: () => void }) {
  const avatarSource = profile.avatarUrl ? { uri: profile.avatarUrl } : profileAvatarArtwork;
  return (
    <View style={styles.hero}>
      <Image resizeMode="cover" source={profileHeaderArtwork} style={styles.heroBackground} />
      <View style={styles.heroActions}>
        <Pressable accessibilityLabel={isOwner ? "Log out" : "Open profile menu"} hitSlop={12} onPress={isOwner ? onLogoutPress : undefined} style={styles.iconButton}><MenuIcon /></Pressable>
        <View style={styles.heroActionsRight}>
          <Pressable accessibilityLabel="Search" hitSlop={12} style={styles.iconButton}><SearchIcon height={22} width={22} /></Pressable>
          {isOwner ? <Pressable accessibilityLabel="Profile settings" hitSlop={12} onPress={() => router.push("/profile/edit" as Href)} style={styles.iconButton}><SettingsIcon /></Pressable> : null}
        </View>
      </View>
      <View style={styles.identityRow}>
        <Image resizeMode="cover" source={avatarSource} style={styles.avatarImage} />
        <View style={styles.identityCopy}>
          <View style={styles.nameRow}><Text numberOfLines={1} style={styles.displayName}>{profile.displayName}</Text><View style={styles.levelPill}><Text style={styles.levelText}>level.{profile.level}</Text></View>{profile.badges.slice(0, 1).map((badge) => <View key={badge.id} style={styles.badgePill}><Text style={styles.badgeText}>{badge.symbol ? `${badge.symbol} ` : ""}{badge.label}</Text></View>)}</View>
          <Text style={styles.linespaceId}>linespace ID: {profile.linespaceId}</Text>
          <Text numberOfLines={2} style={styles.bio}>{profile.bio || "No signature yet"}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <ProfileStat label="follower" onPress={() => onConnectionsPress("followers")} value={profile.stats.followers} />
        <ProfileStat label="following" onPress={() => onConnectionsPress("following")} value={profile.stats.following} />
        <ProfileStat label="likes & saves" onPress={onLikesAndSavesPress} value={profile.stats.likesAndSaves} />
      </View>
    </View>
  );
}

function ProfileStat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Pressable>;
}

function ProfileContentTabs({ section, onChange }: { section: UserProfileContentSection; onChange: (section: UserProfileContentSection) => void }) {
  return <View style={styles.tabs}>{contentTabs.map((tab) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab.value === section }} key={tab.value} onPress={() => onChange(tab.value)} style={styles.tab}><Text style={[styles.tabLabel, tab.value === section && styles.tabLabelActive]}>{tab.label}</Text></Pressable>)}</View>;
}

function SubTabs<T extends string>({ labels, value, onChange }: { labels: readonly T[]; value: T; onChange: (value: T) => void }) {
  return <View style={styles.subTabs}>{labels.map((label) => <Pressable key={label} onPress={() => onChange(label)} style={[styles.subTab, label === value && styles.subTabActive]}><Text style={[styles.subTabText, label === value && styles.subTabTextActive]}>{label}</Text></Pressable>)}</View>;
}

function DraftEntry({ count, onPress }: { count: number; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.draftEntry, pressed && styles.cardPressed]}><View style={styles.draftArtwork}><Text style={styles.draftGlyph}>+</Text></View><View style={styles.draftCopy}><Text style={styles.draftTitle}>draft</Text><Text style={styles.draftSubtitle}>{count ? `${count} saved ${count === 1 ? "draft" : "drafts"}` : "your unfinished lines live here"}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function ProfileContentCard({ item }: { item: UserProfileContentItem }) {
  const open = () => {
    if (item.threadId) { router.push({ pathname: "/thread/[id]", params: { id: item.threadId } } as unknown as Href); return; }
    if (item.poemId) { router.push({ pathname: "/poem/[id]", params: { id: item.poemId, commentId: item.commentId, targetKind: item.kind === "comment" ? "comment" : "post" } } as unknown as Href); }
  };
  if (item.kind === "thread") return <Pressable onPress={open} style={({ pressed }) => [styles.threadCard, pressed && styles.cardPressed]}><View style={styles.threadCardHeader}><Text style={styles.eyebrow}>{item.threadRelation === "started" ? "started" : "joined"} · thread</Text><Text style={styles.dateText}>{formatProfileDate(item.finishedAt)}</Text></View><Text style={styles.threadTitle}>{item.title}</Text><Text style={styles.threadExcerpt}>{item.excerpt}</Text><Text style={styles.threadHint}>open thread ›</Text></Pressable>;
  if (item.kind === "comment") return <Pressable onPress={open} style={({ pressed }) => [styles.commentCard, pressed && styles.cardPressed]}><Text style={styles.commentText}>{item.excerpt}</Text>{item.reference ? <Text style={styles.commentReference}>in {item.reference.kind === "post" ? "post" : "reply"}: “{item.reference.text}”</Text> : null}<Text style={styles.dateText}>{formatProfileDate(item.finishedAt)}</Text></Pressable>;
  return <Pressable onPress={open} style={({ pressed }) => [styles.postCard, pressed && styles.cardPressed]}><Image resizeMode="cover" source={item.artworkUrl ? { uri: item.artworkUrl } : profilePostArtwork} style={styles.postArtwork} /><View style={styles.postCopy}><Text numberOfLines={1} style={styles.postTitle}>{item.title}</Text><Text numberOfLines={3} style={styles.postExcerpt}>{item.excerpt}</Text><Text style={styles.postMeta}>{formatProfileDate(item.finishedAt)}{item.collection ? ` · ${item.collection}` : ""}</Text></View></Pressable>;
}

function formatProfileDate(value: string) { const date = new Date(value); return `${date.getFullYear()}/${`${date.getMonth() + 1}`.padStart(2, "0")}/${`${date.getDate()}`.padStart(2, "0")}`; }

function ConnectionSheet({ kind, page, isLoading, onClose }: { kind: UserConnectionKind | null; page?: UserConnectionPage; isLoading: boolean; onClose: () => void }) {
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={kind !== null}><View style={styles.modalRoot}><Pressable accessibilityLabel="Close list" onPress={onClose} style={styles.modalBackdrop} /><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{kind ?? "connections"}</Text><Text style={styles.sheetCount}>{page?.total ?? 0} people</Text></View><Pressable accessibilityLabel="Close" onPress={onClose}><Text style={styles.closeGlyph}>×</Text></Pressable></View>{isLoading ? <View style={styles.sheetLoading}><ActivityIndicator color={colors.ink} /></View> : <ScrollView showsVerticalScrollIndicator={false}>{(page?.items ?? []).map((person) => <View key={person.id} style={styles.connectionRow}><Avatar color={person.avatarColor} imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined} label={person.displayName} size={42} /><View style={styles.connectionCopy}><Text style={styles.connectionName}>{person.displayName}</Text><Text style={styles.connectionHandle}>@{person.handle}</Text>{person.bio ? <Text numberOfLines={1} style={styles.connectionBio}>{person.bio}</Text> : null}</View></View>)}</ScrollView>}</View></View></Modal>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas }, screen: { backgroundColor: colors.profileCanvas }, scroll: { flex: 1 }, scrollContent: { paddingBottom: 100 }, loadingState: { minHeight: 640, alignItems: "center", justifyContent: "center" }, errorState: { minHeight: 640, paddingHorizontal: spacing.lg, justifyContent: "center" }, hero: { minHeight: 288, overflow: "hidden", backgroundColor: colors.profileCanvas }, heroBackground: { ...StyleSheet.absoluteFillObject, width: "100%", height: 304, opacity: 0.2 }, heroActions: { height: 48, paddingHorizontal: 18, paddingTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroActionsRight: { flexDirection: "row", gap: 12 }, iconButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.pill }, identityRow: { marginTop: 20, paddingHorizontal: 32, flexDirection: "row", alignItems: "flex-start" }, avatarImage: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.faint }, identityCopy: { flex: 1, minWidth: 0, marginLeft: 16 }, nameRow: { minHeight: 29, flexDirection: "row", alignItems: "center" }, displayName: { maxWidth: 110, marginRight: 4, color: colors.ink, fontSize: 27, lineHeight: 32 }, levelPill: { height: 18, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.black, justifyContent: "center" }, levelText: { color: colors.white, fontSize: 11 }, badgePill: { height: 18, maxWidth: 110, marginLeft: 4, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.badge, justifyContent: "center" }, badgeText: { color: colors.white, fontSize: 10 }, linespaceId: { marginTop: 5, color: colors.ink, fontSize: 11 }, bio: { marginTop: 2, color: colors.ink, fontSize: 16, lineHeight: 21 }, statsRow: { marginTop: 30, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between" }, stat: { width: "31%", minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.md }, statPressed: { backgroundColor: "rgba(255,255,255,0.5)" }, statValue: { color: colors.ink, fontSize: 24, lineHeight: 29 }, statLabel: { color: colors.ink, fontSize: 14 }, contentPanel: { minHeight: 580, paddingBottom: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.profileCanvas }, tabs: { height: 63, paddingTop: 24, paddingHorizontal: 18, flexDirection: "row" }, tab: { flex: 1, height: 38, alignItems: "center", justifyContent: "center" }, tabLabel: { color: colors.tabMuted, fontSize: 19 }, tabLabelActive: { color: colors.ink }, subTabs: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", gap: 8 }, subTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.5)" }, subTabActive: { backgroundColor: colors.ink }, subTabText: { color: colors.tabMuted, fontSize: 12 }, subTabTextActive: { color: colors.white }, draftEntry: { marginHorizontal: 15, marginBottom: 15, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: "rgba(17,17,17,0.10)", backgroundColor: "rgba(255,255,255,0.42)", flexDirection: "row", alignItems: "center", opacity: 0.72 }, draftArtwork: { width: 78, height: 82, borderRadius: 12, backgroundColor: "rgba(20,20,20,0.08)", alignItems: "center", justifyContent: "center" }, draftGlyph: { color: colors.ink, fontSize: 32, fontWeight: "200" }, draftCopy: { flex: 1, marginLeft: 13 }, draftTitle: { color: colors.ink, fontSize: 22 }, draftSubtitle: { marginTop: 4, color: colors.profileMuted, fontSize: 12 }, chevron: { color: colors.ink, fontSize: 26 }, itemStack: { paddingHorizontal: 15, gap: 12 }, singleColumn: { paddingHorizontal: 15, gap: 12 }, postCard: { minHeight: 154, borderRadius: 16, overflow: "hidden", backgroundColor: colors.white, flexDirection: "row" }, postArtwork: { width: 112, height: "100%", backgroundColor: colors.faint }, postCopy: { flex: 1, padding: 14 }, postTitle: { color: colors.ink, fontSize: 18, fontWeight: "600" }, postExcerpt: { marginTop: 7, color: colors.inkSoft, fontSize: 13, lineHeight: 18 }, postMeta: { marginTop: 10, color: colors.profileMuted, fontSize: 11 }, threadCard: { padding: 16, borderRadius: 16, backgroundColor: colors.white }, threadCardHeader: { flexDirection: "row", justifyContent: "space-between" }, eyebrow: { color: colors.profileMuted, fontSize: 10, letterSpacing: 1 }, dateText: { color: colors.profileMuted, fontSize: 11 }, threadTitle: { marginTop: 11, color: colors.ink, fontSize: 18, fontWeight: "600" }, threadExcerpt: { marginTop: 7, color: colors.ink, fontSize: 16, lineHeight: 23 }, threadHint: { marginTop: 12, color: colors.accent, fontSize: 12 }, commentCard: { padding: 16, borderRadius: 16, backgroundColor: colors.white }, commentText: { color: colors.black, fontSize: 19, lineHeight: 26, fontWeight: "600" }, commentReference: { marginTop: 10, color: colors.profileMuted, fontSize: 12, lineHeight: 17 }, cardPressed: { opacity: 0.72 }, contentLoading: { minHeight: 220, alignItems: "center", justifyContent: "center" }, modalRoot: { flex: 1, justifyContent: "flex-end" }, modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" }, sheet: { maxHeight: "68%", minHeight: 360, paddingHorizontal: 20, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface }, sheetHandle: { alignSelf: "center", width: 42, height: 4, marginTop: 9, borderRadius: radius.pill, backgroundColor: colors.faint }, sheetHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, sheetTitle: { color: colors.ink, fontSize: 24 }, sheetCount: { color: colors.profileMuted, fontSize: 12 }, closeGlyph: { color: colors.ink, fontSize: 28 }, sheetLoading: { minHeight: 220, alignItems: "center", justifyContent: "center" }, connectionRow: { minHeight: 72, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, connectionCopy: { flex: 1, marginLeft: 12 }, connectionName: { color: colors.ink, fontSize: 16, fontWeight: "500" }, connectionHandle: { color: colors.profileMuted, fontSize: 12 }, connectionBio: { marginTop: 2, color: colors.inkSoft, fontSize: 12 }
});
