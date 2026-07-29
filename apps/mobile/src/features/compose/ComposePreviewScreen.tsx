import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type TextStyle
} from "react-native";
import {
  AppScreen,
  BackgroundPaperIcon,
  PoemLayoutCard,
  StickerIcon,
  TemplateIcon,
  TypographyIcon
} from "@linespace/ui";
import { colors, radius } from "@linespace/tokens";
import type {
  PoemBackgroundId,
  PoemDesignCatalog,
  PoemDraft,
  PoemLayoutConfig,
  PoemStickerId,
  PoemTypographyId,
  PoemDraftSettings
} from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { tabRoutes } from "@/navigation/tabs";
import { getMediaAspectRatio } from "@/features/poem/poemPresentation";
import {
  exportPoemCard,
  type PoemCardExportFormat
} from "@/utils/poemCardExport";
import { VisibilityAudienceSheet } from "./VisibilityAudienceSheet";

type SearchParamValue = string | string[] | undefined;

type ComposePreviewScreenProps = {
  params: Record<string, SearchParamValue>;
};

type LayoutTool = "template" | "typography" | "background" | "sticker";

export function ComposePreviewScreen({ params }: ComposePreviewScreenProps) {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? "";
  const draftId = getParam(params.draftId);
  const editPostId = getParam(params.editPostId);
  const [activeTool, setActiveTool] = useState<LayoutTool>("template");
  const [layout, setLayout] = useState<PoemLayoutConfig | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [step, setStep] = useState<2 | 3>(2);
  const [settings, setSettings] = useState<PoemDraftSettings | null>(null);
  const exportCardRef = useRef<View | null>(null);

  const draftQuery = useQuery({
    queryKey: ["compose-draft", draftId],
    queryFn: () => lineSpaceApi.getPoemDraft(draftId),
    enabled: Boolean(draftId) && currentUserId.length > 0,
    staleTime: 60_000
  });
  const catalogQuery = useQuery({
    queryKey: ["poem-design-catalog"],
    queryFn: () => lineSpaceApi.getPoemDesignCatalog(),
    staleTime: Infinity
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
      if (layout || settings) {
        const draft = await lineSpaceApi.updatePoemDraft({
          draftId,
          userId: currentUserId,
          ...(layout ? { layout } : {}),
          ...(settings ? { settings } : {})
        });
        queryClient.setQueryData(["compose-draft", draft.id], draft);
      }
      if (draftQuery.data?.mode === "relay") return lineSpaceApi.publishThreadDraft({ draftId, userId: currentUserId });
      return lineSpaceApi.publishPoemDraft({
        draftId,
        userId: currentUserId,
        ...(editPostId ? { replacePostId: editPostId } : {})
      });
    },
    onSuccess: () => {
      setFinishOpen(false);
      queryClient.removeQueries({ queryKey: ["compose-draft-session", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-profile-content", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["user-drafts", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["content-search"] });
      router.replace(draftQuery.data?.mode === "relay" ? tabRoutes.thread : tabRoutes.post);
    }
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (layout || settings) {
        const draft = await lineSpaceApi.updatePoemDraft({
          draftId,
          userId: currentUserId,
          ...(layout ? { layout } : {}),
          ...(settings ? { settings } : {})
        });
        queryClient.setQueryData(["compose-draft", draft.id], draft);
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
        onExport={async (format) => {
          const draft = draftQuery.data;
          if (!draft) throw new Error("The poem card is still preparing.");
          const backgroundColor =
            catalogQuery.data?.backgrounds.find(
              (background) => background.id === layout?.backgroundId
            )?.swatch;
          await exportPoemCard(exportCardRef.current, {
            format,
            title: draft.title,
            backgroundColor
          });
        }}
        onPublish={() => publishMutation.mutate()}
        onSave={() => saveMutation.mutate()}
        visible={finishOpen}
      />
      {draftQuery.data && catalogQuery.data && layout ? (
        <ComposeExportCanvas
          catalog={catalogQuery.data}
          draft={draftQuery.data}
          exportRef={exportCardRef}
          layout={layout}
        />
      ) : null}
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

function FinishDraftSheet({
  visible,
  isBusy,
  onClose,
  onPublish,
  onSave,
  onExport
}: {
  visible: boolean;
  isBusy: boolean;
  onClose: () => void;
  onPublish: () => void;
  onSave: () => void;
  onExport: (format: PoemCardExportFormat) => Promise<void>;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<PoemCardExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportDraft = async (format: "PDF" | "JPG") => {
    setExportOpen(false);
    setExportError(null);
    setExporting(format);
    try {
      await onExport(format);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The poem card could not be exported. Please try again."
      );
    } finally {
      setExporting(null);
    }
  };
  const busy = isBusy || exporting !== null;
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.finishRoot}><Pressable accessibilityLabel="Close publish choices" onPress={onClose} style={styles.finishBackdrop} /><View style={styles.finishSheet}><View style={styles.finishHandle} /><Text style={styles.finishEyebrow}>04 · FINISH</Text><Text style={styles.finishTitle}>How would you like to carry it forward?</Text><Text style={styles.finishHint}>Publish to LineSpace, keep a private draft, or export this layout for elsewhere.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={onPublish} style={styles.publishChoice}><Text style={styles.publishChoiceTitle}>Publish</Text><Text style={styles.publishChoiceHint}>Make this {"post"} visible now</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={styles.saveChoice}><Text style={styles.saveChoiceTitle}>Save to draft</Text><Text style={styles.saveChoiceHint}>Keep editing privately</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => setExportOpen((value) => !value)} style={styles.exportChoice}><Text style={styles.exportChoiceTitle}>{exporting ? `Preparing ${exporting}…` : "Export"}</Text><Text style={styles.exportChoiceHint}>Download this exact poem card as PDF or JPG</Text></Pressable>{exportOpen ? <View style={styles.exportRow}><Pressable disabled={busy} onPress={() => void exportDraft("PDF")} style={styles.exportButton}><Text style={styles.exportButtonText}>PDF</Text></Pressable><Pressable disabled={busy} onPress={() => void exportDraft("JPG")} style={styles.exportButton}><Text style={styles.exportButtonText}>JPG</Text></Pressable></View> : null}{exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancelChoice}><Text style={styles.cancelText}>Not yet</Text></Pressable></View></View></Modal>;
}

function ComposeExportCanvas({
  draft,
  catalog,
  layout,
  exportRef
}: {
  draft: PoemDraft;
  catalog: PoemDesignCatalog;
  layout: PoemLayoutConfig;
  exportRef: Ref<View>;
}) {
  const background = catalog.backgrounds.find((item) => item.id === layout.backgroundId)!;
  const typography = catalog.typography.find((item) => item.id === layout.typographyId)!;
  const stickerSymbols = layout.stickerIds
    .map((id) => catalog.stickers.find((item) => item.id === id)?.symbol)
    .filter((symbol): symbol is string => Boolean(symbol));
  const lines = draft.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const displayLines = draft.versionLines?.length
    ? draft.versionLines.map((line) => line.text)
    : lines;
  const mediaSource: ImageSourcePropType | undefined =
    draft.media?.kind === "image" ? { uri: draft.media.uri } : undefined;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.exportCaptureStage}
    >
      <View collapsable={false} ref={exportRef} style={styles.exportCaptureCard}>
        <PoemLayoutCard
          backgroundRole={background.role}
          mediaAspectRatio={getMediaAspectRatio(draft.media)}
          mediaSource={mediaSource}
          poem={{
            title: draft.title || "untitled line",
            lines: displayLines.length > 0
              ? displayLines
              : ["A line is waiting to be written."],
            tags: draft.tags,
            byline:
              draft.byline ||
              draft.collaborators[0]?.user.displayName ||
              "writer",
            startedAtLabel: formatPoemDate(draft.createdAt)
          }}
          stickerSymbols={stickerSymbols}
          typographyRole={typography.role}
        />
      </View>
    </View>
  );
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
  const displayLines = draft.versionLines?.length
    ? draft.versionLines.map((line) => line.text)
    : lines;
  const mediaSource: ImageSourcePropType | undefined =
    draft.media?.kind === "image" ? { uri: draft.media.uri } : undefined;

  return (
    <View style={styles.workspace}>
      <ScrollView contentContainerStyle={styles.canvas} showsVerticalScrollIndicator={false}>
        <PoemLayoutCard
          backgroundRole={background.role}
          mediaAspectRatio={getMediaAspectRatio(draft.media)}
          mediaSource={mediaSource}
          poem={{
            title: draft.title || "untitled line",
            lines: displayLines.length > 0
              ? displayLines
              : ["A line is waiting to be written."],
            tags: draft.tags,
            byline: draft.byline || draft.collaborators[0]?.user.displayName || "writer",
            startedAtLabel: formatPoemDate(draft.createdAt)
          }}
          stickerSymbols={stickerSymbols}
          style={styles.previewCard}
          typographyRole={typography.role}
        />
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
        <ToolButton active={activeTool === "sticker"} label="Sticker" onPress={() => onToolChange("sticker")}><StickerIcon /></ToolButton>
      </View>
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
  const options =
    activeTool === "template"
      ? catalog.templates
      : activeTool === "typography"
        ? catalog.typography
        : activeTool === "background"
          ? catalog.backgrounds
          : catalog.stickers;
  return (
    <View style={styles.optionTray}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionContent}>
        {options.map((option) => {
          const template =
            activeTool === "template"
              ? (option as PoemDesignCatalog["templates"][number])
              : undefined;
          const paperRole =
            activeTool === "background"
              ? (option.role as PoemDesignCatalog["backgrounds"][number]["role"])
              : template
                ? catalog.backgrounds.find(
                    (background) =>
                      background.id === template.layout.backgroundId
                  )?.role
                : undefined;
          const previewTypographyRole =
            activeTool === "typography"
              ? (option.role as PoemDesignCatalog["typography"][number]["role"])
              : template
                ? catalog.typography.find(
                    (typography) =>
                      typography.id === template.layout.typographyId
                  )?.role
                : undefined;
          const previewSticker =
            template?.layout.stickerIds.length
              ? catalog.stickers.find(
                  (sticker) =>
                    sticker.id === template.layout.stickerIds[0]
                )?.symbol
              : undefined;
          const selected =
            activeTool === "template"
              ? option.id === layout.templateId
              : activeTool === "typography"
                ? option.id === layout.typographyId
                : activeTool === "background"
                  ? option.id === layout.backgroundId
                  : layout.stickerIds.includes(option.id as PoemStickerId);
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
                } else if (activeTool === "background") {
                  onSelectLayout({ ...layout, backgroundId: option.id as PoemBackgroundId });
                } else {
                  const stickerId = option.id as PoemStickerId;
                  onSelectLayout({
                    ...layout,
                    stickerIds: layout.stickerIds.includes(stickerId)
                      ? layout.stickerIds.filter((id) => id !== stickerId)
                      : [...layout.stickerIds, stickerId].slice(-2)
                  });
                }
              }}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
            >
              <View style={[styles.swatch, { backgroundColor: option.swatch }]}>
                {paperRole ? <PaperSwatchTexture role={paperRole} /> : null}
                {previewTypographyRole ? (
                  <Text
                    style={[
                      styles.swatchLetter,
                      typographyPreviewStyles[previewTypographyRole],
                      activeTool === "template" &&
                        paperRole !== "dark" &&
                        styles.swatchTemplateInk
                    ]}
                  >
                    中 Aa
                  </Text>
                ) : activeTool === "sticker" ? (
                  <Text style={styles.swatchSticker}>
                    {"symbol" in option ? option.symbol : ""}
                  </Text>
                ) : null}
                {activeTool === "template" && previewSticker ? (
                  <Text
                    style={[
                      styles.swatchTemplateSticker,
                      paperRole !== "dark" && styles.swatchTemplateInk
                    ]}
                  >
                    {previewSticker}
                  </Text>
                ) : null}
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

function PaperSwatchTexture({
  role
}: {
  role: PoemDesignCatalog["backgrounds"][number]["role"];
}) {
  if (role === "ruled") {
    return (
      <View pointerEvents="none" style={styles.swatchTexture}>
        {[12, 23, 34].map((top) => (
          <View key={top} style={[styles.swatchRule, { top }]} />
        ))}
      </View>
    );
  }
  if (role === "grid") {
    return (
      <View pointerEvents="none" style={styles.swatchTexture}>
        {[11, 22, 33].map((top) => (
          <View key={`h-${top}`} style={[styles.swatchGridHorizontal, { top }]} />
        ))}
        {[28, 52, 76].map((left) => (
          <View key={`v-${left}`} style={[styles.swatchGridVertical, { left }]} />
        ))}
      </View>
    );
  }
  if (role === "postcard") {
    return (
      <View pointerEvents="none" style={styles.swatchTexture}>
        <View style={styles.swatchPostcardTop} />
        <View style={styles.swatchPostcardBottom} />
      </View>
    );
  }
  if (role === "dark") {
    return (
      <View pointerEvents="none" style={styles.swatchTexture}>
        <View style={styles.swatchMoon} />
      </View>
    );
  }
  if (role === "rice" || role === "kraft") {
    return (
      <View pointerEvents="none" style={styles.swatchTexture}>
        <Text style={styles.swatchFibres}>╱  ╲   ╱  ╲</Text>
      </View>
    );
  }
  if (role === "blush") {
    return (
      <View pointerEvents="none" style={styles.swatchTexture}>
        <View style={styles.swatchBlush} />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={styles.swatchTexture}>
      <View style={styles.swatchMuseumFrame} />
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

const cjkSerifPreview = Platform.select({
  ios: "Songti SC",
  android: "serif",
  web: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif',
  default: "Georgia"
});
const cjkSansPreview = Platform.select({
  ios: "PingFang SC",
  android: "sans-serif",
  web: '"Noto Sans SC", "Source Han Sans SC", "PingFang SC", system-ui, sans-serif',
  default: "System"
});
const cjkMonoPreview = Platform.select({
  ios: "Menlo",
  android: "monospace",
  web: '"Noto Sans Mono CJK SC", "SFMono-Regular", Consolas, monospace',
  default: "monospace"
});
const typographyPreviewStyles: Record<
  PoemDesignCatalog["typography"][number]["role"],
  TextStyle
> = {
  serif: { fontFamily: "Georgia", fontStyle: "italic" },
  script: {
    fontFamily: Platform.select({
      ios: "Snell Roundhand",
      android: "cursive",
      web: "cursive",
      default: "Georgia"
    })
  },
  sans: { fontFamily: cjkSansPreview },
  editorial: { fontFamily: cjkSerifPreview },
  rounded: { fontFamily: cjkSansPreview, fontWeight: "600" },
  mono: { fontFamily: cjkMonoPreview }
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.profileCanvas },
  screen: { flex: 1, paddingBottom: 0, backgroundColor: colors.profileCanvas },
  exportCaptureStage: {
    position: "absolute",
    left: -10000,
    top: 0,
    width: 420
  },
  exportCaptureCard: { width: 420 },
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
  swatchLetter: { color: colors.white, fontSize: 16 },
  swatchSticker: { color: colors.white, fontSize: 24, lineHeight: 28 },
  swatchTemplateInk: { color: "rgba(21,21,21,0.78)" },
  swatchTemplateSticker: { position: "absolute", right: 7, top: 4, color: "rgba(255,255,255,0.78)", fontSize: 12 },
  swatchTexture: { ...StyleSheet.absoluteFillObject, overflow: "hidden", borderRadius: 9 },
  swatchRule: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(62,90,102,0.22)" },
  swatchGridHorizontal: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(64,104,108,0.20)" },
  swatchGridVertical: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(64,104,108,0.16)" },
  swatchPostcardTop: { position: "absolute", left: 0, right: 0, top: 3, height: 3, backgroundColor: "rgba(157,93,77,0.55)" },
  swatchPostcardBottom: { position: "absolute", left: 0, right: 0, bottom: 3, height: 3, backgroundColor: "rgba(68,107,132,0.48)" },
  swatchMoon: { position: "absolute", right: -8, top: -10, width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(242,231,199,0.12)" },
  swatchFibres: { position: "absolute", left: 4, top: 12, color: "rgba(73,54,39,0.19)", fontSize: 13, letterSpacing: 3 },
  swatchBlush: { position: "absolute", right: -12, bottom: -15, width: 66, height: 66, borderRadius: 33, backgroundColor: "rgba(194,119,136,0.15)" },
  swatchMuseumFrame: { position: "absolute", left: 5, right: 5, top: 5, bottom: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(53,61,62,0.30)" },
  optionLabel: { marginTop: 6, color: colors.ink, fontSize: 11, lineHeight: 14, fontWeight: "500" },
  optionDescription: { marginTop: 1, color: colors.profileMuted, fontSize: 8, lineHeight: 11 },
  toolbar: { height: 72, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toolButton: { minWidth: 68, alignItems: "center", justifyContent: "center" },
  toolIcon: { width: 42, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  toolIconActive: { backgroundColor: colors.surfacePressed },
  toolLabel: { marginTop: 2, color: colors.tabMuted, fontSize: 9, lineHeight: 12 },
  toolLabelActive: { color: colors.ink },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  errorText: { color: colors.accent, fontSize: 13, lineHeight: 18 },
  floatingError: { position: "absolute", left: 20, right: 20, bottom: 215, padding: 10, borderRadius: radius.md, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.94)", color: colors.accent, fontSize: 11, lineHeight: 15, textAlign: "center" },
  settingsStage: { padding: 20, paddingBottom: 36 }, stageEyebrow: { color: colors.profileMuted, fontSize: 10, letterSpacing: 1.4 }, stageTitle: { marginTop: 9, color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: "600" }, stageHint: { marginTop: 9, color: colors.profileMuted, fontSize: 13, lineHeight: 19 }, audienceSetting: { minHeight: 76, marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, settingLabel: { color: colors.ink, fontSize: 16, lineHeight: 21 }, settingValue: { marginTop: 4, color: colors.profileMuted, fontSize: 12, lineHeight: 16 }, settingChevron: { color: colors.ink, fontSize: 28 }, settingToggle: { minHeight: 62, paddingHorizontal: 16, marginTop: 10, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, switchTrack: { width: 50, height: 29, paddingHorizontal: 1, borderRadius: radius.pill, backgroundColor: "#D9D9D9", justifyContent: "center" }, switchTrackOn: { backgroundColor: "#50B973" }, switchThumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.faint }, switchThumbOn: { alignSelf: "flex-end" }, settingsNext: { minHeight: 56, marginTop: 24, paddingHorizontal: 18, borderRadius: 16, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, settingsNextText: { color: colors.white, fontSize: 16, fontWeight: "600" }, settingsNextArrow: { color: colors.white, fontSize: 22 },
  finishRoot: { flex: 1, justifyContent: "flex-end" }, finishBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" }, finishSheet: { paddingHorizontal: 20, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface }, finishHandle: { alignSelf: "center", width: 42, height: 4, marginTop: 9, borderRadius: radius.pill, backgroundColor: colors.faint }, finishEyebrow: { marginTop: 20, color: colors.profileMuted, fontSize: 10, letterSpacing: 1.2 }, finishTitle: { marginTop: 8, color: colors.ink, fontSize: 24, lineHeight: 30 }, finishHint: { marginTop: 8, color: colors.profileMuted, fontSize: 13, lineHeight: 18 }, publishChoice: { marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: colors.black }, publishChoiceTitle: { color: colors.white, fontSize: 18 }, publishChoiceHint: { marginTop: 3, color: "rgba(255,255,255,0.65)", fontSize: 12 }, saveChoice: { marginTop: 10, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, saveChoiceTitle: { color: colors.ink, fontSize: 18 }, saveChoiceHint: { marginTop: 3, color: colors.profileMuted, fontSize: 12 }, exportChoice: { marginTop: 10, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceWarm }, exportChoiceTitle: { color: colors.ink, fontSize: 18 }, exportChoiceHint: { marginTop: 3, color: colors.profileMuted, fontSize: 12 }, exportRow: { marginTop: 8, flexDirection: "row", gap: 8 }, exportButton: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", borderWidth: 1, borderColor: colors.line }, exportButtonText: { color: colors.ink, fontSize: 13, fontWeight: "600" }, exportError: { marginTop: 9, color: colors.accent, fontSize: 11, lineHeight: 15, textAlign: "center" }, cancelChoice: { marginTop: 10, alignItems: "center", padding: 13 }, cancelText: { color: colors.profileMuted, fontSize: 14 }
});
