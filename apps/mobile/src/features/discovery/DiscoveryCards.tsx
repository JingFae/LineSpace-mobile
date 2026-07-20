import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, PoemCard } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemSummary, PoetryThread, UserProfile } from "@linespace/api-client";
import { mapPoemToCard } from "@/features/feed/LineSpaceHomeScreen";

export function DiscoveryPostCard({ poem }: { poem: PoemSummary }) {
  return (
    <PoemCard
      poem={mapPoemToCard(poem)}
      onAuthorPress={(id) => router.push({ pathname: "/profile/[id]", params: { id } } as Href)}
      onPress={(id) => router.push({ pathname: "/poem/[id]", params: { id } } as Href)}
      onTagPress={(tag) => router.push({ pathname: "/tags/[tag]", params: { tag, section: "posts" } } as unknown as Href)}
    />
  );
}

export function DiscoveryThreadCard({ thread }: { thread: PoetryThread }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/thread/[id]", params: { id: thread.id } } as Href)}
      style={({ pressed }) => [styles.threadCard, pressed && styles.pressed]}
    >
      <View style={styles.threadHeader}>
        <Pressable
          onPress={() => router.push({ pathname: "/profile/[id]", params: { id: thread.author.id } } as Href)}
        >
          <Avatar
            color={thread.author.avatarColor}
            imageSource={thread.author.avatarUrl ? { uri: thread.author.avatarUrl } : undefined}
            label={thread.author.displayName}
            size={36}
          />
        </Pressable>
        <View style={styles.authorCopy}>
          <Text numberOfLines={1} style={styles.authorName}>{thread.author.displayName}</Text>
          <Text numberOfLines={1} style={styles.authorMeta}>@{thread.author.handle} · {formatRelative(thread.createdAt)}</Text>
        </View>
        <View style={styles.threadBadge}><Text style={styles.threadBadgeText}>THREAD</Text></View>
      </View>
      {thread.title ? <Text numberOfLines={2} style={styles.threadTitle}>{thread.title}</Text> : null}
      <Text numberOfLines={5} style={styles.threadContent}>{thread.content}</Text>
      <View style={styles.metrics}>
        <Text style={styles.metric}>{thread.metrics.likes} likes</Text>
        <Text style={styles.metric}>{thread.metrics.continuations} continuations</Text>
      </View>
    </Pressable>
  );
}

export function DiscoveryUserRow({
  user,
  showFollow = false,
  isFollowing = false,
  followPending = false,
  onFollow
}: {
  user: UserProfile;
  showFollow?: boolean;
  isFollowing?: boolean;
  followPending?: boolean;
  onFollow?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/profile/[id]", params: { id: user.id } } as Href)}
      style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
    >
      <Avatar
        color={user.avatarColor}
        imageSource={user.avatarUrl ? { uri: user.avatarUrl } : undefined}
        label={user.displayName}
        size={48}
      />
      <View style={styles.userCopy}>
        <Text numberOfLines={1} style={styles.userName}>{user.displayName}</Text>
        <Text numberOfLines={1} style={styles.userHandle}>@{user.handle}</Text>
        {user.bio ? <Text numberOfLines={2} style={styles.userBio}>{user.bio}</Text> : null}
      </View>
      {showFollow && onFollow ? (
        <Pressable
          accessibilityLabel={`${isFollowing ? "Unfollow" : "Follow"} ${user.displayName}`}
          disabled={followPending}
          onPress={(event) => {
            event.stopPropagation();
            onFollow();
          }}
          style={[styles.followButton, isFollowing && styles.followButtonActive]}
        >
          <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
            {followPending ? "…" : isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      ) : null}
      {!showFollow ? <Text style={styles.openArrow}>›</Text> : null}
    </Pressable>
  );
}

function formatRelative(value: string) {
  const milliseconds = Math.max(0, Date.now() - Date.parse(value));
  const hours = Math.max(1, Math.floor(milliseconds / 36e5));
  if (hours < 24) return `${hours}h`;
  return `${Math.max(1, Math.floor(hours / 24))}d`;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.995 }] },
  threadCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  threadHeader: { flexDirection: "row", alignItems: "center" },
  authorCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  authorName: { color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  authorMeta: { marginTop: 2, color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  threadBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#EAF4FC" },
  threadBadgeText: { color: "#1677D2", fontSize: 9, lineHeight: 12, fontWeight: "700", letterSpacing: 0.8 },
  threadTitle: { marginTop: 14, color: colors.ink, fontFamily: "Georgia", fontSize: 20, lineHeight: 25, fontWeight: "600" },
  threadContent: { marginTop: 7, color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  metrics: { marginTop: 14, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, flexDirection: "row", gap: 18 },
  metric: { color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  userRow: {
    minHeight: 80,
    marginBottom: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center"
  },
  userCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  userName: { color: colors.ink, fontSize: 16, lineHeight: 20, fontWeight: "600" },
  userHandle: { marginTop: 1, color: "#1677D2", fontSize: 12, lineHeight: 16 },
  userBio: { marginTop: 4, color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  openArrow: { marginLeft: 6, color: colors.profileMuted, fontSize: 20, lineHeight: 24 },
  followButton: { borderRadius: 15, backgroundColor: colors.ink, marginLeft: 10, minWidth: 72, paddingHorizontal: 12, paddingVertical: 8 },
  followButtonActive: { backgroundColor: colors.surfaceMuted, borderColor: colors.line, borderWidth: StyleSheet.hairlineWidth },
  followText: { color: colors.white, fontSize: 11, fontWeight: "700", textAlign: "center" },
  followTextActive: { color: colors.ink }
});
