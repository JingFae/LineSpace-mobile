import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen, EmptyState } from "@linespace/ui";
import { colors, spacing } from "@linespace/tokens";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { DiscoveryPostCard, DiscoveryThreadCard } from "./DiscoveryCards";

type TagSection = "posts" | "threads";

export function TagResultsScreen({
  initialSection = "posts",
  tag
}: {
  initialSection?: TagSection;
  tag: string;
}) {
  const normalized = tag.trim().replace(/^#+/, "").toLocaleLowerCase();
  const [section, setSection] = useState<TagSection>(initialSection);
  const result = useQuery({
    queryKey: ["tag-content", normalized, currentUserId],
    enabled: Boolean(normalized),
    queryFn: () => lineSpaceApi.listTagContent(normalized, currentUserId)
  });
  const tabs = [
    { value: "posts" as const, label: "Post", count: result.data?.posts.length ?? 0 },
    { value: "threads" as const, label: "Thread", count: result.data?.threads.length ?? 0 }
  ];

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>TAG COLLECTION</Text>
          <Text numberOfLines={1} style={styles.title}>#{normalized}</Text>
        </View>
        <View style={styles.headerSpace} />
      </View>
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.value === section;
          return (
            <Pressable key={tab.value} onPress={() => setSection(tab.value)} style={styles.tab}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              <Text style={[styles.tabCount, active && styles.tabCountActive]}>{tab.count}</Text>
              {active ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {result.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color="#1677D2" /></View>
        ) : result.isError ? (
          <EmptyState title="Tag unavailable" body="This collection could not be loaded." />
        ) : section === "posts" ? (
          result.data?.posts.length ? result.data.posts.map((poem) => <DiscoveryPostCard key={poem.id} poem={poem} />) : <EmptyState title="No Posts yet" body={`No published Posts use #${normalized} yet.`} />
        ) : result.data?.threads.length ? (
          result.data.threads.map((thread) => <DiscoveryThreadCard key={thread.id} thread={thread} />)
        ) : <EmptyState title="No Threads yet" body={`No Threads use #${normalized} yet.`} />}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface },
  screen: { backgroundColor: colors.surface },
  header: { height: 100, paddingTop: 28, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  backButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backGlyph: { color: colors.ink, fontSize: 39, lineHeight: 41, fontWeight: "300" },
  heading: { flex: 1, minWidth: 0, alignItems: "center" },
  headerSpace: { width: 48 },
  eyebrow: { color: colors.profileMuted, fontSize: 9, lineHeight: 12, letterSpacing: 1.5 },
  title: { marginTop: 3, color: "#1677D2", fontSize: 21, lineHeight: 27, fontStyle: "italic", fontWeight: "700", textShadowColor: "rgba(48,156,255,0.34)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  tabs: { height: 48, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tab: { minWidth: 90, height: 48, paddingTop: 10, flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 6 },
  tabText: { color: colors.profileMuted, fontSize: 14, lineHeight: 19 },
  tabTextActive: { color: colors.ink, fontWeight: "600" },
  tabCount: { color: colors.profileMuted, fontSize: 10, lineHeight: 17 },
  tabCountActive: { color: "#1677D2", fontWeight: "700" },
  indicator: { position: "absolute", bottom: 0, width: 22, height: 2, borderRadius: 1, backgroundColor: colors.ink },
  scroll: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48 },
  loading: { paddingTop: 80, alignItems: "center" }
});
