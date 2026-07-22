import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppScreen, Avatar, BackIcon, SearchIcon } from "@linespace/ui";
import { colors, radius } from "@linespace/tokens";
import type {
  ContinuationDetail,
  ThreadDetail,
  UserSearchResult
} from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

type ThreadShareScreenProps = {
  targetId?: string;
  kind?: "thread" | "continuation";
};

export function ThreadShareScreen({
  targetId,
  kind = "thread"
}: ThreadShareScreenProps) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const targetQuery = useQuery({
    queryKey: ["thread-share-target", kind, targetId, currentUserId],
    enabled: Boolean(targetId),
    queryFn: async () => {
      if (kind === "continuation") {
        return lineSpaceApi.getContinuationDetail(targetId!, currentUserId);
      }
      return lineSpaceApi.getThread(targetId!, currentUserId);
    }
  });
  const peopleQuery = useQuery({
    queryKey: ["user-search", currentUserId, query],
    queryFn: () => lineSpaceApi.searchUsers(query, currentUserId)
  });
  const shareMutation = useMutation({
    mutationFn: () =>
      lineSpaceApi.shareThread({
        kind,
        threadId: kind === "thread" ? targetId : undefined,
        continuationId: kind === "continuation" ? targetId : undefined,
        senderId: currentUserId,
        recipientIds: [...selectedIds],
        note: note.trim() || undefined
      }),
    onSuccess: (result) => {
      setSuccessCount(result.recipientIds?.length ?? 0);
      setSelectedIds(new Set());
    }
  });
  const people = useMemo(() => {
    const data = peopleQuery.data;
    if (!data) return [];
    if (query.trim()) return data.results;
    return [
      ...data.recent,
      ...data.friends.filter(
        (person) => !data.recent.some((recent) => recent.id === person.id)
      )
    ];
  }, [peopleQuery.data, query]);
  const target = targetQuery.data;

  const togglePerson = (person: UserSearchResult) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(person.id)) next.delete(person.id);
      else next.add(person.id);
      return next;
    });
  };

  return (
    <AppScreen
      contentContainerStyle={styles.screen}
      padded={false}
      scroll={false}
      style={styles.safeArea}
    >
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <BackIcon width={22} height={22} color={colors.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Share thread</Text>
          <Text style={styles.subtitle}>Send this poem path to Inbox</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {target ? <ThreadPreview kind={kind} target={target} /> : null}

      <View style={styles.noteField}>
        <TextInput
          maxLength={180}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.profileMuted}
          style={styles.noteInput}
          value={note}
        />
      </View>
      <View style={styles.searchField}>
        <SearchIcon width={18} height={18} color={colors.profileMuted} />
        <TextInput
          onChangeText={setQuery}
          placeholder="Search username"
          placeholderTextColor={colors.profileMuted}
          style={styles.searchInput}
          value={query}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.peopleContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {peopleQuery.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.ink} /></View>
        ) : peopleQuery.isError ? (
          <Text style={styles.empty}>People could not be loaded.</Text>
        ) : people.length === 0 ? (
          <Text style={styles.empty}>No matching people yet.</Text>
        ) : (
          people.map((person) => (
            <PersonRow
              key={person.id}
              onPress={() => togglePerson(person)}
              person={person}
              selected={selectedIds.has(person.id)}
            />
          ))
        )}
      </ScrollView>

      {successCount !== null ? (
        <View style={styles.successCard}>
          <View style={styles.successMark}><Text style={styles.successMarkText}>✓</Text></View>
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Shared successfully</Text>
            <Text style={styles.successBody}>Sent to {successCount} people in Inbox.</Text>
          </View>
          <Pressable onPress={() => router.back()}><Text style={styles.successDone}>Done</Text></Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.selectionText}>
            {selectedIds.size ? `${selectedIds.size} selected` : "Choose recipients"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!selectedIds.size || shareMutation.isPending || !targetId}
            onPress={() => shareMutation.mutate()}
            style={[
              styles.shareButton,
              (!selectedIds.size || shareMutation.isPending) && styles.shareButtonDisabled
            ]}
          >
            {shareMutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.shareButtonText}>Share</Text>
            )}
          </Pressable>
        </View>
      )}
    </AppScreen>
  );
}

function ThreadPreview({
  kind,
  target
}: {
  kind: "thread" | "continuation";
  target: ThreadDetail | ContinuationDetail;
}) {
  const isContinuation = kind === "continuation" && "current" in target;
  const thread = target.thread;
  const excerpt = isContinuation ? target.current.content : thread.content;
  const lineNumber = isContinuation
    ? target.current.lineNumber ?? target.path.length + 2
    : 1;
  return (
    <View style={styles.preview}>
      <View style={styles.previewArtwork}>
        {thread.media?.uri ? (
          <Image source={{ uri: thread.media.uri }} resizeMode="cover" style={styles.previewImage} />
        ) : (
          <View style={styles.previewArtworkWash}>
            <Text style={styles.previewArtworkNumber}>{lineNumber}</Text>
          </View>
        )}
      </View>
      <View style={styles.previewCopy}>
        <Text numberOfLines={1} style={styles.previewTitle}>
          {thread.title || "Untitled thread"}
        </Text>
        <Text numberOfLines={2} style={styles.previewExcerpt}>{excerpt}</Text>
        <Text style={styles.previewMeta}>
          Line {lineNumber} · @{isContinuation ? target.current.author.handle : thread.author.handle}
        </Text>
      </View>
    </View>
  );
}

function PersonRow({
  person,
  selected,
  onPress
}: {
  person: UserSearchResult;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.personRow}
    >
      <Avatar
        color={person.avatarColor}
        imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined}
        label={person.displayName}
        size={44}
      />
      <View style={styles.personCopy}>
        <Text style={styles.personName}>{person.displayName}</Text>
        <Text style={styles.personHandle}>@{person.handle}</Text>
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { flex: 1, backgroundColor: colors.profileCanvas },
  header: {
    height: 104,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: colors.white
  },
  backButton: { width: 40, height: 36, justifyContent: "center" },
  headerCopy: { alignItems: "center" },
  headerSpacer: { width: 40 },
  title: { color: colors.ink, fontSize: 21, fontWeight: "600" },
  subtitle: { marginTop: 2, color: colors.profileMuted, fontSize: 11 },
  preview: {
    margin: 16,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center"
  },
  previewArtwork: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm
  },
  previewImage: { width: "100%", height: "100%" },
  previewArtworkWash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9C6A7"
  },
  previewArtworkNumber: { color: colors.ink, fontSize: 24, fontWeight: "700" },
  previewCopy: { flex: 1, marginLeft: 11 },
  previewTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  previewExcerpt: { marginTop: 3, color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  previewMeta: { marginTop: 4, color: colors.profileMuted, fontSize: 11 },
  noteField: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.white
  },
  noteInput: { flex: 1, color: colors.ink, fontSize: 14 },
  searchField: {
    marginHorizontal: 16,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  peopleContent: { padding: 16, paddingBottom: 118 },
  personRow: {
    minHeight: 65,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center"
  },
  personCopy: { flex: 1, marginLeft: 12 },
  personName: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  personHandle: { marginTop: 2, color: colors.profileMuted, fontSize: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.3,
    borderColor: colors.profileMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxSelected: { borderColor: colors.black, backgroundColor: colors.black },
  checkmark: { color: colors.white, fontSize: 15 },
  loading: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 40, color: colors.profileMuted, textAlign: "center" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  selectionText: { color: colors.profileMuted, fontSize: 13 },
  shareButton: {
    minWidth: 110,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center"
  },
  shareButtonDisabled: { opacity: 0.45 },
  shareButtonText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  successCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.black,
    flexDirection: "row",
    alignItems: "center"
  },
  successMark: {
    width: 30,
    height: 30,
    marginRight: 11,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  successMarkText: { color: colors.black, fontSize: 18, fontWeight: "700" },
  successCopy: { flex: 1 },
  successTitle: { color: colors.white, fontSize: 15, fontWeight: "600" },
  successBody: { marginTop: 3, color: "rgba(255,255,255,0.7)", fontSize: 11 },
  successDone: { color: colors.white, fontSize: 13, fontWeight: "600" }
});
