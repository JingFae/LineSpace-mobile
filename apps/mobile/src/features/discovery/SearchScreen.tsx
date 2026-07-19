import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppScreen, EmptyState, SearchIcon } from "@linespace/ui";
import { colors, spacing } from "@linespace/tokens";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { DiscoveryPostCard, DiscoveryThreadCard, DiscoveryUserRow } from "./DiscoveryCards";

type SearchCategory = "posts" | "threads" | "users";

export function SearchScreen() {
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("posts");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 260);
    return () => clearTimeout(timer);
  }, [text]);

  const search = useQuery({
    queryKey: ["content-search", query.toLocaleLowerCase(), currentUserId],
    enabled: query.length > 0,
    queryFn: () => lineSpaceApi.searchContent(query, currentUserId)
  });

  const tabs = useMemo(() => [
    { value: "posts" as const, label: "Post", count: search.data?.posts.length ?? 0 },
    { value: "threads" as const, label: "Thread", count: search.data?.threads.length ?? 0 },
    { value: "users" as const, label: "User", count: search.data?.users.length ?? 0 }
  ], [search.data]);

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Pressable onPress={() => inputRef.current?.focus()} style={styles.searchBox}>
          <SearchIcon color={colors.profileMuted} height={20} width={20} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            maxLength={80}
            onChangeText={setText}
            placeholder="Search posts, threads and users"
            placeholderTextColor={colors.profileMuted}
            ref={inputRef}
            returnKeyType="search"
            style={styles.input}
            value={text}
          />
          {text ? (
            <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setText("")} style={styles.clearButton}>
              <Text style={styles.clearGlyph}>×</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.value === category;
          return (
            <Pressable key={tab.value} onPress={() => setCategory(tab.value)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              {query ? <Text style={[styles.count, active && styles.countActive]}>{tab.count}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" style={styles.results} contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
        {!query ? (
          <View style={styles.welcome}>
            <View style={styles.searchMark}><SearchIcon color="#1677D2" height={28} width={28} /></View>
            <Text style={styles.welcomeTitle}>Find a line worth returning to</Text>
            <Text style={styles.welcomeBody}>Search every published Post and Thread, or find someone by username.</Text>
          </View>
        ) : search.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color="#1677D2" /><Text style={styles.loadingText}>Searching LineSpace…</Text></View>
        ) : search.isError ? (
          <EmptyState title="Search unavailable" body="Please try again in a moment." />
        ) : category === "posts" ? (
          search.data?.posts.length ? search.data.posts.map((poem) => <DiscoveryPostCard key={poem.id} poem={poem} />) : <NoResults query={query} type="posts" />
        ) : category === "threads" ? (
          search.data?.threads.length ? search.data.threads.map((thread) => <DiscoveryThreadCard key={thread.id} thread={thread} />) : <NoResults query={query} type="threads" />
        ) : search.data?.users.length ? (
          search.data.users.map((user) => <DiscoveryUserRow key={user.id} user={user} />)
        ) : <NoResults query={query} type="users" />}
      </ScrollView>
    </AppScreen>
  );
}

function NoResults({ query, type }: { query: string; type: string }) {
  return <EmptyState title={`No ${type} found`} body={`Nothing in ${type} contains “${query}” yet.`} />;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface },
  screen: { backgroundColor: colors.surface },
  header: { height: 88, paddingTop: 29, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  backButton: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
  backGlyph: { color: colors.ink, fontSize: 38, lineHeight: 40, fontWeight: "300" },
  searchBox: { flex: 1, height: 46, paddingHorizontal: 14, borderRadius: 23, flexDirection: "row", alignItems: "center", backgroundColor: "#F3F5F7", borderWidth: StyleSheet.hairlineWidth, borderColor: "#E2E7EB" },
  input: { flex: 1, height: 46, marginLeft: 9, paddingVertical: 0, color: colors.ink, fontSize: 15, lineHeight: 20 },
  clearButton: { width: 30, height: 36, alignItems: "center", justifyContent: "center" },
  clearGlyph: { color: colors.profileMuted, fontSize: 23, lineHeight: 24 },
  tabs: { height: 50, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tab: { minWidth: 94, height: 34, paddingHorizontal: 13, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  tabActive: { backgroundColor: colors.ink },
  tabLabel: { color: colors.profileMuted, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  tabLabelActive: { color: colors.white },
  count: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, overflow: "hidden", textAlign: "center", color: colors.profileMuted, backgroundColor: colors.surfaceMuted, fontSize: 10, lineHeight: 18 },
  countActive: { color: colors.ink, backgroundColor: colors.white },
  results: { flex: 1, backgroundColor: colors.surface },
  resultsContent: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48 },
  welcome: { alignItems: "center", paddingTop: 86, paddingHorizontal: 28 },
  searchMark: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF4FC" },
  welcomeTitle: { marginTop: 22, color: colors.ink, fontFamily: "Georgia", fontSize: 23, lineHeight: 29, textAlign: "center" },
  welcomeBody: { maxWidth: 310, marginTop: 9, color: colors.profileMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  loading: { alignItems: "center", paddingTop: 84, gap: 12 },
  loadingText: { color: colors.profileMuted, fontSize: 13, lineHeight: 18 }
});
