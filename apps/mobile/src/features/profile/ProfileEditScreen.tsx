import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  BackIcon,
  CameraIcon,
  EmptyState,
  ProfileSettingRow
} from "@linespace/ui";
import { colors, radius, spacing } from "@linespace/tokens";
import type {
  UpdateUserProfileInput,
  UserProfileDetails
} from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

declare const require: (path: string) => ImageSourcePropType;

const profileHeaderArtwork = require("../../../assets/profile/profile-header-water.png");
const profileAvatarArtwork = require("../../../assets/profile/profile-avatar-water.png");

type EditableField = "displayName" | "bio";

export function ProfileEditScreen() {
  const queryClient = useQueryClient();
  const [activeField, setActiveField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: UpdateUserProfileInput) => lineSpaceApi.updateUserProfile(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(["user-profile", profile.id], profile);
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["poem"] });
      void queryClient.invalidateQueries({ queryKey: ["compose-draft"] });
      void queryClient.invalidateQueries({ queryKey: ["draft-invite-candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["user-connections"] });
    }
  });

  const openEditor = (field: EditableField, profile: UserProfileDetails) => {
    updateProfileMutation.reset();
    setFieldError(null);
    setNotice(null);
    setDraftValue(field === "displayName" ? profile.displayName : (profile.bio ?? ""));
    setActiveField(field);
  };

  const closeEditor = () => {
    if (!updateProfileMutation.isPending) {
      setActiveField(null);
      setFieldError(null);
    }
  };

  const saveField = async () => {
    if (!activeField) {
      return;
    }

    const value = draftValue.trim();
    if (activeField === "displayName" && value.length === 0) {
      setFieldError("Nickname cannot be empty.");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        userId: currentUserId,
        [activeField]: value
      });
      setNotice(activeField === "displayName" ? "Nickname saved" : "Signature saved");
      setActiveField(null);
      setFieldError(null);
    } catch {
      setFieldError("Could not save this change. Please try again.");
    }
  };

  const chooseAvatar = async () => {
    setPageError(null);
    setNotice(null);
    setAvatarBusy(true);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPageError("Photo access is required to update your avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        setPageError("The selected photo could not be read.");
        return;
      }
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        setPageError("Please choose an image smaller than 10 MB.");
        return;
      }

      await updateProfileMutation.mutateAsync({
        userId: currentUserId,
        avatarUrl: asset.uri
      });
      setNotice("Profile photo saved");
    } catch {
      setPageError("Could not update the profile photo. Please try again.");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <AppScreen
      contentContainerStyle={styles.screen}
      padded={false}
      scroll={false}
      style={styles.safeArea}
    >
      {profileQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : profileQuery.isError || !profileQuery.data ? (
        <View style={styles.centerState}>
          <EmptyState
            body="The profile API did not return an editable user record."
            title="Profile unavailable"
          />
        </View>
      ) : (
        <ProfileEditContent
          avatarBusy={avatarBusy}
          notice={notice}
          onAvatarPress={chooseAvatar}
          onEditField={(field) => openEditor(field, profileQuery.data!)}
          pageError={pageError}
          profile={profileQuery.data}
        />
      )}

      <FieldEditorSheet
        error={fieldError}
        field={activeField}
        isSaving={updateProfileMutation.isPending}
        onChange={setDraftValue}
        onClose={closeEditor}
        onSave={saveField}
        value={draftValue}
      />
    </AppScreen>
  );
}

function ProfileEditContent({
  profile,
  avatarBusy,
  notice,
  pageError,
  onAvatarPress,
  onEditField
}: {
  profile: UserProfileDetails;
  avatarBusy: boolean;
  notice: string | null;
  pageError: string | null;
  onAvatarPress: () => void;
  onEditField: (field: EditableField) => void;
}) {
  const avatarSource = profile.avatarUrl ? { uri: profile.avatarUrl } : profileAvatarArtwork;

  return (
    <View style={styles.contentRoot}>
      <View style={styles.hero}>
        <Image resizeMode="cover" source={profileHeaderArtwork} style={styles.heroBackground} />
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back to profile"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.topButton}
          >
            <BackIcon />
          </Pressable>
          <Text style={styles.pageTitle}>Edit profile</Text>
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.doneButton}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.identityPreview}>
          <Pressable
            accessibilityHint="Choose and crop a new profile photo"
            accessibilityLabel="Change profile photo"
            disabled={avatarBusy}
            onPress={onAvatarPress}
            style={styles.avatarButton}
          >
            <Image resizeMode="cover" source={avatarSource} style={styles.avatar} />
            <View style={styles.cameraBadge}>
              {avatarBusy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <CameraIcon width={18} height={18} />
              )}
            </View>
          </Pressable>
          <View style={styles.identityCopy}>
            <Text numberOfLines={1} style={styles.previewName}>
              {profile.displayName}
            </Text>
            <Text style={styles.previewId}>linespace ID: {profile.linespaceId}</Text>
            <Text style={styles.photoHint}>tap photo to choose & crop</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.formPanel}
      >
        <View style={styles.formIntro}>
          <Text style={styles.formTitle}>Your profile</Text>
          <Text style={styles.formSubtitle}>
            Keep it personal and simple. Each change is saved immediately.
          </Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {pageError ? <Text style={styles.errorText}>{pageError}</Text> : null}

        <View style={styles.fieldGroup}>
          <ProfileSettingRow
            accessibilityHint="Opens nickname editor"
            label="Name"
            onPress={() => onEditField("displayName")}
            value={profile.displayName}
          />
          <ProfileSettingRow
            accessibilityHint="Opens signature editor"
            label="Signature"
            onPress={() => onEditField("bio")}
            value={profile.bio?.trim() || "Add a signature"}
            valueMuted={!profile.bio?.trim()}
          />
        </View>

        <View style={styles.readOnlyCard}>
          <Text style={styles.readOnlyEyebrow}>LINE IDENTITY</Text>
          <View style={styles.identityMetaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Level</Text>
              <Text style={styles.metaValue}>{profile.level}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Badge</Text>
              <Text numberOfLines={1} style={styles.metaValue}>
                {profile.badges[0]?.label ?? "—"}
              </Text>
            </View>
          </View>
          <Text style={styles.readOnlyHint}>
            Level, badge and LineSpace ID are managed by your account activity.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function FieldEditorSheet({
  field,
  value,
  error,
  isSaving,
  onChange,
  onClose,
  onSave
}: {
  field: EditableField | null;
  value: string;
  error: string | null;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const isBio = field === "bio";
  const maxLength = isBio ? 280 : 120;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={field !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Pressable accessibilityLabel="Close editor" onPress={onClose} style={styles.backdrop} />
        <View style={styles.editorSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.editorHeader}>
            <View>
              <Text style={styles.editorEyebrow}>EDIT PROFILE</Text>
              <Text style={styles.editorTitle}>{isBio ? "Signature" : "Name"}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={onSave}
              style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>

          <TextInput
            autoCapitalize={isBio ? "sentences" : "words"}
            autoCorrect={isBio}
            autoFocus
            maxLength={maxLength}
            multiline={isBio}
            onChangeText={onChange}
            onSubmitEditing={isBio ? undefined : onSave}
            placeholder={isBio ? "Write a short line about yourself…" : "Your nickname"}
            placeholderTextColor={colors.tabMuted}
            returnKeyType={isBio ? "default" : "done"}
            style={[styles.input, isBio && styles.bioInput]}
            value={value}
          />
          <View style={styles.inputMeta}>
            <Text style={styles.inputHelp}>
              {isBio ? "Shown beneath your LineSpace ID." : "This is how other writers see you."}
            </Text>
            <Text style={styles.characterCount}>{value.length}/{maxLength}</Text>
          </View>
          {error ? <Text style={styles.editorError}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { backgroundColor: colors.profileCanvas },
  contentRoot: { flex: 1, backgroundColor: colors.profileCanvas },
  centerState: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  hero: {
    height: 256,
    overflow: "hidden",
    backgroundColor: colors.profileCanvas
  },
  heroBackground: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: 278,
    opacity: 0.22
  },
  topBar: {
    height: 58,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  topButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "500"
  },
  doneButton: {
    minWidth: 42,
    height: 42,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  doneText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500"
  },
  identityPreview: {
    marginTop: 28,
    paddingHorizontal: 38,
    flexDirection: "row",
    alignItems: "center"
  },
  avatarButton: {
    width: 92,
    height: 92
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: colors.faint
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.profileCanvas,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center"
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 19
  },
  previewName: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "400"
  },
  previewId: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15
  },
  photoHint: {
    marginTop: 9,
    color: colors.profileMuted,
    fontSize: 12,
    lineHeight: 16
  },
  formPanel: {
    flex: 1,
    marginTop: -22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.profileCanvas
  },
  formContent: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 48
  },
  formIntro: { paddingHorizontal: 4 },
  formTitle: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "400"
  },
  formSubtitle: {
    maxWidth: 310,
    marginTop: 7,
    color: colors.profileMuted,
    fontSize: 13,
    lineHeight: 18
  },
  notice: {
    marginTop: 16,
    paddingHorizontal: 4,
    color: colors.success,
    fontSize: 13,
    lineHeight: 18
  },
  errorText: {
    marginTop: 16,
    paddingHorizontal: 4,
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18
  },
  fieldGroup: { marginTop: 22, gap: 10 },
  readOnlyCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceWarm
  },
  readOnlyEyebrow: {
    color: colors.profileMuted,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2
  },
  identityMetaRow: {
    minHeight: 58,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  metaItem: { flex: 1 },
  metaDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.line },
  metaLabel: { color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  metaValue: { marginTop: 2, color: colors.ink, fontSize: 19, lineHeight: 24 },
  readOnlyHint: { color: colors.profileMuted, fontSize: 11, lineHeight: 16 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  editorSheet: {
    minHeight: 300,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.surface
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    marginTop: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.faint
  },
  editorHeader: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  editorEyebrow: {
    color: colors.profileMuted,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2
  },
  editorTitle: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 25,
    lineHeight: 30
  },
  saveButton: {
    minWidth: 72,
    height: 38,
    paddingHorizontal: 17,
    borderRadius: radius.pill,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center"
  },
  saveButtonPressed: { opacity: 0.72 },
  saveText: { color: colors.white, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  input: {
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.profileCanvas,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23
  },
  bioInput: { minHeight: 118, textAlignVertical: "top" },
  inputMeta: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  inputHelp: { flex: 1, color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  characterCount: { marginLeft: 12, color: colors.profileMuted, fontSize: 11, lineHeight: 15 },
  editorError: { marginTop: 10, color: colors.accent, fontSize: 12, lineHeight: 16 }
});
