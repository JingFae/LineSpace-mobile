import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen, Avatar, BackIcon, SearchIcon } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemSummary, UserSearchResult } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

type PostShareScreenProps = { poemId?: string };

export function PostShareScreen({ poemId }: PostShareScreenProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const poemQuery = useQuery({
    queryKey: ["poem", poemId, currentUserId],
    enabled: Boolean(poemId),
    queryFn: () => lineSpaceApi.getPoem(poemId!, currentUserId)
  });
  const peopleQuery = useQuery({
    queryKey: ["user-search", currentUserId, query],
    queryFn: () => lineSpaceApi.searchUsers(query, currentUserId)
  });
  const shareMutation = useMutation({
    mutationFn: () => lineSpaceApi.sharePoem({ poemId: poemId!, senderId: currentUserId, recipientIds: [...selectedIds] }),
    onSuccess: (result) => {
      setSuccessCount(result.recipientIds.length);
      setSelectedIds(new Set());
    }
  });
  const people = useMemo(() => {
    const data = peopleQuery.data;
    if (!data) return [];
    return query.trim() ? data.results : [...data.recent, ...data.friends.filter((person) => !data.recent.some((recent) => recent.id === person.id))];
  }, [peopleQuery.data, query]);
  const poem = poemQuery.data ?? undefined;

  const togglePerson = (person: UserSearchResult) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(person.id)) next.delete(person.id); else next.add(person.id);
      return next;
    });
  };

  return (
    <AppScreen contentContainerStyle={styles.screen} padded={false} scroll={false} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}><BackIcon width={22} height={22} color={colors.ink} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Share post</Text><Text style={styles.subtitle}>send it to people you know</Text></View>
        <View style={styles.headerSpacer} />
      </View>
      {poem ? <PostPreview poem={poem} /> : null}
      <View style={styles.searchField}><SearchIcon width={18} height={18} color={colors.profileMuted} /><TextInput autoFocus onChangeText={setQuery} placeholder="Search username" placeholderTextColor={colors.profileMuted} style={styles.searchInput} value={query} /></View>
      <ScrollView contentContainerStyle={styles.peopleContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {peopleQuery.isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.ink} /></View> : peopleQuery.isError ? <Text style={styles.error}>People could not be loaded.</Text> : people.length === 0 ? <Text style={styles.empty}>No people found yet.</Text> : <>
          {!query.trim() && peopleQuery.data?.recent.length ? <Text style={styles.sectionTitle}>Recent chats</Text> : null}
          {!query.trim() ? peopleQuery.data?.recent.map((person) => <PersonRow key={`recent-${person.id}`} person={person} selected={selectedIds.has(person.id)} onPress={() => togglePerson(person)} />) : null}
          {!query.trim() && peopleQuery.data?.friends.length ? <Text style={styles.sectionTitle}>Friends · mutual follows</Text> : null}
          {(query.trim() ? people : peopleQuery.data?.friends.filter((person) => !peopleQuery.data?.recent.some((recent) => recent.id === person.id)) ?? []).map((person) => <PersonRow key={`friend-${person.id}`} person={person} selected={selectedIds.has(person.id)} onPress={() => togglePerson(person)} />)}
        </>}
      </ScrollView>
      {successCount !== null ? <View style={styles.successCard}><Text style={styles.successMark}>✓</Text><View><Text style={styles.successTitle}>Shared successfully</Text><Text style={styles.successBody}>Sent to {successCount} {successCount === 1 ? "person" : "people"} in Inbox.</Text></View><Pressable onPress={() => router.back()}><Text style={styles.successDone}>Done</Text></Pressable></View> : <View style={styles.footer}><Text style={styles.selectionText}>{selectedIds.size ? `${selectedIds.size} selected` : "Choose people to share with"}</Text><Pressable accessibilityRole="button" disabled={!selectedIds.size || shareMutation.isPending || !poemId} onPress={() => shareMutation.mutate()} style={[styles.shareButton, (!selectedIds.size || shareMutation.isPending) && styles.shareButtonDisabled]}>{shareMutation.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.shareButtonText}>Share</Text>}</Pressable></View>}
    </AppScreen>
  );
}

function PostPreview({ poem }: { poem: PoemSummary }) {
  return <View style={styles.preview}><View style={styles.previewArtwork}>{poem.artworkUrl ? <Image source={{ uri: poem.artworkUrl }} resizeMode="cover" style={styles.previewImage} /> : <View style={styles.previewArtworkWash} />}</View><View style={styles.previewCopy}><Text numberOfLines={1} style={styles.previewTitle}>{poem.title}</Text><Text numberOfLines={2} style={styles.previewExcerpt}>{poem.lines[0] ?? "A line from LineSpace"}</Text><Text style={styles.previewMeta}>@{poem.author.handle}</Text></View></View>;
}

function PersonRow({ person, selected, onPress }: { person: UserSearchResult; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.personRow, pressed && styles.personPressed]}><Avatar color={person.avatarColor} imageSource={person.avatarUrl ? { uri: person.avatarUrl } : undefined} label={person.displayName} size={44} /><View style={styles.personCopy}><Text style={styles.personName}>{person.displayName}</Text><Text style={styles.personHandle}>@{person.handle}</Text></View><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Text style={styles.checkmark}>✓</Text> : null}</View></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas }, screen: { flex: 1, backgroundColor: colors.profileCanvas }, header: { height: 104, paddingHorizontal: 18, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: colors.white }, backButton: { width: 40, height: 36, alignItems: "flex-start", justifyContent: "center" }, headerCopy: { alignItems: "center" }, headerSpacer: { width: 40 }, title: { color: colors.ink, fontSize: 21 }, subtitle: { marginTop: 2, color: colors.profileMuted, fontSize: 11 }, preview: { margin: 16, padding: 10, borderRadius: 16, backgroundColor: colors.white, flexDirection: "row", alignItems: "center" }, previewArtwork: { width: 64, height: 64, borderRadius: 11, overflow: "hidden", backgroundColor: colors.surfaceWarm }, previewArtworkWash: { flex: 1, backgroundColor: "#D9C6A7" }, previewImage: { width: "100%", height: "100%" }, previewCopy: { flex: 1, marginLeft: 11 }, previewTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" }, previewExcerpt: { marginTop: 3, color: colors.inkSoft, fontSize: 12, lineHeight: 16 }, previewMeta: { marginTop: 4, color: colors.profileMuted, fontSize: 11 }, searchField: { marginHorizontal: 16, minHeight: 46, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 8 }, searchInput: { flex: 1, color: colors.ink, fontSize: 15 }, peopleContent: { padding: 16, paddingBottom: 118 }, sectionTitle: { marginTop: 11, marginBottom: 8, color: colors.profileMuted, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" }, personRow: { minHeight: 65, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center" }, personPressed: { backgroundColor: colors.surfacePressed }, personCopy: { flex: 1, marginLeft: 12 }, personName: { color: colors.ink, fontSize: 16, fontWeight: "600" }, personHandle: { marginTop: 2, color: colors.profileMuted, fontSize: 12 }, checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.3, borderColor: colors.profileMuted, alignItems: "center", justifyContent: "center" }, checkboxSelected: { borderColor: colors.black, backgroundColor: colors.black }, checkmark: { color: colors.white, fontSize: 15 }, loading: { minHeight: 180, alignItems: "center", justifyContent: "center" }, empty: { paddingVertical: 40, color: colors.profileMuted, textAlign: "center" }, error: { paddingVertical: 40, color: colors.accent, textAlign: "center" }, footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: "rgba(255,255,255,0.96)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectionText: { color: colors.profileMuted, fontSize: 13 }, shareButton: { minWidth: 110, minHeight: 44, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }, shareButtonDisabled: { opacity: 0.45 }, shareButtonText: { color: colors.white, fontSize: 15, fontWeight: "600" }, successCard: { position: "absolute", left: 16, right: 16, bottom: 24, padding: 16, borderRadius: 18, backgroundColor: colors.black, flexDirection: "row", alignItems: "center", shadowColor: colors.black, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }, successMark: { width: 30, height: 30, marginRight: 11, borderRadius: 15, backgroundColor: colors.white, color: colors.black, fontSize: 20, textAlign: "center", lineHeight: 29 }, successTitle: { color: colors.white, fontSize: 15, fontWeight: "600" }, successBody: { marginTop: 3, color: "rgba(255,255,255,0.7)", fontSize: 11 }, successDone: { marginLeft: "auto", color: colors.white, fontSize: 13, fontWeight: "600" }
});
