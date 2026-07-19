import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
  Avatar,
  BackgroundPaperIcon,
  PoemLayoutCard,
  TemplateIcon,
  TypographyIcon
} from "@linespace/ui";
import { colors, radius } from "@linespace/tokens";
import type {
  PoemBackgroundId,
  PoemDesignCatalog,
  PoemDraft,
  PoemLayoutConfig,
  PoemTypographyId,
  PoemDraftSettings
} from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { getMediaAspectRatio } from "@/features/poem/poemPresentation";
import { VisibilityAudienceSheet } from "./VisibilityAudienceSheet";

type SearchParamValue = string | string[] | undefined;

type ComposePreviewScreenProps = {
  params: Record<string, SearchParamValue>;
};

type LayoutTool = "template" | "typography" | "background";

export function ComposePreviewScreen({ params }: ComposePreviewScreenProps) {
  const queryClient = useQueryClient();
  const draftId = getParam(params.draftId);
  const [activeTool, setActiveTool] = useState<LayoutTool>("template");
  const [layout, setLayout] = useState<PoemLayoutConfig | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [step, setStep] = useState<2 | 3>(2);
  const [settings, setSettings] = useState<PoemDraftSettings | null>(null);

  const draftQuery = useQuery({
    queryKey: ["compose-draft", draftId],
    queryFn: () => lineSpaceApi.getPoemDraft(draftId),
    enabled: Boolean(draftId)
  });
  const catalogQuery = useQuery({
    queryKey: ["poem-design-catalog"],
    queryFn: () => lineSpaceApi.getPoemDesignCatalog()
  });
  const layoutMutation = useMutation({
    mutationFn: (nextLayout: PoemLayoutConfig) =>
      lineSpaceApi.updatePoemDraft({
        draftId,
        userId: currentUserId,
        layout: nextLayout
      }),
    onSuccess: (draft) => queryClient.setQueryData(["compose-draft", draft.id], draft)
  });
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (layout) {
        await lineSpaceApi.updatePoemDraft({ draftId, userId: currentUserId, layout });
      }
      if (draftQuery.data?.mode === "relay") return lineSpaceApi.publishThreadDraft({ draftId, userId: currentUserId });
      return lineSpaceApi.publishPoemDraft({ draftId, userId: currentUserId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      router.replace(draftQuery.data?.mode === "relay" ? "/" : "/(tabs)/discover" as Href);
    }
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (layout) {
        await lineSpaceApi.updatePoemDraft({ draftId, userId: currentUserId, layout });
      }
      if (settings) {
        await lineSpaceApi.updatePoemDraft({ draftId, userId: currentUserId, settings });
      }
      return lineSpaceApi.savePoemDraft({ draftId, userId: currentUserId });
    },
    onSuccess: () => {
      setFinishOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["user-drafts", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
      router.replace("/profile/drafts" as Href);
    }
  });

  useEffect(() => {
    if (draftQuery.data && !layout) setLayout(draftQuery.data.layout);
    if (draftQuery.data && !settings) setSettings(draftQuery.data.settings);
  }, [draftQuery.data, layout, settings]);

  const selectLayout = (nextLayout: PoemLayoutConfig) => {
    setLayout(nextLayout);
    layoutMutation.mutate(nextLayout);
  };

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{step === 2 ? "layout" : "post settings"}</Text>
          <Text style={styles.headerSubtitle}>{step === 2 ? "02 · make the poem feel like yours" : "03 · set visibility and originality"}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={!draftId || publishMutation.isPending || saveMutation.isPending} onPress={() => { if (step === 2) setStep(3); else setFinishOpen(true); }} style={styles.doneButton}>
          {publishMutation.isPending || saveMutation.isPending ? <ActivityIndicator color={colors.profileMuted} /> : <Text style={styles.doneText}>{step === 2 ? "next" : "finish"}</Text>}
        </Pressable>
      </View>

      {!draftId || draftQuery.isError || !draftQuery.data ? (
        <View style={styles.centerState}>
          {draftQuery.isLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.errorText}>The draft could not be opened.</Text>}
        </View>
      ) : step === 3 && settings ? (
        <PrivacySettingsStage mode={draftQuery.data.mode} settings={settings} onAudience={() => setAudienceOpen(true)} onChange={setSettings} onNext={() => setFinishOpen(true)} />
      ) : !catalogQuery.data || !layout ? (
        <View style={styles.centerState}><ActivityIndicator color={colors.ink} /></View>
      ) : (
        <LayoutWorkspace
          activeTool={activeTool}
          catalog={catalogQuery.data}
          draft={draftQuery.data}
          layout={layout}
          onSelectLayout={selectLayout}
          onToolChange={setActiveTool}
        />
      )}

      {layoutMutation.isError || publishMutation.isError ? (
        <Text style={styles.floatingError}>This layout could not be saved. Tap the option again to retry.</Text>
      ) : null}
      <FinishDraftSheet
        isBusy={publishMutation.isPending || saveMutation.isPending}
        onClose={() => setFinishOpen(false)}
        onPublish={() => publishMutation.mutate()}
        onSave={() => saveMutation.mutate()}
        visible={finishOpen}
      />
      {settings ? <VisibilityAudienceSheet onChange={setSettings} onClose={() => setAudienceOpen(false)} settings={settings} visible={audienceOpen} /> : null}
    </AppScreen>
  );
}

function PrivacySettingsStage({ mode, settings, onChange, onAudience, onNext }: { mode: "draft" | "relay"; settings: PoemDraftSettings; onChange: (settings: PoemDraftSettings) => void; onAudience: () => void; onNext: () => void }) {
  const toggle = (key: "declareOriginal") => onChange({ ...settings, [key]: !settings[key] });
  return <ScrollView contentContainerStyle={styles.settingsStage} showsVerticalScrollIndicator={false}><Text style={styles.stageEyebrow}>03 · POST SETTINGS</Text><Text style={styles.stageTitle}>Choose how this {mode === "relay" ? "relay" : "post"} meets the world.</Text><Text style={styles.stageHint}>These choices are saved with your draft and can be changed before publishing.</Text><Pressable onPress={onAudience} style={styles.audienceSetting}><View><Text style={styles.settingLabel}>Visibility</Text><Text style={styles.settingValue}>{settings.visibility === "public" ? "Everyone" : settings.visibility === "include" ? `Only ${settings.audienceUserIds.length || "selected"} people` : `Everyone except ${settings.audienceUserIds.length || "selected"}`}</Text></View><Text style={styles.settingChevron}>›</Text></Pressable><SettingToggle label="Declare as original" value={settings.declareOriginal} onPress={() => toggle("declareOriginal")} /><Pressable onPress={onNext} style={styles.settingsNext}><Text style={styles.settingsNextText}>Continue to finish</Text><Text style={styles.settingsNextArrow}>→</Text></Pressable></ScrollView>;
}

function SettingToggle({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onPress} style={styles.settingToggle}><Text style={styles.settingLabel}>{label}</Text><View style={[styles.switchTrack, value && styles.switchTrackOn]}><View style={[styles.switchThumb, value && styles.switchThumbOn]} /></View></Pressable>;
}

function FinishDraftSheet({ visible, isBusy, onClose, onPublish, onSave }: { visible: boolean; isBusy: boolean; onClose: () => void; onPublish: () => void; onSave: () => void }) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportDraft = async (format: "PDF" | "JPG") => {
    setExportOpen(false);
    await Share.share({ message: `LineSpace ${format} export\n\nYour finished composition is ready to export from the rendered layout.` });
  };
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.finishRoot}><Pressable accessibilityLabel="Close publish choices" onPress={onClose} style={styles.finishBackdrop} /><View style={styles.finishSheet}><View style={styles.finishHandle} /><Text style={styles.finishEyebrow}>04 · FINISH</Text><Text style={styles.finishTitle}>How would you like to carry it forward?</Text><Text style={styles.finishHint}>Publish to LineSpace, keep a private draft, or export this layout for elsewhere.</Text><Pressable accessibilityRole="button" disabled={isBusy} onPress={onPublish} style={styles.publishChoice}><Text style={styles.publishChoiceTitle}>Publish</Text><Text style={styles.publishChoiceHint}>Make this {"post"} visible now</Text></Pressable><Pressable accessibilityRole="button" disabled={isBusy} onPress={onSave} style={styles.saveChoice}><Text style={styles.saveChoiceTitle}>Save to draft</Text><Text style={styles.saveChoiceHint}>Keep editing privately</Text></Pressable><Pressable accessibilityRole="button" disabled={isBusy} onPress={() => setExportOpen((value) => !value)} style={styles.exportChoice}><Text style={styles.exportChoiceTitle}>Export</Text><Text style={styles.exportChoiceHint}>Use the designed layout as PDF or JPG</Text></Pressable>{exportOpen ? <View style={styles.exportRow}><Pressable onPress={() => void exportDraft("PDF")} style={styles.exportButton}><Text style={styles.exportButtonText}>PDF</Text></Pressable><Pressable onPress={() => void exportDraft("JPG")} style={styles.exportButton}><Text style={styles.exportButtonText}>JPG</Text></Pressable></View> : null}<Pressable accessibilityRole="button" disabled={isBusy} onPress={onClose} style={styles.cancelChoice}><Text style={styles.cancelText}>Not yet</Text></Pressable></View></View></Modal>;
}

function LayoutWorkspace({
  draft,
  catalog,
  layout,
  activeTool,
  onSelectLayout,
  onToolChange
}: {
  draft: PoemDraft;
  catalog: PoemDesignCatalog;
  layout: PoemLayoutConfig;
  activeTool: LayoutTool;
  onSelectLayout: (layout: PoemLayoutConfig) => void;
  onToolChange: (tool: LayoutTool) => void;
}) {
  const background = catalog.backgrounds.find((item) => item.id === layout.backgroundId)!;
  const typography = catalog.typography.find((item) => item.id === layout.typographyId)!;
  const stickerSymbols = layout.stickerIds
    .map((id) => catalog.stickers.find((item) => item.id === id)?.symbol)
    .filter((symbol): symbol is string => Boolean(symbol));
  const lines = draft.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const mediaSource: ImageSourcePropType | undefined =
    draft.media?.kind === "image" ? { uri: draft.media.uri } : undefined;

  return (
    <View style={styles.workspace}>
      <ScrollView contentContainerStyle={styles.canvas} showsVerticalScrollIndicator={false}>
        {draft.versionLines?.length ? (
          <VersionLayoutCard
            backgroundColor={background.swatch}
            draft={draft}
            mediaSource={mediaSource}
            style={styles.previewCard}
            typographyColor={typography.swatch}
          />
        ) : <PoemLayoutCard
          backgroundRole={background.role}
          mediaAspectRatio={getMediaAspectRatio(draft.media)}
          mediaSource={mediaSource}
          poem={{
            title: draft.title || "untitled line",
            lines: lines.length > 0 ? lines : ["A line is waiting to be written."],
            tags: draft.tags,
            byline: draft.byline || draft.collaborators[0]?.user.displayName || "writer",
            startedAtLabel: formatPoemDate(draft.createdAt)
          }}
          stickerSymbols={stickerSymbols}
          style={styles.previewCard}
          typographyRole={typography.role}
        />}
      </ScrollView>

      <OptionTray
        activeTool={activeTool}
        catalog={catalog}
        layout={layout}
        onSelectLayout={onSelectLayout}
      />

      <View style={styles.toolbar}>
        <ToolButton active={activeTool === "template"} label="Template" onPress={() => onToolChange("template")}><TemplateIcon /></ToolButton>
        <ToolButton active={activeTool === "typography"} label="Typography" onPress={() => onToolChange("typography")}><TypographyIcon /></ToolButton>
        <ToolButton active={activeTool === "background"} label="Paper" onPress={() => onToolChange("background")}><BackgroundPaperIcon /></ToolButton>
      </View>
    </View>
  );
}

function VersionLayoutCard({
  draft,
  mediaSource,
  backgroundColor,
  typographyColor,
  style
}: {
  draft: PoemDraft;
  mediaSource?: ImageSourcePropType;
  backgroundColor: string;
  typographyColor: string;
  style?: object;
}) {
  const lines = draft.versionLines ?? [];
  return (
    <View style={[styles.versionLayoutCard, { backgroundColor }, style]}>
      {mediaSource ? <Image resizeMode="cover" source={mediaSource} style={styles.versionLayoutImage} /> : null}
      <View style={styles.versionLayoutWash} />
      <Text style={[styles.versionLayoutTitle, { color: typographyColor }]}>
        {draft.title || "untitled line"}
      </Text>
      {lines.map((line) => (
        <View key={`${line.lineNumber}-${line.author.id}`} style={styles.versionLayoutLine}>
          <Avatar
            color={line.author.avatarColor}
            imageSource={line.author.avatarUrl ? { uri: line.author.avatarUrl } : undefined}
            label={line.author.displayName}
            size={28}
          />
          <View style={styles.versionLayoutLineCopy}>
            <Text style={[styles.versionLayoutAuthor, { color: typographyColor }]}>
              {line.lineNumber}. @{line.author.handle}
            </Text>
            <Text style={[styles.versionLayoutText, { color: typographyColor }]}>
              {line.text}
            </Text>
          </View>
        </View>
      ))}
      <Text style={[styles.versionLayoutByline, { color: typographyColor }]}>
        by {draft.byline}
      </Text>
    </View>
  );
}

function OptionTray({
  activeTool,
  catalog,
  layout,
  onSelectLayout
}: {
  activeTool: LayoutTool;
  catalog: PoemDesignCatalog;
  layout: PoemLayoutConfig;
  onSelectLayout: (layout: PoemLayoutConfig) => void;
}) {
  const options = activeTool === "template" ? catalog.templates : activeTool === "typography" ? catalog.typography : catalog.backgrounds;
  return (
    <View style={styles.optionTray}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionContent}>
        {options.map((option) => {
          const selected = activeTool === "template" ? option.id === layout.templateId : activeTool === "typography" ? option.id === layout.typographyId : option.id === layout.backgroundId;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (activeTool === "template") {
                  onSelectLayout({ ...(option as PoemDesignCatalog["templates"][number]).layout, stickerIds: [...(option as PoemDesignCatalog["templates"][number]).layout.stickerIds] });
                } else if (activeTool === "typography") {
                  onSelectLayout({ ...layout, typographyId: option.id as PoemTypographyId });
                } else {
                  onSelectLayout({ ...layout, backgroundId: option.id as PoemBackgroundId });
                }
              }}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
            >
              <View style={[styles.swatch, { backgroundColor: option.swatch }]}>
                {activeTool === "typography" ? <Text style={styles.swatchLetter}>Aa</Text> : null}
              </View>
              <Text numberOfLines={1} style={styles.optionLabel}>{option.label}</Text>
              <Text numberOfLines={1} style={styles.optionDescription}>{option.description}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ToolButton({ children, label, active, onPress }: { children: ReactNode; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={styles.toolButton}>
      <View style={[styles.toolIcon, active && styles.toolIconActive]}>{children}</View>
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function getParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatPoemDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}/${`${date.getMonth() + 1}`.padStart(2, "0")}/${`${date.getDate()}`.padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  versionLayoutCard: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    minHeight: 520,
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderRadius: 26
  },
  versionLayoutImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.32 },
  versionLayoutWash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,.32)" },
  versionLayoutTitle: {
    position: "relative",
    marginBottom: 18,
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700"
  },
  versionLayoutLine: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 9
  },
  versionLayoutLineCopy: { flex: 1, minWidth: 0 },
  versionLayoutAuthor: { fontSize: 11, lineHeight: 14, fontWeight: "700", opacity: 0.72 },
  versionLayoutText: { marginTop: 4, fontFamily: "Georgia", fontSize: 17, lineHeight: 25 },
  versionLayoutByline: {
    position: "relative",
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,.22)",
    fontSize: 11,
    fontWeight: "600"
  },
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { flex: 1, paddingBottom: 0, backgroundColor: colors.profileCanvas },
  header: { height: 101, paddingBottom: 11, backgroundColor: colors.white, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  closeButton: { width: 48, height: 40, marginLeft: 4, alignItems: "center", justifyContent: "center" },
  closeGlyph: { color: colors.black, fontSize: 30, lineHeight: 32, fontWeight: "300" },
  headerCopy: { alignItems: "center", paddingBottom: 2 },
  headerTitle: { color: colors.black, fontSize: 20, lineHeight: 24 },
  headerSubtitle: { marginTop: 1, color: colors.tabMuted, fontSize: 9, lineHeight: 12 },
  doneButton: { width: 58, height: 40, marginRight: 7, alignItems: "center", justifyContent: "center" },
  doneText: { color: "#868686", fontSize: 20, lineHeight: 24 },
  workspace: { flex: 1 },
  canvas: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 22 },
  previewCard: { width: "100%", minHeight: 470, shadowColor: colors.black, shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  optionTray: { height: 134, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.surfaceWarm },
  optionContent: { paddingHorizontal: 15, paddingVertical: 12, gap: 10 },
  optionCard: { width: 118, padding: 8, borderRadius: 14, borderWidth: 1, borderColor: "transparent", backgroundColor: colors.surface },
  optionCardSelected: { borderColor: colors.ink },
  swatch: { height: 45, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  swatchLetter: { color: colors.white, fontFamily: "Georgia", fontSize: 18, fontStyle: "italic" },
  optionLabel: { marginTop: 6, color: colors.ink, fontSize: 11, lineHeight: 14, fontWeight: "500" },
  optionDescription: { marginTop: 1, color: colors.profileMuted, fontSize: 8, lineHeight: 11 },
  toolbar: { height: 72, paddingHorizontal: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toolButton: { minWidth: 78, alignItems: "center", justifyContent: "center" },
  toolIcon: { width: 42, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  toolIconActive: { backgroundColor: colors.surfacePressed },
  toolLabel: { marginTop: 2, color: colors.tabMuted, fontSize: 9, lineHeight: 12 },
  toolLabelActive: { color: colors.ink },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  errorText: { color: colors.accent, fontSize: 13, lineHeight: 18 },
  floatingError: { position: "absolute", left: 20, right: 20, bottom: 215, padding: 10, borderRadius: radius.md, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.94)", color: colors.accent, fontSize: 11, lineHeight: 15, textAlign: "center" },
  settingsStage: { padding: 20, paddingBottom: 36 }, stageEyebrow: { color: colors.profileMuted, fontSize: 10, letterSpacing: 1.4 }, stageTitle: { marginTop: 9, color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: "600" }, stageHint: { marginTop: 9, color: colors.profileMuted, fontSize: 13, lineHeight: 19 }, audienceSetting: { minHeight: 76, marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, settingLabel: { color: colors.ink, fontSize: 16, lineHeight: 21 }, settingValue: { marginTop: 4, color: colors.profileMuted, fontSize: 12, lineHeight: 16 }, settingChevron: { color: colors.ink, fontSize: 28 }, settingToggle: { minHeight: 62, paddingHorizontal: 16, marginTop: 10, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, switchTrack: { width: 50, height: 29, paddingHorizontal: 1, borderRadius: radius.pill, backgroundColor: "#D9D9D9", justifyContent: "center" }, switchTrackOn: { backgroundColor: "#50B973" }, switchThumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.faint }, switchThumbOn: { alignSelf: "flex-end" }, settingsNext: { minHeight: 56, marginTop: 24, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, settingsNextText: { color: colors.white, fontSize: 16, fontWeight: "600" }, settingsNextArrow: { color: colors.white, fontSize: 22 },
  finishRoot: { flex: 1, justifyContent: "flex-end" }, finishBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" }, finishSheet: { paddingHorizontal: 20, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface }, finishHandle: { alignSelf: "center", width: 42, height: 4, marginTop: 9, borderRadius: radius.pill, backgroundColor: colors.faint }, finishEyebrow: { marginTop: 20, color: colors.profileMuted, fontSize: 10, letterSpacing: 1.2 }, finishTitle: { marginTop: 8, color: colors.ink, fontSize: 24, lineHeight: 30 }, finishHint: { marginTop: 8, color: colors.profileMuted, fontSize: 13, lineHeight: 18 }, publishChoice: { marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: colors.black }, publishChoiceTitle: { color: colors.white, fontSize: 18 }, publishChoiceHint: { marginTop: 3, color: "rgba(255,255,255,0.65)", fontSize: 12 }, saveChoice: { marginTop: 10, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, saveChoiceTitle: { color: colors.ink, fontSize: 18 }, saveChoiceHint: { marginTop: 3, color: colors.profileMuted, fontSize: 12 }, exportChoice: { marginTop: 10, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceWarm }, exportChoiceTitle: { color: colors.ink, fontSize: 18 }, exportChoiceHint: { marginTop: 3, color: colors.profileMuted, fontSize: 12 }, exportRow: { marginTop: 8, flexDirection: "row", gap: 8 }, exportButton: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", borderWidth: 1, borderColor: colors.line }, exportButtonText: { color: colors.ink, fontSize: 13, fontWeight: "600" }, cancelChoice: { marginTop: 10, alignItems: "center", padding: 13 }, cancelText: { color: colors.profileMuted, fontSize: 14 }
});
