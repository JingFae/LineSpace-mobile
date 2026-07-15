import { router, type Href, useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
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
  BellIcon,
  BottomNavigation,
  ContinueIcon,
  EmptyState,
  LikeIcon,
  LineSpaceLogoIcon,
  MoreIcon,
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

type ContinuationOrder = "top" | "recent";

type FlattenedDescendantRow = {
  continuation: ThreadContinuation;
  actualDepth: number;
};

type ContinuationVisibleRow = {
  continuation: ThreadContinuation;
  rootGroupId: string;
  actualDepth: number;
  isExpandedDescendant: boolean;
  isFirstInExpandedGroup: boolean;
  isLastInExpandedGroup: boolean;
  hasVisiblePreviousNodeInGroup: boolean;
  hasVisibleNextNodeInGroup: boolean;
  isLastVisibleDescendantInGroup: boolean;
  showContinuationEntry: boolean;
  isLoadingDescendants: boolean;
};

type ContinuationVisibleGroup = {
  rootRow: ContinuationVisibleRow;
  descendantRows: ContinuationVisibleRow[];
};

type ActionOrder = "continue-first" | "like-first";

const sortTabs: Array<{ value: ThreadSort; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "top", label: "Popular" },
  { value: "following", label: "Follow" }
];

const continuationHorizontalPadding = spacing.lg;
const continuationRowPaddingVertical = 8;
const level1RowPaddingVertical = 6;
const level0AvatarSize = 38;
const level1AvatarSize = 32;
const continuationContentGap = 10;
const level1ContentGap = 9;
const level1IndentOffset = level0AvatarSize + continuationContentGap;
const showContinuationAvatarSize = 28;
const showContinuationRowHeight = 34;
const connectorWidth = StyleSheet.hairlineWidth;
const connectorColor = colors.line;
const level0ConnectorX = continuationHorizontalPadding + level0AvatarSize / 2;
const level1ConnectorX = continuationHorizontalPadding + level1IndentOffset + level1AvatarSize / 2;
const showContinuationAvatarCenterX =
  continuationHorizontalPadding +
  level0AvatarSize +
  continuationContentGap +
  showContinuationAvatarSize / 2;
const pathHorizontalPadding = spacing.lg;
const pathNodePaddingVertical = 10;
const pathAvatarColumnWidth = 44;
const pathRootAvatarSize = 44;
const pathContinuationAvatarSize = 40;
const pathAvatarCenterX = pathHorizontalPadding + pathAvatarColumnWidth / 2;
const pathBodyGap = 10;

type ContinuationPathRenderNode = {
  id: string;
  author: PoetryThread["author"];
  createdAt: string;
  content: string;
  metrics: PoetryThread["metrics"];
  liked: boolean;
  avatarSize: number;
  meta?: string;
  onOpen?: () => void;
  onContinue: () => void;
  onLike: () => void;
  onShare: () => void;
};

export function ThreadFeedScreen() {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ThreadSort>("latest");
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
      <ThreadTopBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.feedContent, composerTarget && styles.composerOpenContentInset]}
        showsVerticalScrollIndicator={false}
      >
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
              onOpen={() =>
                router.push({ pathname: "/thread/[id]", params: { id: thread.id } } as unknown as Href)
              }
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
        onSubmitted={(continuation, submittedTarget) => {
          setComposerTarget(null);
          updateThreadListCaches(queryClient, continuation);
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
  const [followingAuthorIds, setFollowingAuthorIds] = useState<Set<string>>(() => new Set());
  const [continuationOrder, setContinuationOrder] = useState<ContinuationOrder>("top");
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(() => new Set());
  const [expandedDescendants, setExpandedDescendants] = useState<Record<string, FlattenedDescendantRow[]>>({});
  const [loadingRootIds, setLoadingRootIds] = useState<Set<string>>(() => new Set());
  const detailQuery = useQuery({
    queryKey: ["thread-detail", threadId, currentUserId],
    enabled: Boolean(threadId),
    queryFn: () => lineSpaceApi.getThread(threadId!, currentUserId)
  });
  const likeMutation = useThreadLikeMutation();
  const continuationLikeMutation = useContinuationLikeMutation();
  const shareMutation = useShareMutation((notice) => setShareNotice(notice));
  const detail = detailQuery.data ?? undefined;
  const sortedContinuations = useMemo(() => {
    return sortContinuationItems(detail?.continuations ?? [], continuationOrder);
  }, [continuationOrder, detail?.continuations]);
  const visibleContinuationGroups = useMemo(
    () =>
      buildVisibleContinuationGroups(
        sortedContinuations,
        expandedDescendants,
        expandedRootIds,
        loadingRootIds
      ),
    [expandedDescendants, expandedRootIds, loadingRootIds, sortedContinuations]
  );
  const resetExpandedContinuations = useCallback(() => {
    setExpandedRootIds(new Set());
    setExpandedDescendants({});
    setLoadingRootIds(new Set());
  }, []);
  const handleContinuationOrderChange = useCallback(
    (value: ContinuationOrder) => {
      setContinuationOrder(value);
      resetExpandedContinuations();
    },
    [resetExpandedContinuations]
  );
  const handleShowContinuations = useCallback(
    (continuation: ThreadContinuation) => {
      const rootId = continuation.id;
      if (expandedRootIds.has(rootId)) return;
      setExpandedRootIds((current) => new Set(current).add(rootId));
      if (expandedDescendants[rootId]) return;
      setLoadingRootIds((current) => new Set(current).add(rootId));
      void getDescendantsDepthFirst(continuation, continuationOrder, currentUserId)
        .then((descendants) => {
          setExpandedDescendants((current) => ({
            ...current,
            [rootId]: descendants
          }));
        })
        .catch(() => {
          setExpandedDescendants((current) => ({
            ...current,
            [rootId]: []
          }));
        })
        .finally(() => {
          setLoadingRootIds((current) => {
            const next = new Set(current);
            next.delete(rootId);
            return next;
          });
        });
    },
    [continuationOrder, expandedDescendants, expandedRootIds]
  );

  useFocusEffect(
    useCallback(() => {
      resetExpandedContinuations();
      return resetExpandedContinuations;
    }, [resetExpandedContinuations, threadId])
  );

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <DetailTopBar
        title="Thread"
        onNotify={() =>
          setShareNotice({
            id: detail?.thread.id ?? "thread-notify",
            message: "Thread notifications will appear in Inbox."
          })
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.detailContent, composerTarget && styles.composerOpenContentInset]}
        showsVerticalScrollIndicator={false}
      >
        {detailQuery.isLoading ? (
          <ThreadListState title="Loading thread" />
        ) : detailQuery.isError || !detail ? (
          <EmptyState title="Thread not found" body="This poetry thread could not be opened." />
        ) : (
          <>
            <ThreadDetailHero
              followed={followingAuthorIds.has(detail.thread.author.id)}
              thread={detail.thread}
              onContinue={() => setComposerTarget({ kind: "thread", thread: detail.thread })}
              onFollow={() =>
                setFollowingAuthorIds((current) => {
                  const next = new Set(current);
                  if (next.has(detail.thread.author.id)) next.delete(detail.thread.author.id);
                  else next.add(detail.thread.author.id);
                  return next;
                })
              }
              onLike={() =>
                likeMutation.mutate({
                  threadId: detail.thread.id,
                  userId: currentUserId,
                  isActive: !detail.thread.viewer.liked
                })
              }
              onShare={() =>
                shareMutation.mutate({
                  kind: "thread",
                  threadId: detail.thread.id,
                  userId: currentUserId
                })
              }
            />
            <ContinuationHeader order={continuationOrder} onChange={handleContinuationOrderChange} />
            {detail.continuations.length === 0 ? (
              <EmptyContinuationState
                cta="Continue this thread"
                title="No one has continued this thread yet."
                onPress={() => setComposerTarget({ kind: "thread", thread: detail.thread })}
              />
            ) : (
              visibleContinuationGroups.map((group) => (
                <ExpandedContinuationGroup
                  key={group.rootRow.rootGroupId}
                  group={group}
                  order={continuationOrder}
                  onContinue={(target) => setComposerTarget({ kind: "continuation", continuation: target })}
                  onLike={(target) =>
                    continuationLikeMutation.mutate({
                      continuationId: target.id,
                      userId: currentUserId,
                      isActive: !target.viewer.liked
                    })
                  }
                  onOpen={(target) =>
                    router.push({
                      pathname: "/thread/continue/[id]",
                      params: { id: target.id }
                    } as unknown as Href)
                  }
                  onShare={(target) =>
                    shareMutation.mutate({
                      kind: "continuation",
                      continuationId: target.id,
                      userId: currentUserId
                    })
                  }
                  onShowContinuations={handleShowContinuations}
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
          hidden={Boolean(composerTarget)}
        />
      ) : null}
      <ContinueComposer
        onClose={() => setComposerTarget(null)}
        onSubmitted={(continuation, submittedTarget) => {
          setComposerTarget(null);
          updateThreadListCaches(queryClient, continuation);
          updateThreadDetailCache(queryClient, threadId, continuation, submittedTarget);
          if (submittedTarget.kind === "continuation") {
            setExpandedDescendants((current) => appendExpandedDescendant(current, submittedTarget.continuation.id, continuation));
          }
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
  const [continuationOrder, setContinuationOrder] = useState<ContinuationOrder>("top");
  const [expandedRootIds, setExpandedRootIds] = useState<Set<string>>(() => new Set());
  const [expandedDescendants, setExpandedDescendants] = useState<Record<string, FlattenedDescendantRow[]>>({});
  const [loadingRootIds, setLoadingRootIds] = useState<Set<string>>(() => new Set());
  const detailQuery = useQuery({
    queryKey: ["continuation-detail", continuationId, currentUserId],
    enabled: Boolean(continuationId),
    queryFn: () => lineSpaceApi.getContinuationDetail(continuationId!, currentUserId)
  });
  const likeMutation = useThreadLikeMutation();
  const continuationLikeMutation = useContinuationLikeMutation();
  const shareMutation = useShareMutation((notice) => setShareNotice(notice));
  const detail = detailQuery.data ?? undefined;
  const sortedChildren = useMemo(() => {
    return sortContinuationItems(detail?.children ?? [], continuationOrder);
  }, [continuationOrder, detail?.children]);
  const visibleContinuationGroups = useMemo(
    () =>
      buildVisibleContinuationGroups(
        sortedChildren,
        expandedDescendants,
        expandedRootIds,
        loadingRootIds
      ),
    [expandedDescendants, expandedRootIds, loadingRootIds, sortedChildren]
  );
  const resetExpandedContinuations = useCallback(() => {
    setExpandedRootIds(new Set());
    setExpandedDescendants({});
    setLoadingRootIds(new Set());
  }, []);
  const handleContinuationOrderChange = useCallback(
    (value: ContinuationOrder) => {
      setContinuationOrder(value);
      resetExpandedContinuations();
    },
    [resetExpandedContinuations]
  );
  const handleShowContinuations = useCallback(
    (continuation: ThreadContinuation) => {
      const rootId = continuation.id;
      if (expandedRootIds.has(rootId)) return;
      setExpandedRootIds((current) => new Set(current).add(rootId));
      if (expandedDescendants[rootId]) return;
      setLoadingRootIds((current) => new Set(current).add(rootId));
      void getDescendantsDepthFirst(continuation, continuationOrder, currentUserId)
        .then((descendants) => {
          setExpandedDescendants((current) => ({
            ...current,
            [rootId]: descendants
          }));
        })
        .catch(() => {
          setExpandedDescendants((current) => ({
            ...current,
            [rootId]: []
          }));
        })
        .finally(() => {
          setLoadingRootIds((current) => {
            const next = new Set(current);
            next.delete(rootId);
            return next;
          });
        });
    },
    [continuationOrder, expandedDescendants, expandedRootIds]
  );

  useFocusEffect(
    useCallback(() => {
      resetExpandedContinuations();
      return resetExpandedContinuations;
    }, [continuationId, resetExpandedContinuations])
  );

  return (
    <AppScreen scroll={false} padded={false} style={styles.safeArea} contentContainerStyle={styles.screen}>
      <DetailTopBar
        large
        title="Continue"
        onNotify={() =>
          setShareNotice({
            id: detail?.current.id ?? "continue-notify",
            message: "Continuation notifications will appear in Inbox."
          })
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.detailContent, composerTarget && styles.composerOpenContentInset]}
        showsVerticalScrollIndicator={false}
      >
        {detailQuery.isLoading ? (
          <ThreadListState title="Loading continuation" />
        ) : detailQuery.isError || !detail ? (
          <EmptyState title="Continue not found" body="This creative continuation could not be opened." />
        ) : (
          <>
            <ContinuationPath
              detail={detail}
              onContinuationContinue={(target) => setComposerTarget({ kind: "continuation", continuation: target })}
              onContinuationLike={(target) =>
                continuationLikeMutation.mutate({
                  continuationId: target.id,
                  userId: currentUserId,
                  isActive: !target.viewer.liked
                })
              }
              onContinuationShare={(target) =>
                shareMutation.mutate({
                  kind: "continuation",
                  continuationId: target.id,
                  userId: currentUserId
                })
              }
              onThreadContinue={() => setComposerTarget({ kind: "thread", thread: detail.thread })}
              onThreadLike={() =>
                likeMutation.mutate({
                  threadId: detail.thread.id,
                  userId: currentUserId,
                  isActive: !detail.thread.viewer.liked
                })
              }
              onThreadShare={() =>
                shareMutation.mutate({
                  kind: "thread",
                  threadId: detail.thread.id,
                  userId: currentUserId
                })
              }
            />
            <ContinuationHeader order={continuationOrder} onChange={handleContinuationOrderChange} />
            {sortedChildren.length === 0 ? (
              <LightContinuationEmptyState />
            ) : (
              visibleContinuationGroups.map((group) => (
                <ExpandedContinuationGroup
                  key={group.rootRow.rootGroupId}
                  group={group}
                  order={continuationOrder}
                  onContinue={(target) => setComposerTarget({ kind: "continuation", continuation: target })}
                  onLike={(target) =>
                    continuationLikeMutation.mutate({
                      continuationId: target.id,
                      userId: currentUserId,
                      isActive: !target.viewer.liked
                    })
                  }
                  onOpen={(target) =>
                    router.push({
                      pathname: "/thread/continue/[id]",
                      params: { id: target.id }
                    } as unknown as Href)
                  }
                  onShare={(target) =>
                    shareMutation.mutate({
                      kind: "continuation",
                      continuationId: target.id,
                      userId: currentUserId
                    })
                  }
                  onShowContinuations={handleShowContinuations}
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
          hidden={Boolean(composerTarget)}
        />
      ) : null}
      <ContinueComposer
        onClose={() => setComposerTarget(null)}
        onSubmitted={(continuation, submittedTarget) => {
          setComposerTarget(null);
          updateThreadListCaches(queryClient, continuation);
          updateContinuationDetailCache(queryClient, continuationId, continuation, submittedTarget);
          if (submittedTarget.kind === "continuation") {
            setExpandedDescendants((current) => appendExpandedDescendant(current, submittedTarget.continuation.id, continuation));
          }
        }}
        target={composerTarget}
      />
      <ShareToast notice={shareNotice} onDismiss={() => setShareNotice(null)} />
    </AppScreen>
  );
}

function ThreadTopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.headerButton} />
      <LineSpaceLogo />
      <Pressable accessibilityLabel="Search threads" hitSlop={12} style={styles.headerButton}>
        <SearchIcon color={colors.ink} width={19} height={19} />
      </Pressable>
    </View>
  );
}

function DetailTopBar({ title, large = false, onNotify }: { title: string; large?: boolean; onNotify?: () => void }) {
  return (
    <View style={styles.detailTopBar}>
      <View style={styles.detailLeftActions}>
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      </View>
      <View style={styles.detailTitleWrap}>
        <Text style={[styles.detailTitle, large && styles.detailTitleLarge]}>{title}</Text>
      </View>
      <View style={styles.detailHeaderActions}>
        <Pressable accessibilityLabel="Notify me about this thread" hitSlop={10} onPress={onNotify} style={styles.detailIconButton}>
          <BellIcon color={colors.ink} />
        </Pressable>
        <Pressable accessibilityLabel="More options" hitSlop={10} style={styles.detailIconButton}>
          <MoreIcon color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function LineSpaceLogo() {
  return <LineSpaceLogoIcon color={colors.black} width={54} height={31} />;
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
  const showFullMeta = elevated;
  return (
    <View style={[styles.threadCard, elevated && styles.elevatedCard]}>
      <View style={styles.threadRow}>
        <Pressable accessibilityLabel={`Open ${thread.author.handle}'s thread`} accessibilityRole="button" onPress={onOpen} style={styles.threadAvatarButton}>
          <Avatar
            color={thread.author.avatarColor}
            imageSource={thread.author.avatarUrl ? { uri: thread.author.avatarUrl } : undefined}
            label={thread.author.displayName}
            size={38}
          />
        </Pressable>
        <View style={styles.threadBody}>
          <Pressable accessibilityRole="button" onPress={onOpen} style={styles.threadOpenArea}>
            <CompactAuthorLine author={thread.author} createdAt={thread.createdAt} meta={showFullMeta ? thread.community : undefined} />
            <Text numberOfLines={showFullMeta ? undefined : 20} style={styles.threadContent}>{thread.content}</Text>
            {showFullMeta && thread.topic ? <Text style={styles.topicText}>#{thread.topic}</Text> : null}
          </Pressable>
          <ThreadActionBar
            liked={thread.viewer.liked}
            metrics={thread.metrics}
            onContinue={onContinue}
            onLike={onLike}
            onShare={onShare}
          />
        </View>
      </View>
    </View>
  );
}

function ThreadDetailHero({
  followed,
  thread,
  onFollow,
  onLike,
  onContinue,
  onShare
}: {
  followed: boolean;
  thread: PoetryThread;
  onFollow: () => void;
  onLike: () => void;
  onContinue: () => void;
  onShare: () => void;
}) {
  return (
    <View style={[styles.detailHero, thread.cover && styles.detailHeroWithCover]}>
      {thread.cover ? (
        <View pointerEvents="none" style={[styles.detailHeroImageWash, coverToneStyle(thread.cover.tone)]}>
          <View style={styles.detailHeroFadeTop} />
        </View>
      ) : null}
      <View style={styles.detailHeroHeader}>
        <View style={styles.detailHeroAuthor}>
          <Avatar
            color={thread.author.avatarColor}
            imageSource={thread.author.avatarUrl ? { uri: thread.author.avatarUrl } : undefined}
            label={thread.author.displayName}
            size={38}
          />
          <View style={styles.detailHeroNameLine}>
            <Text numberOfLines={1} style={styles.detailHeroName}>{thread.author.handle}</Text>
            <Text style={styles.detailHeroTime}>{formatRelative(thread.createdAt)}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onFollow} style={[styles.followButton, followed && styles.followingButton]}>
          <Text style={[styles.followButtonText, followed && styles.followingButtonText]}>
            {followed ? "Following" : "Follow"}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.detailHeroContent}>{thread.content}</Text>
      {thread.topic ? <Text style={styles.detailHeroTag}>#{thread.topic}</Text> : null}
      <ThreadActionBar
        compact
        liked={thread.viewer.liked}
        metrics={thread.metrics}
        onContinue={onContinue}
        onLike={onLike}
        onShare={onShare}
      />
    </View>
  );
}

function ContinuationHeader({
  order,
  onChange
}: {
  order: ContinuationOrder;
  onChange: (value: ContinuationOrder) => void;
}) {
  return (
    <View style={styles.continuationHeader}>
      <Text style={styles.continuationHeaderTitle}>Continuation</Text>
      <View style={styles.continuationOrder}>
        {(["top", "recent"] as const).map((value) => (
          <Pressable key={value} accessibilityRole="button" onPress={() => onChange(value)} style={styles.orderButton}>
            <Text style={[styles.orderText, order === value && styles.orderTextActive]}>
              {value === "top" ? "Top" : "Recent"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ExpandedContinuationGroup({
  group,
  order,
  onOpen,
  onLike,
  onContinue,
  onShare,
  onShowContinuations
}: {
  group: ContinuationVisibleGroup;
  order: ContinuationOrder;
  onOpen: (continuation: ThreadContinuation) => void;
  onLike: (continuation: ThreadContinuation) => void;
  onContinue: (continuation: ThreadContinuation) => void;
  onShare: (continuation: ThreadContinuation) => void;
  onShowContinuations: (continuation: ThreadContinuation) => void;
}) {
  const [parentRowHeight, setParentRowHeight] = useState(0);
  const [firstChildCenterY, setFirstChildCenterY] = useState<number | null>(null);
  const hasChildren = group.descendantRows.length > 0;
  const parentAvatarBottom = continuationRowPaddingVertical + level0AvatarSize;
  const childConnectorY =
    hasChildren && firstChildCenterY !== null ? parentRowHeight + firstChildCenterY : null;

  return (
    <View style={styles.expandedContinuationGroup}>
      {childConnectorY !== null ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.parentChildConnectorVertical,
              {
                top: parentAvatarBottom,
                height: Math.max(0, childConnectorY - parentAvatarBottom)
              }
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.parentChildConnectorHorizontal,
              {
                top: childConnectorY
              }
            ]}
          />
        </>
      ) : null}
      <View onLayout={(event) => setParentRowHeight(event.nativeEvent.layout.height)} style={styles.groupLayer}>
        <ContinuationCard
          order={order}
          row={group.rootRow}
          onContinue={onContinue}
          onLike={onLike}
          onOpen={onOpen}
          onShare={onShare}
          onShowContinuations={onShowContinuations}
        />
      </View>
      {hasChildren ? (
        <ChildContinuationGroup
          rows={group.descendantRows}
          onFirstChildCenter={setFirstChildCenterY}
          onContinue={onContinue}
          onLike={onLike}
          onOpen={onOpen}
          onShare={onShare}
        />
      ) : null}
    </View>
  );
}

function ChildContinuationGroup({
  rows,
  onFirstChildCenter,
  onOpen,
  onLike,
  onContinue,
  onShare
}: {
  rows: ContinuationVisibleRow[];
  onFirstChildCenter: (value: number | null) => void;
  onOpen: (continuation: ThreadContinuation) => void;
  onLike: (continuation: ThreadContinuation) => void;
  onContinue: (continuation: ThreadContinuation) => void;
  onShare: (continuation: ThreadContinuation) => void;
}) {
  const [rowLayouts, setRowLayouts] = useState<Record<string, { y: number; height: number }>>({});
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const firstLayout = firstRow ? rowLayouts[firstRow.continuation.id] : undefined;
  const lastLayout = lastRow ? rowLayouts[lastRow.continuation.id] : undefined;
  const firstCenter = firstLayout
    ? firstLayout.y + level1RowPaddingVertical + level1AvatarSize / 2
    : null;
  const lastCenter = lastLayout
    ? lastLayout.y + level1RowPaddingVertical + level1AvatarSize / 2
    : null;

  useEffect(() => {
    onFirstChildCenter(firstCenter);
  }, [firstCenter, onFirstChildCenter]);

  return (
    <View style={styles.childContinuationGroup}>
      {firstCenter !== null && lastCenter !== null && lastCenter > firstCenter ? (
        <View
          pointerEvents="none"
          style={[
            styles.childVerticalSpine,
            {
              top: firstCenter,
              height: lastCenter - firstCenter
            }
          ]}
        />
      ) : null}
      {rows.map((row) => (
        <View
          key={row.continuation.id}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setRowLayouts((current) => ({
              ...current,
              [row.continuation.id]: { y, height }
            }));
          }}
          style={styles.groupLayer}
        >
          <ContinuationCard
            row={row}
            onContinue={onContinue}
            onLike={onLike}
            onOpen={onOpen}
            onShare={onShare}
          />
        </View>
      ))}
    </View>
  );
}

function ContinuationCard({
  row,
  actionOrder = "continue-first",
  order = "top",
  onOpen,
  onLike,
  onContinue,
  onShare,
  onShowContinuations
}: {
  row: ContinuationVisibleRow;
  actionOrder?: ActionOrder;
  order?: ContinuationOrder;
  onOpen: (continuation: ThreadContinuation) => void;
  onLike: (continuation: ThreadContinuation) => void;
  onContinue: (continuation: ThreadContinuation) => void;
  onShare: (continuation: ThreadContinuation) => void;
  onShowContinuations?: (continuation: ThreadContinuation) => void;
}) {
  const { continuation } = row;
  const avatarSize = row.isExpandedDescendant ? level1AvatarSize : level0AvatarSize;
  const avatarColumnWidth = row.isExpandedDescendant ? level1AvatarSize : level0AvatarSize;

  return (
    <View
      style={[
        styles.continuationWrap,
        row.isExpandedDescendant && styles.level1ContinuationWrap,
        row.isLastVisibleDescendantInGroup && styles.continuationWrapWithDivider
      ]}
    >
      {row.showContinuationEntry ? (
        <>
          <View pointerEvents="none" style={styles.collapsedConnectorVertical} />
          <View pointerEvents="none" style={styles.collapsedConnectorHorizontal} />
        </>
      ) : null}
      <View style={[styles.continuationRow, row.isExpandedDescendant && styles.level1ContinuationRow]}>
        <View style={[styles.continuationAvatarColumn, { width: avatarColumnWidth }]}>
          <Pressable
            accessibilityLabel={`Open ${continuation.author.handle}'s continuation`}
            accessibilityRole="button"
            onPress={() => onOpen(continuation)}
            style={[styles.continuationAvatarButton, { minHeight: avatarSize, width: avatarSize }]}
          >
            <Avatar
              color={continuation.author.avatarColor}
              imageSource={continuation.author.avatarUrl ? { uri: continuation.author.avatarUrl } : undefined}
              label={continuation.author.displayName}
              size={avatarSize}
            />
          </Pressable>
        </View>
        <View style={[styles.continuationBody, row.isExpandedDescendant && styles.level1ContinuationBody]}>
          <View style={styles.continuationTopLine}>
            <Pressable accessibilityRole="button" onPress={() => onOpen(continuation)} style={styles.continuationAuthorLine}>
              <Text numberOfLines={1} style={styles.continuationAuthorName}>{continuation.author.handle}</Text>
              <Text style={styles.continuationTime}>{formatRelative(continuation.createdAt)}</Text>
            </Pressable>
            <Pressable accessibilityLabel="More continuation options" hitSlop={10} style={styles.continuationMoreButton}>
              <MoreIcon color={colors.profileMuted} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={() => onOpen(continuation)} style={styles.continuationOpenArea}>
            <Text style={styles.continuationContent}>{continuation.content}</Text>
          </Pressable>
          <ThreadActionBar
            actionOrder={actionOrder}
            compact
            liked={continuation.viewer.liked}
            metrics={continuation.metrics}
            onContinue={() => onContinue(continuation)}
            onLike={() => onLike(continuation)}
            onShare={() => onShare(continuation)}
          />
          {row.isLoadingDescendants ? (
            <View style={styles.continuationLoadingRow}>
              <ActivityIndicator color={colors.profileMuted} size="small" />
              <Text style={styles.continuationLoadingText}>Loading continuations</Text>
            </View>
          ) : null}
          {row.showContinuationEntry && onShowContinuations ? (
            <ShowContinuationsRow
              continuation={continuation}
              order={order}
              onPress={() => onShowContinuations(continuation)}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ShowContinuationsRow({
  continuation,
  order,
  onPress
}: {
  continuation: ThreadContinuation;
  order: ContinuationOrder;
  onPress: () => void;
}) {
  const childrenPreviewQuery = useQuery({
    queryKey: ["continuation-children", continuation.id, currentUserId],
    queryFn: async () => {
      const detail = await lineSpaceApi.getContinuationDetail(continuation.id, currentUserId);
      return detail?.children ?? [];
    }
  });
  const firstChild = sortContinuationItems(childrenPreviewQuery.data ?? [], order)[0];
  const avatarSource = firstChild ?? continuation;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.showContinuationsRow}>
      <Avatar
        color={avatarSource.author.avatarColor}
        imageSource={avatarSource.author.avatarUrl ? { uri: avatarSource.author.avatarUrl } : undefined}
        label={avatarSource.author.displayName}
        size={showContinuationAvatarSize}
      />
      <Text style={styles.showContinuationsText}>Show Continuations</Text>
    </Pressable>
  );
}

function ContinuationPath({
  detail,
  onThreadContinue,
  onThreadLike,
  onThreadShare,
  onContinuationContinue,
  onContinuationLike,
  onContinuationShare
}: {
  detail: ContinuationDetail;
  onThreadContinue: () => void;
  onThreadLike: () => void;
  onThreadShare: () => void;
  onContinuationContinue: (continuation: ThreadContinuation) => void;
  onContinuationLike: (continuation: ThreadContinuation) => void;
  onContinuationShare: (continuation: ThreadContinuation) => void;
}) {
  const [nodeLayouts, setNodeLayouts] = useState<Record<string, { y: number; height: number }>>({});
  const pathNodes = useMemo<ContinuationPathRenderNode[]>(() => {
    const continuationNodes = [...detail.path, detail.current].map((continuation) => ({
      id: continuation.id,
      author: continuation.author,
      createdAt: continuation.createdAt,
      content: continuation.content,
      metrics: continuation.metrics,
      liked: continuation.viewer.liked,
      avatarSize: pathContinuationAvatarSize,
      onOpen: () =>
        router.push({
          pathname: "/thread/continue/[id]",
          params: { id: continuation.id }
        } as unknown as Href),
      onContinue: () => onContinuationContinue(continuation),
      onLike: () => onContinuationLike(continuation),
      onShare: () => onContinuationShare(continuation)
    }));

    return [
      {
        id: detail.thread.id,
        author: detail.thread.author,
        createdAt: detail.thread.createdAt,
        content: detail.thread.content,
        metrics: detail.thread.metrics,
        liked: detail.thread.viewer.liked,
        avatarSize: pathRootAvatarSize,
        onOpen: () =>
          router.push({
            pathname: "/thread/[id]",
            params: { id: detail.thread.id }
          } as unknown as Href),
        onContinue: onThreadContinue,
        onLike: onThreadLike,
        onShare: onThreadShare
      },
      ...continuationNodes
    ];
  }, [
    detail.current,
    detail.path,
    detail.thread,
    onContinuationContinue,
    onContinuationLike,
    onContinuationShare,
    onThreadContinue,
    onThreadLike,
    onThreadShare
  ]);

  const firstNode = pathNodes[0];
  const lastNode = pathNodes[pathNodes.length - 1];
  const firstLayout = firstNode ? nodeLayouts[firstNode.id] : undefined;
  const lastLayout = lastNode ? nodeLayouts[lastNode.id] : undefined;
  const spineTop = firstLayout && firstNode
    ? firstLayout.y + pathNodePaddingVertical + firstNode.avatarSize / 2
    : 0;
  const spineBottom = lastLayout && lastNode
    ? lastLayout.y + pathNodePaddingVertical + lastNode.avatarSize / 2
    : 0;
  const spineHeight = Math.max(0, spineBottom - spineTop);

  return (
    <View style={styles.pathChain}>
      {pathNodes.length > 1 && spineHeight > 0 ? (
        <View pointerEvents="none" style={[styles.pathVerticalSpine, { top: spineTop, height: spineHeight }]} />
      ) : null}
      {pathNodes.map((node) => (
        <ContinuationPathNode
          key={node.id}
          node={node}
          onLayout={(y, height) =>
            setNodeLayouts((current) => ({
              ...current,
              [node.id]: { y, height }
            }))
          }
        />
      ))}
    </View>
  );
}

function ContinuationPathNode({
  node,
  onLayout
}: {
  node: ContinuationPathRenderNode;
  onLayout: (y: number, height: number) => void;
}) {
  const content = (
    <Text style={styles.pathContentText}>
      {node.content}
    </Text>
  );

  return (
    <View
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        onLayout(y, height);
      }}
      style={styles.pathNodeRow}
    >
      <View style={styles.pathAvatarColumn}>
        <Pressable
          accessibilityLabel={`Open ${node.author.handle}`}
          accessibilityRole="button"
          onPress={node.onOpen}
          style={[styles.pathAvatarButton, { width: node.avatarSize, height: node.avatarSize, borderRadius: node.avatarSize / 2 }]}
        >
          <Avatar
            color={node.author.avatarColor}
            imageSource={node.author.avatarUrl ? { uri: node.author.avatarUrl } : undefined}
            label={node.author.displayName}
            size={node.avatarSize}
          />
        </Pressable>
      </View>
      <View style={styles.pathNodeBody}>
        <View style={styles.pathNodeTopLine}>
          <Pressable accessibilityRole="button" onPress={node.onOpen} style={styles.pathAuthorLine}>
            <Text numberOfLines={1} style={styles.pathAuthorName}>{node.author.handle}</Text>
            <Text style={styles.pathTimeText}>{formatRelative(node.createdAt)}</Text>
          </Pressable>
          <Pressable accessibilityLabel="More continuation options" hitSlop={10} style={styles.pathMoreButton}>
            <MoreIcon color={colors.profileMuted} />
          </Pressable>
        </View>
        {node.meta ? <Text numberOfLines={1} style={styles.pathMetaText}>{node.meta}</Text> : null}
        {node.onOpen ? (
          <Pressable accessibilityRole="button" onPress={node.onOpen} style={styles.pathOpenArea}>
            {content}
          </Pressable>
        ) : (
          content
        )}
        <ThreadActionBar
          actionOrder="like-first"
          compact
          liked={node.liked}
          metrics={node.metrics}
          onContinue={node.onContinue}
          onLike={node.onLike}
          onShare={node.onShare}
        />
      </View>
    </View>
  );
}

function LightContinuationEmptyState() {
  return (
    <View style={styles.lightEmptyContinuation}>
      <Text style={styles.lightEmptyTitle}>No one has continued from this line yet.</Text>
      <Text style={styles.lightEmptyBody}>Be the first to add the next line.</Text>
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

function CompactAuthorLine({
  author,
  createdAt,
  meta
}: {
  author: PoetryThread["author"];
  createdAt: string;
  meta?: string;
}) {
  return (
    <View style={styles.compactAuthorLine}>
      <Text numberOfLines={1} style={styles.compactAuthorName}>{author.handle}</Text>
      {meta ? <Text numberOfLines={1} style={styles.compactMetaText}>{meta}</Text> : null}
      <Text style={styles.compactTimeText}>{formatRelative(createdAt)}</Text>
    </View>
  );
}

function ThreadActionBar({
  metrics,
  liked,
  actionOrder = "continue-first",
  compact = false,
  onLike,
  onContinue,
  onShare
}: {
  metrics: PoetryThread["metrics"];
  liked: boolean;
  actionOrder?: ActionOrder;
  compact?: boolean;
  onLike: () => void;
  onContinue: () => void;
  onShare: () => void;
}) {
  const continueButton = (
    <ActionButton
      key="continue"
      count={metrics.continuations}
      icon={<ContinueIcon color={colors.inkSoft} width={19} height={19} />}
      label="Continue"
      onPress={onContinue}
    />
  );
  const likeButton = (
    <ActionButton
      key="like"
      active={liked}
      count={metrics.likes}
      icon={<LikeIcon filled={liked} activeColor={colors.liked} color={colors.inkSoft} width={19} height={18} />}
      label="Like"
      onPress={onLike}
    />
  );
  const shareButton = (
    <ActionButton
      key="share"
      count={metrics.shares}
      icon={<ShareIcon color={colors.inkSoft} width={19} height={19} />}
      label="Share"
      onPress={onShare}
    />
  );
  const buttons = actionOrder === "like-first"
    ? [likeButton, continueButton, shareButton]
    : [continueButton, likeButton, shareButton];

  return (
    <View style={[styles.actionBar, compact && styles.compactActionBar]}>
      {buttons}
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
  onSubmitted: (continuation: ThreadContinuation, target: ComposerTarget) => void;
}) {
  const [content, setContent] = useState("");
  const [draftByTarget, setDraftByTarget] = useState<Record<string, string>>({});
  const translateY = useRef(new Animated.Value(340)).current;
  const targetKey = target ? composerTargetKey(target) : null;
  const targetAuthor = target?.kind === "thread" ? target.thread.author.handle : target?.continuation.author.handle;
  const preview = target?.kind === "thread" ? target.thread.content : target?.continuation.content;
  const trimmedContent = content.trim();
  const createThreadMutation = useMutation({
    mutationFn: () => {
      if (!target || target.kind !== "thread") throw new Error("Missing thread target");
      return lineSpaceApi.createThreadContinuation({
        threadId: target.thread.id,
        userId: currentUserId,
        content
      });
    },
    onSuccess: (continuation) => {
      if (!target) return;
      setContent("");
      if (targetKey) {
        setDraftByTarget((current) => ({ ...current, [targetKey]: "" }));
      }
      onSubmitted(continuation, target);
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
    onSuccess: (continuation) => {
      if (!target) return;
      setContent("");
      if (targetKey) {
        setDraftByTarget((current) => ({ ...current, [targetKey]: "" }));
      }
      onSubmitted(continuation, target);
    }
  });

  const isPending = createThreadMutation.isPending || createContinuationMutation.isPending;
  const isError = createThreadMutation.isError || createContinuationMutation.isError;
  const canSubmit = trimmedContent.length > 0 && !isPending;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: target ? 0 : 340,
      duration: target ? 220 : 170,
      easing: target ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [target, translateY]);

  useEffect(() => {
    if (!targetKey) return;
    setContent(draftByTarget[targetKey] ?? "");
  }, [draftByTarget, targetKey]);

  useEffect(() => {
    if (Platform.OS !== "web" || !target) return undefined;
    const styleId = "linespace-inline-composer-focus-reset";
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.textContent = "textarea:focus,input:focus{outline:none!important;}";
      document.head.appendChild(styleElement);
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose, target]);

  useEffect(() => {
    if (Platform.OS !== "android" || !target) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isPending) return true;
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [isPending, onClose, target]);

  if (!target) return null;

  const handleChangeText = (value: string) => {
    setContent(value);
    if (!targetKey) return;
    setDraftByTarget((current) => ({ ...current, [targetKey]: value }));
  };
  const handleSubmit = () => {
    if (!canSubmit) return;
    if (target.kind === "thread") createThreadMutation.mutate();
    if (target.kind === "continuation") createContinuationMutation.mutate();
  };

  return (
    <View pointerEvents="box-none" style={styles.inlineComposerRoot}>
      <Pressable
        accessibilityLabel="Close continue composer"
        disabled={isPending}
        onPress={onClose}
        style={styles.inlineComposerDismissLayer}
      />
      <Animated.View style={[styles.inlineComposerPanel, { transform: [{ translateY }] }]}>
        <ComposerContextPreview author={targetAuthor ?? "writer"} text={preview ?? ""} />
        <View style={styles.inlineInputRow}>
          <TextInput
            autoFocus
            multiline
            onChangeText={handleChangeText}
            onSubmitEditing={Platform.OS === "web" ? handleSubmit : undefined}
            placeholder="Write the next line..."
            placeholderTextColor={colors.profileMuted}
            scrollEnabled
            style={styles.inlineComposerInput}
            textAlignVertical="center"
            value={content}
          />
          <Pressable
            accessibilityLabel="Send continuation"
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={[styles.inlineSendButton, !canSubmit && styles.inlineSendButtonDisabled]}
          >
            {isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <ShareIcon color={canSubmit ? colors.white : colors.profileMuted} width={19} height={19} />
            )}
          </Pressable>
        </View>
        {isError ? <Text style={styles.inlineComposerError}>This continuation could not be published. Try again.</Text> : null}
        {Platform.OS === "web" ? <KeyboardPlaceholder onDismiss={onClose} /> : null}
      </Animated.View>
    </View>
  );
}

function ComposerContextPreview({ author, text }: { author: string; text: string }) {
  return (
    <View style={styles.composerContext}>
      <Text style={styles.composerContextLabel}>
        Continuing from <Text style={styles.composerContextAuthor}>@{author}</Text>
      </Text>
      <Text numberOfLines={3} style={styles.composerContextText}>{text}</Text>
    </View>
  );
}

function KeyboardPlaceholder({ onDismiss }: { onDismiss: () => void }) {
  const rows = [
    ["", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    ["wide", "", "", "", "", "", "", "wide"],
    ["globe", "space", "return"]
  ];

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.keyboardPlaceholder}>
      <View style={styles.keyboardSuggestionRow}>
        {Array.from({ length: 7 }).map((_, index) => (
          <View key={`suggestion-${index}`} style={styles.keyboardSuggestionKey} />
        ))}
        <Pressable accessibilityLabel="Hide keyboard" accessibilityRole="button" onPress={onDismiss} style={styles.keyboardDismissKey}>
          <View style={styles.keyboardDismissMark} />
        </Pressable>
      </View>
      {rows.map((row, rowIndex) => (
        <View key={`keyboard-row-${rowIndex}`} style={styles.keyboardRow}>
          {row.map((kind, index) => (
            <View
              key={`${rowIndex}-${index}`}
              style={[
                styles.keyboardKey,
                kind === "wide" && styles.keyboardWideKey,
                kind === "globe" && styles.keyboardGlobeKey,
                kind === "space" && styles.keyboardSpaceKey,
                kind === "return" && styles.keyboardReturnKey
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function FixedComposerButton({ label, onPress, hidden = false }: { label: string; onPress: () => void; hidden?: boolean }) {
  if (hidden) return null;
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

function sortContinuationItems(items: readonly ThreadContinuation[], order: ContinuationOrder) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (order === "recent") {
        const dateDiff = Date.parse(right.item.createdAt) - Date.parse(left.item.createdAt);
        return dateDiff || left.index - right.index;
      }
      const likeDiff = right.item.metrics.likes - left.item.metrics.likes;
      return likeDiff || left.index - right.index;
    })
    .map(({ item }) => item);
}

async function getDescendantsDepthFirst(
  continuation: ThreadContinuation,
  order: ContinuationOrder,
  viewerId: string,
  depth = 1,
  visited = new Set<string>()
): Promise<FlattenedDescendantRow[]> {
  if (visited.has(continuation.id)) return [];
  visited.add(continuation.id);

  const detail = await lineSpaceApi.getContinuationDetail(continuation.id, viewerId);
  const children = sortContinuationItems(detail?.children ?? [], order);
  const rows: FlattenedDescendantRow[] = [];

  for (const child of children) {
    if (visited.has(child.id)) continue;
    rows.push({ continuation: child, actualDepth: depth });
    rows.push(...(await getDescendantsDepthFirst(child, order, viewerId, depth + 1, visited)));
  }

  return rows;
}

function buildVisibleContinuationGroups(
  roots: readonly ThreadContinuation[],
  expandedDescendants: Record<string, FlattenedDescendantRow[]>,
  expandedRootIds: Set<string>,
  loadingRootIds: Set<string>
): ContinuationVisibleGroup[] {
  return roots.map((root) => {
    const isExpanded = expandedRootIds.has(root.id);
    const descendants = isExpanded ? expandedDescendants[root.id] ?? [] : [];
    const rootRow: ContinuationVisibleRow = {
      continuation: root,
      rootGroupId: root.id,
      actualDepth: 0,
      isExpandedDescendant: false,
      isFirstInExpandedGroup: false,
      isLastInExpandedGroup: false,
      hasVisiblePreviousNodeInGroup: false,
      hasVisibleNextNodeInGroup: descendants.length > 0,
      isLastVisibleDescendantInGroup: descendants.length === 0,
      showContinuationEntry: !isExpanded && root.metrics.continuations > 0,
      isLoadingDescendants: isExpanded && loadingRootIds.has(root.id)
    };
    const descendantRows = descendants.map((item, index) => ({
      continuation: item.continuation,
      rootGroupId: root.id,
      actualDepth: item.actualDepth,
      isExpandedDescendant: true,
      isFirstInExpandedGroup: index === 0,
      isLastInExpandedGroup: index === descendants.length - 1,
      hasVisiblePreviousNodeInGroup: index > 0,
      hasVisibleNextNodeInGroup: index < descendants.length - 1,
      isLastVisibleDescendantInGroup: index === descendants.length - 1,
      showContinuationEntry: false,
      isLoadingDescendants: false
    }));

    return { rootRow, descendantRows };
  });
}

function composerTargetKey(target: ComposerTarget) {
  return target.kind === "thread" ? `thread:${target.thread.id}` : `continuation:${target.continuation.id}`;
}

function addContinuationMetric<T extends PoetryThread | ThreadContinuation>(item: T): T {
  return {
    ...item,
    metrics: {
      ...item.metrics,
      continuations: item.metrics.continuations + 1
    }
  };
}

function updateThreadListCaches(
  queryClient: QueryClient,
  continuation: ThreadContinuation
) {
  queryClient.setQueriesData<PoetryThread[]>({ queryKey: ["threads"] }, (threads) => {
    if (!threads) return threads;
    return threads.map((thread) =>
      thread.id === continuation.threadId ? addContinuationMetric(thread) : thread
    );
  });
}

function updateThreadDetailCache(
  queryClient: QueryClient,
  threadId: string | undefined,
  continuation: ThreadContinuation,
  target: ComposerTarget
) {
  if (!threadId) return;
  queryClient.setQueryData<ThreadDetail>(["thread-detail", threadId, currentUserId], (detail) => {
    if (!detail) return detail;
    if (target.kind === "thread") {
      return {
        thread: addContinuationMetric(detail.thread),
        continuations: [continuation, ...detail.continuations]
      };
    }

    return {
      thread: addContinuationMetric(detail.thread),
      continuations: detail.continuations.map((item) =>
        item.id === target.continuation.id ? addContinuationMetric(item) : item
      )
    };
  });
}

function updateContinuationDetailCache(
  queryClient: QueryClient,
  continuationId: string | undefined,
  continuation: ThreadContinuation,
  target: ComposerTarget
) {
  if (!continuationId) return;
  queryClient.setQueryData<ContinuationDetail>(["continuation-detail", continuationId, currentUserId], (detail) => {
    if (!detail) return detail;
    if (target.kind === "thread") {
      return {
        ...detail,
        thread: addContinuationMetric(detail.thread)
      };
    }

    const isCurrentTarget = detail.current.id === target.continuation.id;
    return {
      ...detail,
      thread: addContinuationMetric(detail.thread),
      current: isCurrentTarget ? addContinuationMetric(detail.current) : detail.current,
      path: detail.path.map((item) =>
        item.id === target.continuation.id ? addContinuationMetric(item) : item
      ),
      children: isCurrentTarget
        ? [continuation, ...detail.children]
        : detail.children.map((item) =>
            item.id === target.continuation.id ? addContinuationMetric(item) : item
          )
    };
  });
}

function appendExpandedDescendant(
  current: Record<string, FlattenedDescendantRow[]>,
  parentId: string,
  continuation: ThreadContinuation
) {
  if (!current[parentId]) return current;
  return {
    ...current,
    [parentId]: [
      { continuation, actualDepth: 1 },
      ...current[parentId]
    ]
  };
}

function createStandaloneContinuationRow(continuation: ThreadContinuation): ContinuationVisibleRow {
  return {
    continuation,
    rootGroupId: continuation.id,
    actualDepth: 0,
    isExpandedDescendant: false,
    isFirstInExpandedGroup: false,
    isLastInExpandedGroup: true,
    hasVisiblePreviousNodeInGroup: false,
    hasVisibleNextNodeInGroup: false,
    isLastVisibleDescendantInGroup: true,
    showContinuationEntry: false,
    isLoadingDescendants: false
  };
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

function coverToneStyle(tone: NonNullable<PoetryThread["cover"]>["tone"]) {
  if (tone === "night") return styles.coverToneNight;
  if (tone === "water") return styles.coverToneWater;
  return styles.coverTonePaper;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.surface },
  screen: { paddingBottom: 0, backgroundColor: colors.surface },
  scroll: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    height: 78,
    paddingTop: 30,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface
  },
  detailTopBar: {
    height: 78,
    paddingTop: 30,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  detailLeftActions: { width: 88, minHeight: 44, flexDirection: "row", alignItems: "center" },
  detailTitleWrap: { flex: 1, alignItems: "center" },
  detailTitle: { fontSize: 18, lineHeight: 22, fontWeight: "700", color: colors.ink },
  detailTitleLarge: { fontSize: 24, lineHeight: 29, fontWeight: "700" },
  detailHeaderActions: { width: 88, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  detailIconButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  backGlyph: { fontSize: 35, lineHeight: 38, color: colors.ink },
  feedContent: { paddingBottom: 96 },
  detailContent: { paddingBottom: 86 },
  composerOpenContentInset: { paddingBottom: 390 },
  sortRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 34,
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: 10
  },
  sortPill: {
    minHeight: 32,
    minWidth: 58,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  sortPillActive: {},
  sortText: { fontSize: 14, lineHeight: 18, fontWeight: "400", color: colors.profileMuted },
  sortTextActive: { color: colors.ink, fontWeight: "500" },
  threadCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface
  },
  elevatedCard: {
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  threadRow: { flexDirection: "row", alignItems: "flex-start" },
  threadAvatarButton: { minWidth: 38, minHeight: 38 },
  threadBody: { flex: 1, minWidth: 0, marginLeft: 10, alignItems: "flex-start" },
  threadOpenArea: { maxWidth: "100%" },
  authorRow: { flexDirection: "row", alignItems: "center" },
  authorCopy: { flex: 1, marginLeft: 12, minWidth: 0 },
  authorLine: { flexDirection: "row", alignItems: "center" },
  authorName: { maxWidth: "72%", fontSize: 16, lineHeight: 20, fontWeight: "700", color: colors.ink },
  timeText: { marginLeft: 6, fontSize: 15, lineHeight: 19, color: colors.profileMuted },
  metaText: { marginTop: 2, fontSize: 13, lineHeight: 16, color: colors.accent },
  compactAuthorLine: { minHeight: 19, flexDirection: "row", alignItems: "center", maxWidth: "100%" },
  compactAuthorName: { maxWidth: "58%", fontSize: 15, lineHeight: 19, fontWeight: "700", color: colors.ink },
  compactMetaText: { flexShrink: 1, maxWidth: "34%", marginLeft: 6, fontSize: 14, lineHeight: 18, color: colors.inkSoft },
  compactTimeText: { marginLeft: 6, fontSize: 14, lineHeight: 18, color: colors.profileMuted },
  threadContent: { marginTop: 2, maxWidth: "100%", fontSize: 15, lineHeight: 21, color: colors.ink },
  topicText: { marginTop: 5, fontSize: 13, lineHeight: 17, color: colors.profileMuted },
  actionBar: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 5 },
  compactActionBar: { marginTop: 3 },
  actionButton: { minHeight: 32, minWidth: 42, flexDirection: "row", alignItems: "center" },
  actionCount: { marginLeft: 5, fontSize: 13, lineHeight: 17, color: colors.inkSoft },
  actionCountActive: { color: colors.liked },
  detailHero: {
    position: "relative",
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface
  },
  detailHeroWithCover: { minHeight: 172 },
  detailHeroImageWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42
  },
  detailHeroFadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: "rgba(255,255,255,0.72)"
  },
  coverToneWater: { backgroundColor: "#B9D9E5" },
  coverTonePaper: { backgroundColor: "#E9DDC9" },
  coverToneNight: { backgroundColor: "#2E3342" },
  detailHeroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailHeroAuthor: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  detailHeroNameLine: { flex: 1, minWidth: 0, marginLeft: 10, flexDirection: "row", alignItems: "center" },
  detailHeroName: { maxWidth: "62%", fontSize: 15, lineHeight: 19, fontWeight: "700", color: colors.ink },
  detailHeroTime: { marginLeft: 6, fontSize: 14, lineHeight: 18, color: colors.profileMuted },
  followButton: { minHeight: 30, minWidth: 73, paddingHorizontal: 14, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
  followingButton: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.profileMuted, backgroundColor: colors.surface },
  followButtonText: { fontSize: 13, lineHeight: 17, fontWeight: "600", color: colors.white },
  followingButtonText: { color: colors.profileMuted },
  detailHeroContent: { marginTop: 10, fontSize: 15, lineHeight: 21, color: colors.ink },
  detailHeroTag: { marginTop: 5, fontSize: 13, lineHeight: 17, color: colors.profileMuted },
  continuationHeader: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface
  },
  continuationHeaderTitle: { fontSize: 15, lineHeight: 21, fontWeight: "700", color: colors.ink },
  continuationOrder: { flexDirection: "row", alignItems: "center", gap: 14 },
  orderButton: { minHeight: 32, justifyContent: "center" },
  orderText: { fontSize: 15, lineHeight: 21, color: colors.profileMuted },
  orderTextActive: { fontWeight: "600", color: colors.ink },
  continuationWrap: {
    position: "relative",
    paddingHorizontal: continuationHorizontalPadding,
    paddingVertical: continuationRowPaddingVertical,
    overflow: "visible"
  },
  expandedContinuationGroup: {
    position: "relative",
    overflow: "visible",
    backgroundColor: colors.surface
  },
  groupLayer: {
    position: "relative",
    zIndex: 2
  },
  parentChildConnectorVertical: {
    position: "absolute",
    left: level0ConnectorX,
    width: connectorWidth,
    backgroundColor: connectorColor,
    zIndex: 1
  },
  parentChildConnectorHorizontal: {
    position: "absolute",
    left: level0ConnectorX,
    width: level1ConnectorX - level0ConnectorX,
    height: connectorWidth,
    backgroundColor: connectorColor,
    zIndex: 1
  },
  childContinuationGroup: {
    position: "relative",
    overflow: "visible"
  },
  childVerticalSpine: {
    position: "absolute",
    left: level1ConnectorX,
    width: connectorWidth,
    backgroundColor: connectorColor,
    zIndex: 0
  },
  continuationWrapWithDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  collapsedConnectorVertical: {
    position: "absolute",
    left: level0ConnectorX,
    top: continuationRowPaddingVertical + level0AvatarSize,
    bottom: continuationRowPaddingVertical + showContinuationRowHeight / 2,
    width: connectorWidth,
    backgroundColor: connectorColor
  },
  collapsedConnectorHorizontal: {
    position: "absolute",
    left: level0ConnectorX,
    bottom: continuationRowPaddingVertical + showContinuationRowHeight / 2,
    width: showContinuationAvatarCenterX - level0ConnectorX,
    height: connectorWidth,
    backgroundColor: connectorColor
  },
  continuationRow: { flexDirection: "row", alignItems: "flex-start" },
  level1ContinuationWrap: {
    paddingTop: level1RowPaddingVertical,
    paddingBottom: level1RowPaddingVertical
  },
  level1ContinuationRow: {
    marginLeft: level1IndentOffset
  },
  continuationAvatarColumn: {
    position: "relative",
    alignItems: "center",
    overflow: "visible"
  },
  continuationAvatarButton: {
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    zIndex: 2
  },
  continuationBody: { flex: 1, minWidth: 0, marginLeft: continuationContentGap },
  level1ContinuationBody: { marginLeft: level1ContentGap },
  continuationTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  continuationAuthorLine: {
    flex: 1,
    minWidth: 0,
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center"
  },
  continuationAuthorName: { flexShrink: 1, maxWidth: "78%", fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.ink },
  continuationTime: { flexShrink: 0, marginLeft: 7, fontSize: 14, lineHeight: 19, color: colors.profileMuted },
  continuationOpenArea: { maxWidth: "100%" },
  continuationMoreButton: { width: 36, height: 30, alignItems: "flex-end", justifyContent: "center" },
  continuationContent: { marginTop: 2, fontSize: 16, lineHeight: 22, color: colors.ink },
  continuationLoadingRow: { minHeight: 32, marginTop: 2, flexDirection: "row", alignItems: "center" },
  continuationLoadingText: { marginLeft: 8, fontSize: 14, lineHeight: 18, color: colors.profileMuted },
  showContinuationsRow: {
    minHeight: showContinuationRowHeight,
    marginTop: 0,
    flexDirection: "row",
    alignItems: "center"
  },
  showContinuationsText: { marginLeft: 9, fontSize: 16, lineHeight: 21, color: colors.profileMuted },
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
  pathChain: {
    position: "relative",
    overflow: "visible",
    paddingBottom: 4,
    backgroundColor: colors.surface
  },
  pathVerticalSpine: {
    position: "absolute",
    left: pathAvatarCenterX,
    width: connectorWidth,
    backgroundColor: connectorColor,
    zIndex: 0
  },
  pathNodeRow: {
    position: "relative",
    zIndex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: pathHorizontalPadding,
    paddingVertical: pathNodePaddingVertical
  },
  pathAvatarColumn: {
    width: pathAvatarColumnWidth,
    alignItems: "center",
    overflow: "visible"
  },
  pathAvatarButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    zIndex: 2
  },
  pathNodeBody: { flex: 1, minWidth: 0, marginLeft: pathBodyGap },
  pathNodeTopLine: { minHeight: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pathAuthorLine: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  pathAuthorName: { flexShrink: 1, maxWidth: "72%", fontSize: 16, lineHeight: 20, fontWeight: "700", color: colors.ink },
  pathTimeText: { flexShrink: 0, marginLeft: 6, fontSize: 15, lineHeight: 20, color: colors.profileMuted },
  pathMoreButton: { width: 34, height: 30, alignItems: "flex-end", justifyContent: "center" },
  pathMetaText: { marginTop: 1, fontSize: 14, lineHeight: 18, color: colors.accent },
  pathOpenArea: { maxWidth: "100%" },
  pathContentText: { marginTop: 5, fontSize: 16, lineHeight: 22, color: colors.ink },
  lightEmptyContinuation: {
    paddingHorizontal: pathHorizontalPadding,
    paddingTop: 18,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  lightEmptyTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600", color: colors.ink },
  lightEmptyBody: { marginTop: 4, fontSize: 14, lineHeight: 19, color: colors.profileMuted },
  fixedComposer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: 7,
    paddingBottom: 11,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  fixedComposerButton: {
    minHeight: 42,
    borderRadius: 21,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceMuted
  },
  fixedComposerText: { fontSize: 15, lineHeight: 21, color: colors.profileMuted },
  inlineComposerRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 30
  },
  inlineComposerDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent"
  },
  inlineComposerPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8
  },
  composerContext: {
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 8
  },
  composerContextLabel: { fontSize: 12, lineHeight: 16, color: colors.profileMuted },
  composerContextAuthor: { color: colors.inkSoft, fontWeight: "600" },
  composerContextText: { marginTop: 3, fontSize: 14, lineHeight: 19, color: colors.inkSoft },
  inlineInputRow: {
    minHeight: 50,
    marginHorizontal: spacing.lg,
    marginBottom: 9,
    borderRadius: 25,
    paddingLeft: 15,
    paddingRight: 5,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surfaceMuted
  },
  inlineComposerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    paddingTop: 11,
    paddingBottom: 10,
    paddingRight: 9,
    fontSize: 16,
    lineHeight: 21,
    color: colors.ink
  },
  inlineSendButton: {
    width: 40,
    height: 40,
    marginBottom: 5,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink
  },
  inlineSendButtonDisabled: {
    backgroundColor: colors.faint
  },
  inlineComposerError: {
    marginHorizontal: spacing.lg,
    marginTop: -3,
    marginBottom: 7,
    fontSize: 12,
    lineHeight: 16,
    color: colors.accent
  },
  keyboardPlaceholder: {
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 13,
    backgroundColor: "#D8D9DD"
  },
  keyboardSuggestionRow: {
    height: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  keyboardSuggestionKey: {
    width: 34,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.74)"
  },
  keyboardDismissKey: {
    width: 34,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.42)"
  },
  keyboardDismissMark: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkSoft
  },
  keyboardRow: {
    minHeight: 44,
    marginTop: 7,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6
  },
  keyboardKey: {
    flex: 1,
    maxWidth: 37,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.surface
  },
  keyboardWideKey: { flex: 1.35, maxWidth: 52, backgroundColor: "#EEF0F3" },
  keyboardGlobeKey: { flex: 0.92, maxWidth: 43, backgroundColor: "#EEF0F3" },
  keyboardSpaceKey: { flex: 4.2, maxWidth: 210 },
  keyboardReturnKey: { flex: 1.8, maxWidth: 78, backgroundColor: "#EEF0F3" },
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
