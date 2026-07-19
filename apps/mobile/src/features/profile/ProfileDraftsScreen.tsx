import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen, EmptyState } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";

export function ProfileDraftsScreen() {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? "";
  const draftsQuery = useQuery({
    queryKey: ["user-drafts", currentUserId],
    queryFn: () => lineSpaceApi.listUserDrafts(currentUserId),
    enabled: currentUserId.length > 0
  });
  return (
    <AppScreen contentContainerStyle={styles.screen} padded={false} scroll={false} style={styles.safeArea}>
      <View style={styles.header}><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.title}>draft</Text><Text style={styles.subtitle}>saved before publishing</Text></View><View style={styles.headerSpacer} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {draftsQuery.isLoading ? <View style={styles.center}><ActivityIndicator color={colors.ink} /></View> : draftsQuery.isError ? <EmptyState body="Your drafts could not be loaded." title="Drafts unavailable" /> : draftsQuery.data?.items.length ? draftsQuery.data.items.map((draft) => <Pressable key={draft.id} onPress={() => router.push({ pathname: "/compose-preview", params: { draftId: draft.id } } as Href)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardTop}><Text style={styles.cardStatus}>{draft.status === "ready" ? "READY TO PUBLISH" : "IN PROGRESS"}</Text><Text style={styles.date}>{formatDate(draft.updatedAt)}</Text></View><Text style={styles.cardTitle}>{draft.title.trim() || "untitled line"}</Text><Text numberOfLines={3} style={styles.cardBody}>{draft.body.trim() || "A blank page is still a beginning."}</Text><Text style={styles.open}>open layout ›</Text></Pressable>) : <EmptyState body="Finish a poem later and it will stay here." title="No drafts yet" />}
      </ScrollView>
    </AppScreen>
  );
}

function formatDate(value: string) { const date = new Date(value); return `${date.getMonth() + 1}/${date.getDate()}`; }

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas }, screen: { flex: 1, backgroundColor: colors.profileCanvas }, header: { height: 104, paddingHorizontal: 18, paddingBottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: colors.white }, back: { width: 40, height: 36, alignItems: "flex-start", justifyContent: "center" }, backText: { color: colors.ink, fontSize: 34, lineHeight: 36 }, headerSpacer: { width: 40 }, title: { color: colors.ink, fontSize: 22, textAlign: "center" }, subtitle: { marginTop: 2, color: colors.profileMuted, fontSize: 11, textAlign: "center" }, content: { padding: 15, paddingBottom: 32, gap: 12 }, center: { minHeight: 260, alignItems: "center", justifyContent: "center" }, card: { padding: 17, borderRadius: 16, backgroundColor: colors.white }, pressed: { opacity: 0.72 }, cardTop: { flexDirection: "row", justifyContent: "space-between" }, cardStatus: { color: colors.accent, fontSize: 10, letterSpacing: 1 }, date: { color: colors.profileMuted, fontSize: 11 }, cardTitle: { marginTop: 12, color: colors.ink, fontSize: 21 }, cardBody: { marginTop: 8, color: colors.inkSoft, fontSize: 16, lineHeight: 23 }, open: { marginTop: 13, color: colors.ink, fontSize: 12 }
});
