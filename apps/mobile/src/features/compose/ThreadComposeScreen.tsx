import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemDraftSettings } from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { tabRoutes } from "@/navigation/tabs";
import { VisibilityAudienceSheet } from "./VisibilityAudienceSheet";

const initialSettings: PoemDraftSettings = {
  declareOriginal: false,
  isPublic: true,
  visibility: "public",
  audienceUserIds: [],
  allowComments: true,
  allowQuotes: true,
  allowSharing: true,
  allowSave: true
};

type ThreadComposeScreenProps = {
  sessionKey: string;
  draftId?: string;
};

export function ThreadComposeScreen({ sessionKey, draftId: resumeDraftId }: ThreadComposeScreenProps) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? "";
  const [title, setTitle] = useState("");
  const [firstLine, setFirstLine] = useState("");
  const [rules, setRules] = useState("");
  const [tag, setTag] = useState("");
  const [mention, setMention] = useState("");
  const [settings, setSettings] = useState(initialSettings);
  const [step, setStep] = useState<1 | 2>(1);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftInitialized = useRef(false);

  const draftQueryKey = [
    "compose-draft-session",
    currentUserId,
    sessionKey,
    "relay",
    resumeDraftId ?? "new"
  ] as const;
  const draftQuery = useQuery({
    queryKey: draftQueryKey,
    queryFn: async () => {
      if (!resumeDraftId) {
        return lineSpaceApi.createPoemDraft({ ownerId: currentUserId, mode: "relay" });
      }
      const draft = await lineSpaceApi.getPoemDraft(resumeDraftId);
      if (!draft || draft.ownerId !== currentUserId || draft.mode !== "relay") {
        throw new Error("Relay draft was not found");
      }
      return draft;
    },
    enabled: currentUserId.length > 0,
    staleTime: Infinity
  });

  useEffect(() => {
    const draft = draftQuery.data;
    if (!resumeDraftId || !draft || draftInitialized.current) return;
    draftInitialized.current = true;
    const hasStructuredRelay =
      draft.relayFirstLine !== undefined || draft.relayRules !== undefined;
    setTitle(draft.title === "poem relay" ? "" : draft.title);
    setFirstLine(draft.relayFirstLine ?? "");
    setRules(draft.relayRules ?? (hasStructuredRelay ? "" : draft.body));
    setTag(draft.tags.map((value) => `#${value}`).join(" "));
    setMention(draft.mentions.map((value) => `@${value.replace(/^@/, "")}`).join(" "));
    setSettings({
      ...draft.settings,
      audienceUserIds: [...draft.settings.audienceUserIds]
    });
  }, [draftQuery.data, resumeDraftId]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const draftId = draftQuery.data?.id;
      if (!draftId) throw new Error("Draft is not ready");
      return lineSpaceApi.updatePoemDraft({
        draftId,
        userId: currentUserId,
        title: title.trim(),
        body: firstLine.trim(),
        relayFirstLine: firstLine.trim(),
        relayRules: rules.trim(),
        tags: parse(tag),
        mentions: parse(mention),
        settings
      });
    }
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await updateMutation.mutateAsync();
      return lineSpaceApi.publishThreadDraft({
        draftId: draftQuery.data!.id,
        userId: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: draftQueryKey, exact: true });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-drafts", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["content-search"] });
      router.replace(tabRoutes.thread);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateMutation.mutateAsync();
      return lineSpaceApi.savePoemDraft({
        draftId: draftQuery.data!.id,
        userId: currentUserId
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-drafts", currentUserId] });
      router.replace("/profile/drafts" as never);
    }
  });

  const next = () => {
    if (!firstLine.trim()) {
      setError("Write the first line before choosing an audience.");
      return;
    }
    if (!rules.trim()) {
      setError("Add a rule or theme before choosing an audience.");
      return;
    }
    setError(null);
    updateMutation.mutate(undefined, { onSuccess: () => setStep(2) });
  };

  const busy =
    draftQuery.isLoading ||
    updateMutation.isPending ||
    publishMutation.isPending ||
    saveMutation.isPending;

  return (
    <AppScreen
      scroll
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.header}>
        <Pressable accessibilityLabel="Close relay composer" onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.close}>×</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>new poem relay</Text>
          <Text style={styles.headerSubtitle}>{step === 1 ? "setup" : "audience"}</Text>
        </View>
        {step === 1 ? (
          <Pressable accessibilityLabel="Continue relay setup" disabled={busy} onPress={next} style={styles.next}>
            {busy ? <ActivityIndicator color={colors.profileMuted} /> : <Text style={styles.nextText}>next</Text>}
          </Pressable>
        ) : (
          <View style={styles.next} />
        )}
      </View>

      {step === 1 ? (
        <>
          <Text style={styles.stepHint}>01 · Give the community a beautiful reason to continue.</Text>
          <View style={styles.hero}>
            <Text style={styles.heroMark}>↗</Text>
            <Text style={styles.heroTitle}>Start a poem relay</Text>
            <Text style={styles.heroBody}>
              Begin with one line, then set the mood or rule for the writers who follow.
            </Text>
          </View>
          <View style={styles.form}>
            <TextInput
              accessibilityLabel="Poem relay title"
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor={colors.tabMuted}
              returnKeyType="next"
              style={styles.titleInput}
              textAlign="center"
              value={title}
            />
            <View style={styles.rule} />
            <View style={styles.firstLineSection}>
              <Text style={styles.fieldLabel}>FIRST LINE</Text>
              <TextInput
                accessibilityLabel="First line of the poem relay"
                maxLength={1000}
                multiline
                onChangeText={setFirstLine}
                placeholder="Write the first line of this poem"
                placeholderTextColor={colors.tabMuted}
                style={styles.firstLineInput}
                textAlignVertical="top"
                value={firstLine}
              />
            </View>
            <View style={styles.rule} />
            <TextInput
              accessibilityLabel="Poem relay theme or rules"
              maxLength={5000}
              multiline
              onChangeText={setRules}
              placeholder="Write the theme or rules for this thread"
              placeholderTextColor={colors.tabMuted}
              style={styles.rulesInput}
              textAlignVertical="top"
              value={rules}
            />
            <View style={styles.rule} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setTag}
              placeholder="#tag (optional)"
              placeholderTextColor={colors.tabMuted}
              style={styles.metaInput}
              textAlign="center"
              value={tag}
            />
            <View style={styles.rule} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setMention}
              onSubmitEditing={next}
              placeholder="@mention (optional)"
              placeholderTextColor={colors.tabMuted}
              returnKeyType="done"
              style={styles.metaInput}
              textAlign="center"
              value={mention}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.stepHint}>02 · Choose who can open this relay.</Text>
          <Pressable onPress={() => setAudienceOpen(true)} style={styles.audienceCard}>
            <View>
              <Text style={styles.audienceEyebrow}>VISIBILITY</Text>
              <Text style={styles.audienceTitle}>{visibilityLabel(settings.visibility)}</Text>
              <Text style={styles.audienceHint}>
                {settings.visibility === "public"
                  ? "Anyone on LineSpace can join."
                  : `${settings.audienceUserIds.length} people selected`}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.preview}>
            <Text style={styles.previewEyebrow}>RELAY PREVIEW</Text>
            <Text style={styles.previewTitle}>{title.trim() || "poem relay"}</Text>
            <Text style={styles.previewRules}>{rules.trim()}</Text>
            <View style={styles.previewFirstLine}>
              <Text style={styles.previewFirstLineText}>{firstLine.trim()}</Text>
              <View style={styles.previewLineNumber}><Text style={styles.previewLineNumberText}>1</Text></View>
            </View>
            {parse(tag).length ? (
              <Text style={styles.previewTags}>{parse(tag).map((item) => `#${item}`).join("  ")}</Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Text style={styles.actionHint}>You can edit the audience later from your draft.</Text>
            <Pressable disabled={busy} onPress={() => publishMutation.mutate()} style={styles.publish}>
              <Text style={styles.publishText}>{publishMutation.isPending ? "Publishing…" : "Publish relay"}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => saveMutation.mutate()} style={styles.save}>
              <Text style={styles.saveText}>{saveMutation.isPending ? "Saving…" : "Save to draft"}</Text>
            </Pressable>
          </View>
        </>
      )}

      {error || draftQuery.isError || updateMutation.isError || publishMutation.isError || saveMutation.isError ? (
        <Text style={styles.error}>
          {error ?? "The relay draft could not be saved. Please try again."}
        </Text>
      ) : null}
      <VisibilityAudienceSheet
        onChange={setSettings}
        onClose={() => setAudienceOpen(false)}
        settings={settings}
        visible={audienceOpen}
      />
    </AppScreen>
  );
}

function parse(value: string) {
  return value.split(/[,\s#@|]+/).map((item) => item.trim()).filter(Boolean);
}

function visibilityLabel(value: PoemDraftSettings["visibility"]) {
  return value === "public"
    ? "Everyone"
    : value === "include"
      ? "Only selected people"
      : "Everyone except selected";
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { minHeight: 1000, paddingBottom: 28, backgroundColor: colors.profileCanvas },
  header: { height: 101, paddingBottom: 11, backgroundColor: colors.white, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerButton: { width: 48, height: 40, alignItems: "center", justifyContent: "center" },
  close: { color: colors.ink, fontSize: 31, lineHeight: 34 },
  headerCenter: { alignItems: "center" },
  headerTitle: { color: colors.ink, fontSize: 19, lineHeight: 24 },
  headerSubtitle: { marginTop: 2, color: colors.tabMuted, fontSize: 9, letterSpacing: 1.3 },
  next: { width: 58, height: 40, marginRight: 7, alignItems: "center", justifyContent: "center" },
  nextText: { color: colors.ink, fontSize: 17 },
  stepHint: { paddingHorizontal: 18, paddingVertical: 12, color: colors.profileMuted, fontSize: 11, lineHeight: 15, backgroundColor: colors.surfaceWarm },
  hero: { margin: 16, padding: 22, borderRadius: radius.lg, backgroundColor: "#557B79" },
  heroMark: { color: "rgba(255,255,255,0.7)", fontSize: 27 },
  heroTitle: { marginTop: 26, color: colors.white, fontFamily: "Georgia", fontSize: 26, lineHeight: 32 },
  heroBody: { marginTop: 8, color: "rgba(255,255,255,0.76)", fontSize: 13, lineHeight: 19 },
  form: { backgroundColor: colors.white },
  titleInput: { height: 58, paddingHorizontal: spacing.lg, color: colors.ink, fontSize: 20 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  firstLineSection: { padding: 18 },
  fieldLabel: { marginBottom: 9, color: colors.profileMuted, fontSize: 10, lineHeight: 13, letterSpacing: 1.4 },
  firstLineInput: { minHeight: 86, paddingHorizontal: 15, paddingVertical: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surfaceWarm, color: colors.ink, fontFamily: "Georgia", fontSize: 19, lineHeight: 27 },
  rulesInput: { minHeight: 150, padding: 18, color: colors.ink, fontFamily: "Georgia", fontSize: 19, lineHeight: 28 },
  metaInput: { height: 51, paddingHorizontal: spacing.lg, color: colors.ink, fontSize: 17 },
  audienceCard: { margin: 16, padding: 17, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  audienceEyebrow: { color: colors.profileMuted, fontSize: 10, letterSpacing: 1.3 },
  audienceTitle: { marginTop: 5, color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "600" },
  audienceHint: { marginTop: 4, color: colors.profileMuted, fontSize: 12 },
  chevron: { color: colors.ink, fontSize: 28 },
  preview: { marginHorizontal: 16, padding: 20, borderRadius: radius.lg, backgroundColor: "#EFE6D7" },
  previewEyebrow: { color: "#756757", fontSize: 10, letterSpacing: 1.3 },
  previewTitle: { marginTop: 14, color: "#241C16", fontFamily: "Georgia", fontSize: 24, lineHeight: 30 },
  previewRules: { marginTop: 8, color: "#3A3028", fontSize: 14, lineHeight: 21 },
  previewFirstLine: { position: "relative", minHeight: 104, marginTop: 16, padding: 16, paddingRight: 50, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.58)", justifyContent: "center" },
  previewFirstLineText: { color: "#241C16", fontFamily: "Georgia", fontSize: 18, lineHeight: 26, fontWeight: "600" },
  previewLineNumber: { position: "absolute", right: 13, top: 13, width: 32, height: 32, borderRadius: 16, backgroundColor: "#67615A", alignItems: "center", justifyContent: "center" },
  previewLineNumberText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  previewTags: { marginTop: 16, color: "#756757", fontSize: 12 },
  actions: { marginTop: 18, paddingHorizontal: 16 },
  actionHint: { color: colors.profileMuted, fontSize: 12, lineHeight: 17 },
  publish: { marginTop: 16, padding: 16, borderRadius: 15, backgroundColor: colors.ink, alignItems: "center" },
  publishText: { color: colors.white, fontSize: 17, fontWeight: "600" },
  save: { marginTop: 10, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center" },
  saveText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  error: { marginHorizontal: 20, marginTop: 12, color: colors.accent, fontSize: 12 }
});
