import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppScreen, Avatar, BackIcon, InviteIcon } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemDraft } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { InviteCollaboratorsSheet } from "./InviteCollaboratorsSheet";

export function CollaborativeComposeScreen({ draftId }: { draftId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const contentRef = useRef({ title: "", body: "" });

  const draftQuery = useQuery({
    queryKey: ["compose-draft", draftId],
    queryFn: () => lineSpaceApi.getPoemDraft(draftId),
    refetchInterval: 1000
  });
  const operationMutation = useMutation({
    mutationFn: (content: { title: string; body: string; baseVersion: number }) =>
      lineSpaceApi.applyDraftOperation({
        draftId,
        userId: currentUserId,
        ...content
      }),
    onSuccess: (draft, sent) => {
      setVersion(draft.version);
      if (
        sent.title === contentRef.current.title &&
        sent.body === contentRef.current.body
      ) {
        setDirty(false);
      }
      queryClient.setQueryData(["compose-draft", draft.id], draft);
    }
  });

  useEffect(() => {
    const draft = draftQuery.data;
    if (!draft || hydrated) return;
    setTitle(draft.title);
    setBody(draft.body);
    contentRef.current = { title: draft.title, body: draft.body };
    setVersion(draft.version);
    setHydrated(true);
  }, [draftQuery.data, hydrated]);

  useEffect(() => {
    const draft = draftQuery.data;
    if (!draft || !hydrated || dirty || draft.version <= version) return;
    setTitle(draft.title);
    setBody(draft.body);
    contentRef.current = { title: draft.title, body: draft.body };
    setVersion(draft.version);
  }, [dirty, draftQuery.data, hydrated, version]);

  useEffect(() => {
    if (!hydrated || !dirty) return;
    const timeout = setTimeout(() => {
      operationMutation.mutate({ title, body, baseVersion: version });
    }, 500);
    return () => clearTimeout(timeout);
  }, [body, dirty, hydrated, title]);

  const changeTitle = (value: string) => {
    setTitle(value);
    contentRef.current = { ...contentRef.current, title: value };
    setDirty(true);
  };
  const changeBody = (value: string) => {
    setBody(value);
    contentRef.current = { ...contentRef.current, body: value };
    setDirty(true);
  };

  const goToLayout = async () => {
    try {
      await operationMutation.mutateAsync({ title, body, baseVersion: version });
      router.push({ pathname: "/compose-preview", params: { draftId } } as Href);
    } catch {
      // The inline sync state remains visible and lets the writer retry.
    }
  };

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={styles.headerButton}>
          <BackIcon />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>shared draft</Text>
          <View style={styles.liveRow}><View style={styles.liveDot} /><Text style={styles.liveText}>live editing</Text></View>
        </View>
        <Pressable accessibilityRole="button" onPress={goToLayout} style={styles.nextButton}>
          <Text style={styles.nextText}>layout</Text>
        </Pressable>
      </View>

      {draftQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.ink} /></View>
      ) : !draftQuery.data ? (
        <View style={styles.center}><Text style={styles.errorText}>This shared draft is unavailable.</Text></View>
      ) : (
        <SharedEditor
          body={body}
          draft={draftQuery.data}
          isSyncing={operationMutation.isPending}
          onBodyChange={changeBody}
          onInvite={() => setInviteOpen(true)}
          onTitleChange={changeTitle}
          title={title}
        />
      )}

      <InviteCollaboratorsSheet
        draftId={draftId}
        onClose={() => setInviteOpen(false)}
        onOpenRoom={() => setInviteOpen(false)}
        visible={inviteOpen}
      />
    </AppScreen>
  );
}

function SharedEditor({
  draft,
  title,
  body,
  isSyncing,
  onTitleChange,
  onBodyChange,
  onInvite
}: {
  draft: PoemDraft;
  title: string;
  body: string;
  isSyncing: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onInvite: () => void;
}) {
  const remoteWriter = draft.collaborators.find((item) => item.user.id !== currentUserId);

  return (
    <View style={styles.editorRoot}>
      <View style={styles.presenceBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
          {draft.collaborators.map((collaborator, index) => (
            <View key={collaborator.user.id} style={[styles.person, index > 0 && styles.personOverlap]}>
              <Avatar
                color={collaborator.user.avatarColor}
                imageSource={collaborator.user.avatarUrl ? { uri: collaborator.user.avatarUrl } : undefined}
                label={collaborator.user.displayName}
                size={38}
              />
              <View style={[styles.presenceDot, collaborator.user.id === currentUserId && styles.youDot]} />
            </View>
          ))}
        </ScrollView>
        <View style={styles.presenceCopy}>
          <Text style={styles.presenceTitle}>{draft.collaborators.length} writers in this line</Text>
          <Text style={styles.presenceSubtitle}>
            {remoteWriter ? `${remoteWriter.user.displayName} is editing line ${remoteWriter.cursorLine ?? 1}` : "Invite another writer to begin"}
          </Text>
        </View>
        <Pressable accessibilityLabel="Invite another writer" onPress={onInvite} style={styles.inviteButton}>
          <InviteIcon width={44} height={44} />
        </Pressable>
      </View>

      <View style={styles.paper}>
        <TextInput
          onChangeText={onTitleChange}
          placeholder="Give this poem a title"
          placeholderTextColor={colors.tabMuted}
          style={styles.titleInput}
          value={title}
        />
        <View style={styles.rule} />
        <TextInput
          autoFocus
          multiline
          onChangeText={onBodyChange}
          placeholder="Write the first line together…"
          placeholderTextColor={colors.tabMuted}
          style={styles.bodyInput}
          textAlignVertical="top"
          value={body}
        />
        {remoteWriter ? (
          <View style={styles.remoteCursor}>
            <View style={[styles.cursorLine, { backgroundColor: remoteWriter.user.avatarColor }]} />
            <Text style={styles.cursorLabel}>{remoteWriter.user.displayName}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.syncBar}>
        {isSyncing ? <ActivityIndicator color={colors.success} size="small" /> : <View style={styles.syncedDot} />}
        <Text style={styles.syncText}>{isSyncing ? "syncing new lines…" : "all lines synced"}</Text>
        <Text style={styles.versionText}>v{draft.version}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { backgroundColor: colors.profileCanvas },
  header: { height: 88, paddingHorizontal: 14, paddingTop: 24, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center" },
  headerTitle: { color: colors.ink, fontSize: 18, lineHeight: 22 },
  liveRow: { marginTop: 2, flexDirection: "row", alignItems: "center" },
  liveDot: { width: 6, height: 6, marginRight: 5, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.profileMuted, fontSize: 10, lineHeight: 13 },
  nextButton: { minWidth: 58, height: 38, alignItems: "flex-end", justifyContent: "center" },
  nextText: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  center: { flex: 1, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.accent, fontSize: 14, lineHeight: 19 },
  editorRoot: { flex: 1 },
  presenceBar: { minHeight: 86, paddingHorizontal: 18, backgroundColor: colors.surfaceWarm, flexDirection: "row", alignItems: "center" },
  people: { paddingRight: 8, alignItems: "center" },
  person: { width: 42 },
  personOverlap: { marginLeft: -10 },
  presenceDot: { position: "absolute", right: 2, bottom: 1, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.surfaceWarm, backgroundColor: colors.success },
  youDot: { backgroundColor: colors.badgeWarm },
  presenceCopy: { flex: 1, minWidth: 0, marginLeft: 8 },
  presenceTitle: { color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "500" },
  presenceSubtitle: { marginTop: 3, color: colors.profileMuted, fontSize: 10, lineHeight: 14 },
  inviteButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  paper: { flex: 1, marginHorizontal: 16, marginTop: 16, marginBottom: 12, overflow: "hidden", borderRadius: 18, backgroundColor: "#FBF8F0", borderWidth: 1, borderColor: "#E7E0D2" },
  titleInput: { minHeight: 64, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12, color: colors.ink, fontFamily: "Georgia", fontSize: 22, lineHeight: 28 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, backgroundColor: "#DAD2C3" },
  bodyInput: { flex: 1, minHeight: 330, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 32, color: colors.ink, fontFamily: "Georgia", fontSize: 20, lineHeight: 32 },
  remoteCursor: { position: "absolute", left: 20, bottom: 24, flexDirection: "row", alignItems: "center" },
  cursorLine: { width: 2, height: 22, borderRadius: 1 },
  cursorLabel: { marginLeft: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden", backgroundColor: colors.surface, color: colors.profileMuted, fontSize: 9, lineHeight: 12 },
  syncBar: { height: 52, paddingHorizontal: 20, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center" },
  syncedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  syncText: { marginLeft: 8, color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  versionText: { marginLeft: "auto", color: colors.tabMuted, fontSize: 10, lineHeight: 14 }
});
