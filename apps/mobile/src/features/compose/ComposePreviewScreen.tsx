import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType
} from "react-native";
import {
  AppScreen,
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
  PoemTypographyId
} from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

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
      return lineSpaceApi.publishPoemDraft({ draftId, userId: currentUserId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      router.replace("/(tabs)/discover" as Href);
    }
  });

  useEffect(() => {
    if (draftQuery.data && !layout) setLayout(draftQuery.data.layout);
  }, [draftQuery.data, layout]);

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
          <Text style={styles.headerTitle}>layout</Text>
          <Text style={styles.headerSubtitle}>make the poem feel like yours</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={!draftId || publishMutation.isPending} onPress={() => publishMutation.mutate()} style={styles.doneButton}>
          {publishMutation.isPending ? <ActivityIndicator color={colors.profileMuted} /> : <Text style={styles.doneText}>done</Text>}
        </Pressable>
      </View>

      {!draftId || draftQuery.isError || !draftQuery.data ? (
        <View style={styles.centerState}>
          {draftQuery.isLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.errorText}>The draft could not be opened.</Text>}
        </View>
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
    </AppScreen>
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
  const mediaSource: ImageSourcePropType | undefined =
    draft.media?.kind === "image" ? { uri: draft.media.uri } : undefined;

  return (
    <View style={styles.workspace}>
      <ScrollView contentContainerStyle={styles.canvas} showsVerticalScrollIndicator={false}>
        <PoemLayoutCard
          backgroundRole={background.role}
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
  floatingError: { position: "absolute", left: 20, right: 20, bottom: 215, padding: 10, borderRadius: radius.md, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.94)", color: colors.accent, fontSize: 11, lineHeight: 15, textAlign: "center" }
});
