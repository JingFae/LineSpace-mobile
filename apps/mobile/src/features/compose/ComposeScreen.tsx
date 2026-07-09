import type { Href } from "expo-router";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType
} from "react-native";
import { AppScreen } from "@linespace/ui";
import { colors, radius, spacing, typography } from "@linespace/tokens";

type DraftMedia = {
  uri: string;
  kind: "image" | "video";
  name: string;
};

type ToggleKey =
  | "declareOriginal"
  | "isPublic"
  | "allowComments"
  | "allowQuotas"
  | "allowSave";

type ComposeSettings = Record<ToggleKey, boolean>;

const placeholderColor = "#BABABA";
const screenBackground = "#F6F7F7";
const switchOff = "#D9D9D9";
const switchOn = "#50B973";

export function ComposeScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [media, setMedia] = useState<DraftMedia | null>(null);
  const [settings, setSettings] = useState<ComposeSettings>({
    declareOriginal: false,
    isPublic: true,
    allowComments: false,
    allowQuotas: false,
    allowSave: false
  });

  function updateSetting(key: ToggleKey, value: boolean) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function openMediaPicker() {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,video/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          return;
        }

        setMedia({
          uri: URL.createObjectURL(file),
          kind: file.type.startsWith("video/") ? "video" : "image",
          name: file.name
        });
      };
      input.click();
      return;
    }

    Alert.alert(
      "Media upload",
      "The web preview can select image or video files now. Native media picking is ready for expo-image-picker once pnpm can finish installing native dependencies."
    );
  }

  function goToPreview() {
    const previewHref = {
      pathname: "/compose-preview",
      params: {
        title: title.trim(),
        body: body.trim(),
        name: name.trim(),
        tag: tag.trim(),
        mediaUri: media?.uri ?? "",
        mediaKind: media?.kind ?? "",
        mediaName: media?.name ?? "",
        declareOriginal: String(settings.declareOriginal),
        isPublic: String(settings.isPublic),
        allowComments: String(settings.allowComments),
        allowQuotas: String(settings.allowQuotas),
        allowSave: String(settings.allowSave)
      }
    } as unknown as Href;

    router.push(previewHref);
  }

  return (
    <AppScreen
      scroll
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <ComposeHeader title="write Line" actionLabel="next" onAction={goToPreview} />

      <Pressable accessibilityRole="button" onPress={openMediaPicker} style={styles.mediaZone}>
        {media ? (
          <SelectedMedia media={media} />
        ) : (
          <Text style={styles.mediaPlaceholder}>Add media (optional)</Text>
        )}
      </Pressable>

      <View style={styles.editorPanel}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title (optional)"
          placeholderTextColor={placeholderColor}
          style={styles.titleInput}
          textAlign="center"
          returnKeyType="next"
        />
        <View style={styles.divider} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="write Line"
          placeholderTextColor={placeholderColor}
          multiline
          style={styles.lineInput}
          textAlignVertical="top"
        />
        <View style={styles.divider} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="name (optional)"
          placeholderTextColor={placeholderColor}
          style={styles.metaInput}
          textAlign="center"
          returnKeyType="next"
        />
        <View style={styles.divider} />
        <TextInput
          value={tag}
          onChangeText={setTag}
          placeholder="#hashtag (optional)"
          placeholderTextColor={placeholderColor}
          style={styles.metaInput}
          textAlign="center"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>

      <View style={styles.settingsGroup}>
        <ToggleRow
          label="Declare as original"
          value={settings.declareOriginal}
          onValueChange={(value) => updateSetting("declareOriginal", value)}
        />
        <ToggleRow
          label="Public"
          value={settings.isPublic}
          onValueChange={(value) => updateSetting("isPublic", value)}
        />
        <View style={styles.groupGap} />
        <ToggleRow
          label="Allow comments"
          value={settings.allowComments}
          onValueChange={(value) => updateSetting("allowComments", value)}
        />
        <ToggleRow
          label="Allow quotas"
          value={settings.allowQuotas}
          onValueChange={(value) => updateSetting("allowQuotas", value)}
        />
        <ToggleRow
          label="Allow save"
          value={settings.allowSave}
          onValueChange={(value) => updateSetting("allowSave", value)}
        />
      </View>
    </AppScreen>
  );
}

function ComposeHeader({
  title,
  actionLabel,
  onAction
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeGlyph}>×</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.actionButton}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function SelectedMedia({ media }: { media: DraftMedia }) {
  if (media.kind === "image") {
    return (
      <Image
        source={{ uri: media.uri } as ImageSourcePropType}
        resizeMode="cover"
        style={styles.selectedImage}
      />
    );
  }

  return (
    <View style={styles.videoSelected}>
      <Text style={styles.videoSelectedTitle}>Video selected</Text>
      <Text numberOfLines={1} style={styles.videoSelectedName}>
        {media.name}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={[styles.switchTrack, value && styles.switchTrackOn]}
      >
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: screenBackground
  },
  screen: {
    minHeight: 874,
    backgroundColor: screenBackground,
    paddingBottom: 0
  },
  header: {
    height: 101,
    backgroundColor: colors.white,
    justifyContent: "flex-end",
    paddingBottom: 12
  },
  closeButton: {
    position: "absolute",
    left: 11,
    bottom: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  closeGlyph: {
    color: colors.black,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "300"
  },
  headerTitle: {
    alignSelf: "center",
    color: colors.black,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400"
  },
  actionButton: {
    position: "absolute",
    right: 14,
    bottom: 10,
    minHeight: 32,
    justifyContent: "center"
  },
  actionText: {
    color: "#868686",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400"
  },
  mediaZone: {
    height: 146,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: screenBackground
  },
  mediaPlaceholder: {
    color: placeholderColor,
    fontSize: 20,
    lineHeight: 24
  },
  selectedImage: {
    width: "100%",
    height: "100%"
  },
  videoSelected: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  videoSelectedTitle: {
    ...typography.body,
    color: colors.ink
  },
  videoSelectedName: {
    ...typography.label,
    color: colors.muted,
    marginTop: spacing.xs
  },
  editorPanel: {
    height: 306,
    backgroundColor: colors.white
  },
  titleInput: {
    height: 59,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
    paddingHorizontal: spacing.lg
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line
  },
  lineInput: {
    minHeight: 136,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    paddingHorizontal: 20,
    paddingTop: 11,
    paddingBottom: spacing.md
  },
  metaInput: {
    height: 50,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
    paddingHorizontal: spacing.lg
  },
  settingsGroup: {
    backgroundColor: screenBackground
  },
  groupGap: {
    height: 10,
    backgroundColor: screenBackground
  },
  toggleRow: {
    height: 63,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
    paddingLeft: 20,
    paddingRight: 14
  },
  toggleLabel: {
    color: colors.black,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400"
  },
  switchTrack: {
    width: 56,
    height: 31,
    borderRadius: radius.pill,
    backgroundColor: switchOff,
    justifyContent: "center",
    paddingHorizontal: 1
  },
  switchTrackOn: {
    backgroundColor: switchOn
  },
  switchThumb: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.faint
  },
  switchThumbOn: {
    alignSelf: "flex-end"
  }
});
