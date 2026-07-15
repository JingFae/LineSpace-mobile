import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  AppScreen,
  Avatar,
  BottomNavigation,
  ContinueIcon,
  EmptyState,
  LikeIcon,
  MenuIcon,
  SearchIcon,
  ShareIcon
} from "@linespace/ui";
import { colors, radius, spacing, typography } from "@linespace/tokens";
import type {
  ContinuationDetail,
  PoetryThread,
  ThreadContinuation,
  ThreadDetail,
  ThreadSort,
  ThreadShareTarget,
  UserProfileDetails
} from "@linespace/api-client";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { mainTabs, tabRoutes } from "@/navigation/tabs";

type ComposerTarget =
  | { kind: "thread"; thread: PoetryThread }
  | { kind: "continuation"; continuation: ThreadContinuation };

type ShareNotice = {
  id: string;
  message: string;
};

const sortTabs: Array<{ value: ThreadSort; label: string }> = [
  { value: "top", label: "Top" },
  { value: "latest", label: "Latest" },
  { value: "following", label: "Following" }
];

export function ThreadFeedScreen() {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ThreadSort>("top");
  const [composerTarget, setComposerTarget] = useState<ComposerTarget | null>(null);
  const [shareNotice, setShareNotice] = useState<ShareNotice | null>(null);

  const profileQuery = useCurrentProfile();
  const threadQuery = useQuery({
    queryKey: ["threads", sort, currentUserId],
    queryFn: () => lineSpaceApi.listThreads({ sort, viewerId: currentUserId })
  });
  const likeMutation = useThreadLikeMutation();
  const shareMutation = useShareMutation((notice) => setShareNotice(notice));

  const threads = threadQuery.data ?? [];

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <ThreadTopBar title="Thread" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
        <QuickStart profile={profileQuery.data} onPress={() => router.push("/(tabs)/compose" as Href)} />
        <View style={styles.sortRow}>
          {sortTabs.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: sort === item.value }}
              onPress={() => setSort(item.value)}
              style={[styles.sortPill, sort === item.value && styles.sortPillActive]}
            >
              <Text style={[styles.sortText, sort === item.value && styles.sortTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {threadQuery.isLoading ? (
          <ThreadListState title="Loading threads" />
        ) : threadQuery.isError ? (
          <EmptyState
            title="Threads unavailable"
            body="The community thread feed could not be loaded."
          />
        ) : threads.length === 0 ? (
          <EmptyState
            title="No poetry threads yet"
            body="Start a prompt and invite the community to continue it."
          />
        ) : (
          threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onContinue={() => setComposerTarget({ kind: "thread", thread })}
              onLike={() =>
                likeMutation.mutate({
                  threadId: thread.id,
                  userId: currentUserId,
                  isActive: !thread.viewer.liked
                })
              }
              onOpen={() => router.push({ pathname: "/thread/[id]", params: { id: thread.id } })}
              onShare={() =>
                shareMutation.mutate({
                  kind: "thread",
                  threadId: thread.id,
                  userId: currentUserId
                })
              }
            />
          ))
        )}
      </ScrollView>

      <BottomNavigation
        items={mainTabs}
        onChange={(value) => {
          if (value === "compose") {
            router.push("/(tabs)/compose" as Href);
            return;
          }
          router.push(tabRoutes[value]);
        }}
        profileAvatar={profileAvatar(profileQuery.data)}
        value="thread"
      />

      <ContinueComposer
        onClose={() => setComposerTarget(null)}
        onSubmitted={() => {
          setComposerTarget(null);
          void queryClient.invalidateQueries({ queryKey: ["threads"] });
        }}
        target={composerTarget}
      />
      <ShareToast notice={shareNotice} onDismiss={() => setShareNotice(null)} />
    </AppScreen>
  );
}

export function ThreadDetailScreen({ threadId }: { threadId?: string }) {
  const queryClient = useQueryClient();
  const [composerTarget, setComposerTarget] = useState<ComposerTarget | null>(null);
  const [shareNotice, setShareNotice] = useState<ShareNotice | null>(null);
  const detailQuery = useQuery({
    queryKey: ["thread-detail", threadId, currentUserId],
    enabled: Boolean(threadId),
    queryFn: () => lineSpaceApi.getThread(threadId!, currentUserId)
  });
  const likeMutation = useThreadLikeMutation();
  const continuationLikeMutation = useContinuationLikeMutation();
  const shareMutation = useShareMutation((notice) => setShareNotice(notice));
  const detail = detailQuery.data ?? undefined;

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <DetailTopBar title="Thread" subtitle={detail?.thread.metrics.views ? `${formatCompact(detail.thread.metrics.views)} views` : undefined} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        {detailQuery.isLoading ? (
          <ThreadListState title="Loading thread" />
        ) : detailQuery.isError || !detail ? (
          <EmptyState title="Thread not found" body="This poetry thread could not be opened." />
        ) : (
          <>
            <ThreadCard
              elevated
              thread={detail.thread}
              onContinue={() => setComposerTarget({ kind: "thread", thread: detail.thread })}
              onLike={() =>
                likeMutation.mutate({
                  threadId: detail.thread.id,
                  userId: currentUserId,
                  isActive: !detail.thread.viewer.liked
                })
              }
              onOpen={() => undefined}
              onShare={() =>
                shareMutation.mutate({
                  kind: "thread",
                  threadId: detail.thread.id,
                  userId: currentUserId
                })
              }
            />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Direct continuations</Text>
              <Text style={styles.sectionMeta}>{detail.continuations.length} lines</Text>
            </View>
            {detail.continuations.length === 0 ? (
              <EmptyContinuationState
                cta="Continue this thread"
                title="No one has continued this thread yet."
                onPress={() => setComposerTarget({ kind: "thread", thread: detail.thread })}
              />
            ) : (
              detail.continuations.map((continuation) => (
                <ContinuationCard
                  key={continuation.id}
                  continuation={continuation}
                  onContinue={() => setComposerTarget({ kind: "continuation", continuation })}
                  onLike={() =>
                    continuationLikeMutation.mutate({
                      continuationId: continuation.id,
                      userId: currentUserId,
                      isActive: !continuation.viewer.liked
                    })
                  }
                  onOpen={() =>
                    router.push({
                      pathname: "/thread/continue/[id]",
                      params: { id: continuation.id }
                    })
                  }
                  onShare={() =>
                    shareMutation.mutate({
                      kind: "continuation",
                      continuationId: continuation.id,
                      userId: currentUserId
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>
      {detail ? (
        <FixedComposerButton
          label="Continue this thread..."
          onPress={() => setComposerTarget({ kind: "thread", thread: detail.thread })}
        />
      ) : null}
      <ContinueComposer
        onClose={() => setComposerTarget(null)}
        onSubmitted={() => {
          setComposerTarget(null);
          void queryClient.invalidateQueries({ queryKey: ["thread-detail", threadId] });
          void queryClient.invalidateQueries({ queryKey: ["threads"] });
        }}
        target={composerTarget}
      />
      <ShareToast notice={shareNotice} onDismiss={() => setShareNotice(null)} />
    </AppScreen>
  );
}

export function ContinueDetailScreen({ continuationId }: { continuationId?: string }) {
  const queryClient = useQueryClient();
  const [composerTarget, setComposerTarget] = useState<ComposerTarget | null>(null);
  const [shareNotice, setShareNotice] = useState<ShareNotice | null>(null);
  const detailQuery = useQuery({
    queryKey: ["continuation-detail", continuationId, currentUserId],
    enabled: Boolean(continuationId),
    queryFn: () => lineSpaceApi.getContinuationDetail(continuationId!, currentUserId)
  });
  const continuationLikeMutation = useContinuationLikeMutation();
  const shareMutation = useShareMutation((notice) => setShareNotice(notice));
  const detail = detailQuery.data ?? undefined;

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <DetailTopBar title="Continue" subtitle={detail ? `${detail.current.metrics.continuations} from here` : undefined} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        {detailQuery.isLoading ? (
          <ThreadListState title="Loading continuation" />
        ) : detailQuery.isError || !detail ? (
          <EmptyState title="Continue not found" body="This creative continuation could not be opened." />
        ) : (
          <>
            <ContinuationPath detail={detail} />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Continues from here</Text>
              <Text style={styles.sectionMeta}>{detail.children.length} direct</Text>
            </View>
            {detail.children.length === 0 ? (
              <EmptyContinuationState
                cta="Continue from here"
                title="No one has continued from this line yet."
                onPress={() => setComposerTarget({ kind: "continuation", continuation: detail.current })}
              />
            ) : (
              detail.children.map((child) => (
                <ContinuationCard
                  key={child.id}
                  continuation={child}
                  onContinue={() => setComposerTarget({ kind: "continuation", continuation: child })}
                  onLike={() =>
                    continuationLikeMutation.mutate({
                      continuationId: child.id,
                      userId: currentUserId,
                      isActive: !child.viewer.liked
                    })
                  }
                  onOpen={() =>
                    router.push({
                      pathname: "/thread/continue/[id]",
                      params: { id: child.id }
                    })
                  }
                  onShare={() =>
                    shareMutation.mutate({
                      kind: "continuation",
                      continuationId: child.id,
                      userId: currentUserId
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>
      {detail ? (
        <FixedComposerButton
          label="Continue from here..."
          onPress={() => setComposerTarget({ kind: "continuation", continuation: detail.current })}
        />
      ) : null}
      <ContinueComposer
        onClose={() => setComposerTarget(null)}
        onSubmitted={() => {
          setComposerTarget(null);
          void queryClient.invalidateQueries({ queryKey: ["continuation-detail"] });
          void queryClient.invalidateQueries({ queryKey: ["thread-detail"] });
          void queryClient.invalidateQueries({ queryKey: ["threads"] });
        }}
        target={composerTarget}
      />
      <ShareToast notice={shareNotice} onDismiss={() => setShareNotice(null)} />
    </AppScreen>
  );
}

function ThreadTopBar({ title }: { title: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityLabel="Open Thread menu" hitSlop={12} style={styles.headerButton}>
        <MenuIcon color={colors.profileMuted} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <Pressable accessibilityLabel="Search threads" hitSlop={12} style={styles.headerButton}>
        <SearchIcon color={colors.ink} />
      </Pressable>
    </View>
  );
}

function DetailTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.detailTopBar}>
      <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={styles.headerButton}>
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <View style={styles.detailTitleWrap}>
        <Text style={styles.detailTitle}>{title}</Text>
        {subtitle ? <Text style={styles.detailSubtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable accessibilityLabel="More options" hitSlop={12} style={styles.headerButton}>
        <Text style={styles.moreGlyph}>•••</Text>
      </Pressable>
    </View>
  );
}

function QuickStart({ profile, onPress }: { profile?: UserProfileDetails | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quickStart}>
      <Avatar
        color={profile?.avatarColor ?? colors.accent}
        imageSource={profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined}
        label={profile?.displayName ?? "You"}
        size={46}
      />
      <View style={styles.quickCopy}>
        <Text style={styles.quickName}>{profile?.displayName ?? "LineSpace writer"}</Text>
        <Text style={styles.quickPrompt}>Start a poetry thread...</Text>
      </View>
      <Text style={styles.quickTodo}>Create</Text>
    </Pressable>
  );
}

function ThreadCard({
  thread,
  elevated = false,
  onOpen,
  onLike,
  onContinue,
  onShare
}: {
  thread: PoetryThread;
  elevated?: boolean;
  onOpen: () => void;
  onLike: () => void;
  onContinue: () => void;
  onShare: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={[styles.threadCard, elevated && styles.elevatedCard]}>
      <AuthorRow author={thread.author} createdAt={thread.createdAt} meta={thread.community} />
      <Text style={styles.threadContent}>{thread.content}</Text>
      {thread.topic ? <Text style={styles.topicText}>#{thread.topic}</Text> : null}
      <ThreadActionBar
        liked={thread.viewer.liked}
        metrics={thread.metrics}
        onContinue={onContinue}
        onLike={onLike}
        onShare={onShare}
      />
    </Pressable>
  );
}

function ContinuationCard({
  continuation,
  onOpen,
  onLike,
  onContinue,
  onShare
}: {
  continuation: ThreadContinuation;
  onOpen: () => void;
  onLike: () => void;
  onContinue: () => void;
  onShare: () => void;
}) {
  return (
    <View style={styles.continuationWrap}>
      <View style={styles.branchLine} />
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.continuationCard}>
        <AuthorRow author={continuation.author} createdAt={continuation.createdAt} />
        <Text style={styles.continuationContent}>{continuation.content}</Text>
        <ThreadActionBar
          compact
          liked={continuation.viewer.liked}
          metrics={continuation.metrics}
          onContinue={onContinue}
          onLike={onLike}
          onShare={onShare}
        />
        {continuation.metrics.continuations > 0 ? (
          <Text style={styles.viewContinues}>
            View {continuation.metrics.continuations} continuations
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function ContinuationPath({ detail }: { detail: ContinuationDetail }) {
  const nodes = [...detail.path, detail.current];
  return (
    <View style={styles.pathCard}>
      <View style={styles.rootContext}>
        <AuthorRow author={detail.thread.author} createdAt={detail.thread.createdAt} meta={detail.thread.community} />
        <Text style={styles.threadContent}>{detail.thread.content}</Text>
      </View>
      {nodes.map((node, index) => {
        const isCurrent = node.id === detail.current.id;
        return (
          <View key={node.id} style={styles.pathNode}>
            {index < nodes.length ? <View style={styles.pathLine} /> : null}
            <View style={[styles.pathNodeContent, isCurrent && styles.currentPathNode]}>
              <AuthorRow author={node.author} createdAt={node.createdAt} />
              <Text style={styles.continuationContent}>{node.content}</Text>
              {isCurrent ? <Text style={styles.currentBadge}>Current continuation</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AuthorRow({
  author,
  createdAt,
  meta
}: {
  author: PoetryThread["author"];
  createdAt: string;
  meta?: string;
}) {
  return (
    <View style={styles.authorRow}>
      <Avatar
        color={author.avatarColor}
        imageSource={author.avatarUrl ? { uri: author.avatarUrl } : undefined}
        label={author.displayName}
        size={42}
      />
      <View style={styles.authorCopy}>
        <View style={styles.authorLine}>
          <Text numberOfLines={1} style={styles.authorName}>{author.handle}</Text>
          <Text style={styles.timeText}>{formatRelative(createdAt)}</Text>
        </View>
        {meta ? <Text numberOfLines={1} style={styles.metaText}>{meta}</Text> : null}
      </View>
    </View>
  );
}

function ThreadActionBar({
  metrics,
  liked,
  compact = false,
  onLike,
  onContinue,
  onShare
}: {
  metrics: PoetryThread["metrics"];
  liked: boolean;
  compact?: boolean;
  onLike: () => void;
  onContinue: () => void;
  onShare: () => void;
}) {
  return (
    <View style={[styles.actionBar, compact && styles.compactActionBar]}>
      <ActionButton
        active={liked}
        count={metrics.likes}
        icon={<LikeIcon filled={liked} activeColor={colors.liked} color={colors.inkSoft} width={25} height={23} />}
        label="Like"
        onPress={onLike}
      />
      <ActionButton
        count={metrics.continuations}
        icon={<ContinueIcon color={colors.inkSoft} width={25} height={25} />}
        label="Continue"
        onPress={onContinue}
      />
      <ActionButton
        count={metrics.shares}
        icon={<ShareIcon color={colors.inkSoft} width={25} height={25} />}
        label="Share"
        onPress={onShare}
      />
    </View>
  );
}

function ActionButton({
  active,
  count,
  icon,
  label,
  onPress
}: {
  active?: boolean;
  count: number;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={`${label} ${count}`} accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
      {icon}
      <Text style={[styles.actionCount, active && styles.actionCountActive]}>{formatCompact(count)}</Text>
    </Pressable>
  );
}

function ContinueComposer({
  target,
  onClose,
  onSubmitted
}: {
  target: ComposerTarget | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [content, setContent] = useState("");
  const createThreadMutation = useMutation({
    mutationFn: () => {
      if (!target || target.kind !== "thread") throw new Error("Missing thread target");
      return lineSpaceApi.createThreadContinuation({
        threadId: target.thread.id,
        userId: currentUserId,
        content
      });
    },
    onSuccess: () => {
      setContent("");
      onSubmitted();
    }
  });
  const createContinuationMutation = useMutation({
    mutationFn: () => {
      if (!target || target.kind !== "continuation") throw new Error("Missing continuation target");
      return lineSpaceApi.createContinuation({
        continuationId: target.continuation.id,
        userId: currentUserId,
        content
      });
    },
    onSuccess: () => {
      setContent("");
      onSubmitted();
    }
  });

  const isPending = createThreadMutation.isPending || createContinuationMutation.isPending;
  const isError = createThreadMutation.isError || createContinuationMutation.isError;
  const preview = target?.kind === "thread" ? target.thread.content : target?.continuation.content;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(target)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalRoot}>
        <Pressable style={styles.modalScrim} onPress={isPending ? undefined : onClose} />
        <View style={styles.composerSheet}>
          <View style={styles.composerHandle} />
          <Text style={styles.composerTitle}>
            {target?.kind === "thread" ? "Continue this thread" : "Continue from this line"}
          </Text>
          <Text numberOfLines={2} style={styles.composerPreview}>{preview}</Text>
          <TextInput
            multiline
            onChangeText={setContent}
            placeholder={target?.kind === "thread" ? "Add your poetic continuation..." : "Continue from this line..."}
            placeholderTextColor={colors.profileMuted}
            style={styles.composerInput}
            textAlignVertical="top"
            value={content}
          />
          <Text style={styles.composerGuidance}>Creative continuations only</Text>
          {isError ? <Text style={styles.composerError}>This continuation could not be published. Try again.</Text> : null}
          <View style={styles.composerActions}>
            <Pressable disabled={isPending} onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={isPending || content.trim().length === 0}
              onPress={() => {
                if (target?.kind === "thread") createThreadMutation.mutate();
                if (target?.kind === "continuation") createContinuationMutation.mutate();
              }}
              style={[styles.publishButton, (isPending || content.trim().length === 0) && styles.publishButtonDisabled]}
            >
              {isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.publishText}>Continue</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FixedComposerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={styles.fixedComposer}>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.fixedComposerButton}>
        <Text style={styles.fixedComposerText}>{label}</Text>
      </Pressable>
    </View>
  );
}

function EmptyContinuationState({
  cta,
  title,
  onPress
}: {
  cta: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyContinuation}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Pressable onPress={onPress} style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

function ThreadListState({ title }: { title: string }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={colors.ink} />
      <Text style={styles.loadingText}>{title}</Text>
    </View>
  );
}

function ShareToast({ notice, onDismiss }: { notice: ShareNotice | null; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.shareToast}>
      <Text style={styles.shareToastText}>{notice.message}</Text>
    </Pressable>
  );
}

function useCurrentProfile() {
  return useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });
}

function useThreadLikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: lineSpaceApi.setThreadLike.bind(lineSpaceApi),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["thread-detail"] });
    }
  });
}

function useContinuationLikeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: lineSpaceApi.setContinuationLike.bind(lineSpaceApi),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["thread-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["continuation-detail"] });
    }
  });
}

function useShareMutation(onNotice: (notice: ShareNotice) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: ThreadShareTarget) => lineSpaceApi.recordThreadShare(target),
    onSuccess: (result) => {
      onNotice({
        id: result.targetId,
        message: "Share link ready for this creative thread."
      });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["thread-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["continuation-detail"] });
    }
  });
}

function profileAvatar(profile?: UserProfileDetails | null) {
  return profile
    ? {
        color: profile.avatarColor,
        imageSource: profile.avatarUrl ? { uri: profile.avatarUrl } : undefined,
        label: profile.displayName
      }
    : undefined;
}

function formatRelative(value: string) {
  const diff = Date.now() - Date.parse(value);
  const hours = Math.max(1, Math.round(diff / 36e5));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatCompact(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return `${value}`;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface },
  screen: { backgroundColor: colors.surface },
  scroll: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    height: 101,
    paddingTop: 46,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  detailTopBar: {
    height: 101,
    paddingTop: 42,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: { ...typography.title, fontSize: 25, lineHeight: 30, color: colors.ink },
  detailTitleWrap: { alignItems: "center" },
  detailTitle: { fontSize: 24, lineHeight: 28, fontWeight: "700", color: colors.ink },
  detailSubtitle: { marginTop: 2, fontSize: 14, lineHeight: 17, color: colors.profileMuted },
  backGlyph: { fontSize: 42, lineHeight: 44, color: colors.ink },
  moreGlyph: { fontSize: 20, lineHeight: 22, color: colors.ink },
  feedContent: { paddingBottom: 112 },
  detailContent: { paddingBottom: 112 },
  quickStart: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  quickCopy: { flex: 1, marginLeft: 12 },
  quickName: { fontSize: 15, lineHeight: 18, fontWeight: "700", color: colors.ink },
  quickPrompt: { marginTop: 4, fontSize: 17, lineHeight: 22, color: colors.profileMuted },
  quickTodo: { fontSize: 13, lineHeight: 17, color: colors.accent },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  sortPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  sortPillActive: { backgroundColor: colors.ink },
  sortText: { fontSize: 14, lineHeight: 18, color: colors.inkSoft },
  sortTextActive: { color: colors.white },
  threadCard: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface
  },
  elevatedCard: {
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  authorRow: { flexDirection: "row", alignItems: "center" },
  authorCopy: { flex: 1, marginLeft: 12, minWidth: 0 },
  authorLine: { flexDirection: "row", alignItems: "center" },
  authorName: { maxWidth: "72%", fontSize: 16, lineHeight: 20, fontWeight: "700", color: colors.ink },
  timeText: { marginLeft: 6, fontSize: 15, lineHeight: 19, color: colors.profileMuted },
  metaText: { marginTop: 2, fontSize: 13, lineHeight: 16, color: colors.accent },
  threadContent: { marginTop: 12, fontSize: 21, lineHeight: 29, color: colors.ink },
  topicText: { marginTop: 8, fontSize: 13, lineHeight: 17, color: colors.profileMuted },
  actionBar: { flexDirection: "row", alignItems: "center", gap: 28, marginTop: 14 },
  compactActionBar: { marginTop: 12 },
  actionButton: { minHeight: 44, minWidth: 58, flexDirection: "row", alignItems: "center" },
  actionCount: { marginLeft: 7, fontSize: 15, lineHeight: 18, color: colors.inkSoft },
  actionCountActive: { color: colors.liked },
  continuationWrap: {
    position: "relative",
    paddingLeft: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  branchLine: { position: "absolute", left: 39, top: 62, bottom: 0, width: 2, backgroundColor: colors.line },
  continuationCard: { paddingVertical: 15, paddingRight: 18, paddingLeft: 24, backgroundColor: colors.surface },
  continuationContent: { marginTop: 10, fontSize: 20, lineHeight: 28, color: colors.ink },
  viewContinues: { marginTop: 2, fontSize: 14, lineHeight: 18, color: colors.profileMuted },
  sectionHeader: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line
  },
  sectionTitle: { fontSize: 18, lineHeight: 22, fontWeight: "700", color: colors.ink },
  sectionMeta: { fontSize: 14, lineHeight: 18, color: colors.profileMuted },
  pathCard: { backgroundColor: colors.surface },
  rootContext: { paddingHorizontal: 18, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pathNode: { position: "relative", paddingLeft: 22 },
  pathLine: { position: "absolute", left: 39, top: 0, bottom: 0, width: 2, backgroundColor: colors.line },
  pathNodeContent: { paddingVertical: 15, paddingRight: 18, paddingLeft: 24 },
  currentPathNode: { backgroundColor: colors.surfaceWarm },
  currentBadge: { marginTop: 8, fontSize: 12, lineHeight: 16, color: colors.accent },
  fixedComposer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  fixedComposerButton: {
    minHeight: 48,
    borderRadius: 24,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.surfaceMuted
  },
  fixedComposerText: { fontSize: 16, lineHeight: 20, color: colors.profileMuted },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.22)" },
  composerSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: colors.surface
  },
  composerHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: colors.faint, marginBottom: 14 },
  composerTitle: { fontSize: 19, lineHeight: 24, fontWeight: "700", color: colors.ink },
  composerPreview: { marginTop: 8, fontSize: 14, lineHeight: 19, color: colors.profileMuted },
  composerInput: {
    minHeight: 128,
    marginTop: 14,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: colors.surfaceMuted,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink
  },
  composerGuidance: { marginTop: 8, fontSize: 12, lineHeight: 16, color: colors.profileMuted },
  composerError: { marginTop: 8, fontSize: 13, lineHeight: 17, color: colors.accent },
  composerActions: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelButton: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center" },
  cancelText: { fontSize: 16, color: colors.inkSoft },
  publishButton: { minHeight: 44, minWidth: 104, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
  publishButtonDisabled: { opacity: 0.45 },
  publishText: { fontSize: 16, color: colors.white, fontWeight: "700" },
  emptyContinuation: { paddingHorizontal: 24, paddingVertical: 28, alignItems: "center" },
  emptyTitle: { textAlign: "center", fontSize: 16, lineHeight: 22, color: colors.profileMuted },
  emptyButton: { marginTop: 14, minHeight: 42, borderRadius: 21, paddingHorizontal: 18, justifyContent: "center", backgroundColor: colors.ink },
  emptyButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  loadingState: { paddingVertical: 40, alignItems: "center" },
  loadingText: { marginTop: 10, color: colors.profileMuted },
  shareToast: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 96,
    minHeight: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink
  },
  shareToastText: { color: colors.white, fontSize: 14 }
});
