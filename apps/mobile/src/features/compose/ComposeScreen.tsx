import { router, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import { AppScreen, InviteIcon } from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type { PoemDraftMedia, PoemDraftSettings } from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { InviteCollaboratorsSheet } from "./InviteCollaboratorsSheet";

type ComposeScreenProps = {
  sessionKey: string;
};

type ToggleKey = keyof PoemDraftSettings;

const initialSettings: PoemDraftSettings = {
  declareOriginal: false,
  isPublic: true,
  allowComments: true,
  allowQuotes: true,
  allowSave: true
};

export function ComposeScreen({ sessionKey }: ComposeScreenProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [byline, setByline] = useState("");
  const [tag, setTag] = useState("");
  const [media, setMedia] = useState<PoemDraftMedia | null>(null);
  const [settings, setSettings] = useState<PoemDraftSettings>(initialSettings);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftQuery = useQuery({
    queryKey: ["compose-draft-session", currentUserId, sessionKey],
    queryFn: () => lineSpaceApi.createPoemDraft({ ownerId: currentUserId, mode: "draft" }),
    staleTime: Infinity
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const draftId = draftQuery.data?.id;
      if (!draftId) throw new Error("Draft is not ready");
      return lineSpaceApi.updatePoemDraft({
        draftId,
        userId: currentUserId,
        title: title.trim(),
        body: body.trim(),
        byline: byline.trim(),
        tags: parseTags(tag),
        media,
        settings
      });
    },
    onSuccess: (draft) => {
      router.push({
        pathname: "/compose-preview",
        params: { draftId: draft.id }
      } as Href);
    }
  });

  const updateSetting = (key: ToggleKey, value: boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const openMediaPicker = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo-library access is required to attach media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: false,
        quality: 0.85
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        kind: asset.type === "video" ? "video" : "image",
        name: asset.fileName ?? (asset.type === "video" ? "video" : "image")
      });
    } catch {
      setError("The selected media could not be opened.");
    }
  };

  const goToPreview = () => {
    if (!body.trim()) {
      setError("Write at least one line before opening layout.");
      return;
    }
    setError(null);
    saveMutation.mutate();
  };

  const openCollaborationRoom = () => {
    const id = draftQuery.data?.id;
    if (!id) return;
    setInviteOpen(false);
    router.push({ pathname: "/compose/collaborate/[id]", params: { id } } as unknown as Href);
  };

  return (
    <AppScreen scroll padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <ComposeHeader
        isBusy={saveMutation.isPending}
        onAction={goToPreview}
        title="write Line"
      />

      <Pressable accessibilityRole="button" onPress={openMediaPicker} style={styles.mediaZone}>
        {media ? (
          <SelectedMedia media={media} onRemove={() => setMedia(null)} />
        ) : (
          <View style={styles.mediaEmpty}>
            <Text style={styles.mediaPlus}>＋</Text>
            <Text style={styles.mediaPlaceholder}>add image or video</Text>
            <Text style={styles.mediaHint}>optional · keep the poem at the center</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.editorPanel}>
        <TextInput
          onChangeText={setTitle}
          placeholder="Title (optional)"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="next"
          style={styles.titleInput}
          textAlign="center"
          value={title}
        />
        <View style={styles.divider} />
        <TextInput
          multiline
          onChangeText={setBody}
          placeholder="write Line"
          placeholderTextColor={colors.tabMuted}
          style={styles.lineInput}
          textAlignVertical="top"
          value={body}
        />
        <View style={styles.divider} />
        <TextInput
          onChangeText={setByline}
          placeholder="name (optional)"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="next"
          style={styles.metaInput}
          textAlign="center"
          value={byline}
        />
        <View style={styles.divider} />
        <TextInput
          autoCapitalize="none"
          onChangeText={setTag}
          placeholder="#hashtag (optional)"
          placeholderTextColor={colors.tabMuted}
          returnKeyType="done"
          style={styles.metaInput}
          textAlign="center"
          value={tag}
        />
      </View>

      <Pressable
        accessibilityHint="Invite another user into this draft"
        accessibilityRole="button"
        disabled={!draftQuery.data}
        onPress={() => setInviteOpen(true)}
        style={({ pressed }) => [styles.inviteCard, pressed && styles.inviteCardPressed]}
      >
        <InviteIcon width={58} height={58} />
        <View style={styles.inviteCopy}>
          <Text style={styles.inviteEyebrow}>WRITE TOGETHER</Text>
          <Text style={styles.inviteTitle}>Invite a co-writer</Text>
          <Text style={styles.inviteDescription}>Share this draft and edit the same poem live.</Text>
        </View>
        {draftQuery.isLoading ? <ActivityIndicator color={colors.ink} size="small" /> : <Text style={styles.chevron}>›</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saveMutation.isError ? <Text style={styles.error}>The draft could not be saved.</Text> : null}

      <View style={styles.settingsGroup}>
        <ToggleRow label="Declare as original" value={settings.declareOriginal} onValueChange={(value) => updateSetting("declareOriginal", value)} />
        <ToggleRow label="Public" value={settings.isPublic} onValueChange={(value) => updateSetting("isPublic", value)} />
        <View style={styles.groupGap} />
        <ToggleRow label="Allow comments" value={settings.allowComments} onValueChange={(value) => updateSetting("allowComments", value)} />
        <ToggleRow label="Allow quotes" value={settings.allowQuotes} onValueChange={(value) => updateSetting("allowQuotes", value)} />
        <ToggleRow label="Allow save" value={settings.allowSave} onValueChange={(value) => updateSetting("allowSave", value)} />
      </View>

      <InviteCollaboratorsSheet
        draftId={draftQuery.data?.id}
        onClose={() => setInviteOpen(false)}
        onOpenRoom={openCollaborationRoom}
        visible={inviteOpen}
      />
    </AppScreen>
  );
}

function ComposeHeader({
  title,
  isBusy,
  onAction
}: {
  title: string;
  isBusy: boolean;
  onAction: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeGlyph}>×</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable accessibilityRole="button" disabled={isBusy} onPress={onAction} style={styles.actionButton}>
        {isBusy ? <ActivityIndicator color={colors.profileMuted} /> : <Text style={styles.actionText}>next</Text>}
      </Pressable>
    </View>
  );
}

function SelectedMedia({ media, onRemove }: { media: PoemDraftMedia; onRemove: () => void }) {
  return (
    <View style={styles.selectedMedia}>
      {media.kind === "image" ? (
        <Image source={{ uri: media.uri } as ImageSourcePropType} resizeMode="cover" style={styles.selectedImage} />
      ) : (
        <View style={styles.videoSelected}>
          <Text style={styles.videoSelectedTitle}>Video selected</Text>
          <Text numberOfLines={1} style={styles.videoSelectedName}>{media.name}</Text>
        </View>
      )}
      <Pressable accessibilityLabel="Remove media" onPress={onRemove} style={styles.removeMedia}>
        <Text style={styles.removeMediaText}>×</Text>
      </Pressable>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)} style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </Pressable>
    </View>
  );
}

function parseTags(value: string) {
  return value.split(/[,\s#|]+/).map((item) => item.trim()).filter(Boolean);
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { minHeight: 980, paddingBottom: 0, backgroundColor: colors.profileCanvas },
  header: { height: 101, paddingBottom: 12, backgroundColor: colors.white, justifyContent: "flex-end" },
  closeButton: { position: "absolute", left: 11, bottom: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: colors.black, fontSize: 30, lineHeight: 32, fontWeight: "300" },
  headerTitle: { alignSelf: "center", color: colors.black, fontSize: 20, lineHeight: 24 },
  actionButton: { position: "absolute", right: 14, bottom: 10, minWidth: 50, minHeight: 32, alignItems: "flex-end", justifyContent: "center" },
  actionText: { color: "#868686", fontSize: 20, lineHeight: 24 },
  mediaZone: { height: 150, alignItems: "center", justifyContent: "center", backgroundColor: colors.profileCanvas },
  mediaEmpty: { alignItems: "center" },
  mediaPlus: { color: colors.profileMuted, fontSize: 28, lineHeight: 31, fontWeight: "300" },
  mediaPlaceholder: { color: colors.ink, fontSize: 16, lineHeight: 21 },
  mediaHint: { marginTop: 4, color: colors.tabMuted, fontSize: 11, lineHeight: 15 },
  selectedMedia: { width: "100%", height: "100%" },
  selectedImage: { width: "100%", height: "100%" },
  videoSelected: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  videoSelectedTitle: { color: colors.ink, fontSize: 16, lineHeight: 21 },
  videoSelectedName: { marginTop: 4, color: colors.profileMuted, fontSize: 12, lineHeight: 16 },
  removeMedia: { position: "absolute", right: 12, top: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" },
  removeMediaText: { color: colors.white, fontSize: 21, lineHeight: 23 },
  editorPanel: { height: 306, backgroundColor: colors.white },
  titleInput: { height: 59, paddingHorizontal: spacing.lg, color: colors.ink, fontSize: 20, lineHeight: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  lineInput: { minHeight: 136, paddingHorizontal: 20, paddingTop: 11, paddingBottom: spacing.md, color: colors.ink, fontSize: 20, lineHeight: 27 },
  metaInput: { height: 50, paddingHorizontal: spacing.lg, color: colors.ink, fontSize: 20, lineHeight: 24 },
  inviteCard: { minHeight: 94, marginHorizontal: 14, marginTop: 13, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center" },
  inviteCardPressed: { opacity: 0.72 },
  inviteCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  inviteEyebrow: { color: colors.profileMuted, fontSize: 9, lineHeight: 12, letterSpacing: 1.2 },
  inviteTitle: { marginTop: 1, color: colors.ink, fontSize: 18, lineHeight: 23 },
  inviteDescription: { marginTop: 3, color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  chevron: { marginLeft: 8, color: colors.ink, fontSize: 28, lineHeight: 30, fontWeight: "300" },
  error: { marginHorizontal: 20, marginTop: 10, color: colors.accent, fontSize: 12, lineHeight: 16 },
  settingsGroup: { marginTop: 14, backgroundColor: colors.profileCanvas },
  groupGap: { height: 10, backgroundColor: colors.profileCanvas },
  toggleRow: { height: 63, paddingLeft: 20, paddingRight: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { color: colors.black, fontSize: 20, lineHeight: 24 },
  switchTrack: { width: 56, height: 31, paddingHorizontal: 1, borderRadius: radius.pill, backgroundColor: "#D9D9D9", justifyContent: "center" },
  switchTrackOn: { backgroundColor: "#50B973" },
  switchThumb: { width: 29, height: 29, borderRadius: 15, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.faint },
  switchThumbOn: { alignSelf: "flex-end" }
});
