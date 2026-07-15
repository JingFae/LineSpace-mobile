import { useMemo, useState, type ReactNode } from "react";
import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ActivityIcon,
  AppScreen,
  BackIcon,
  BottomNavigation,
  CommentIcon,
  LikeIcon,
  SearchIcon
} from "@linespace/ui";
import { colors } from "@linespace/tokens";
import type {
  InboxActivityKind,
  InboxActivityPreview,
  InboxActivitySummary,
  InboxActivityTargetKind
} from "@linespace/api-client";
import { mainTabs, tabRoutes, type MainTab } from "@/navigation/tabs";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";

type InboxPage = "home" | "comments" | "likes" | "thread" | "dm";

type ActivityRow = {
  userId?: string;
  name: string;
  info: string;
  date: string;
  color: string;
  commentId?: string;
  poemId?: string;
  targetKind?: InboxActivityTargetKind;
  unread?: number;
};

type SentDmMessage = {
  id: string;
  text: string;
  recalled?: boolean;
};

type DetailRow = {
  name: string;
  action: string;
  body: string;
  quote: string;
  color: string;
  threadId: string;
  targetThreadId?: string;
  poemId?: string;
  commentId?: string;
  targetKind?: InboxActivityTargetKind;
};

const homeRows: ActivityRow[] = [
  {
    userId: "user-lili",
    name: "Lili",
    info: "I loved the line about rain becoming a window.",
    date: "14:28",
    color: "#5A0000",
    unread: 1
  },
  {
    userId: "user-zhihan",
    name: "Zhihan",
    info: "Your draft feels warmer after the second stanza.",
    date: "12:10",
    color: "#0B75DE"
  },
  {
    userId: "user-jinghe",
    name: "Jinghe",
    info: "Can I quote the moon image in my reply?",
    date: "Yesterday",
    color: "#7AA0DD",
    unread: 2
  },
  {
    userId: "user-ray",
    name: "Ray",
    info: "The summer thread is ready whenever you are.",
    date: "Mon",
    color: "#8C7DE4"
  },
  {
    userId: "user-roma",
    name: "Someone",
    info: "I found your poem through the relay page.",
    date: "03/09",
    color: "#F63D49"
  }
];

const likesRows: ActivityRow[] = [
  {
    name: "Lili",
    info: 'liked your post: "summer folded into rain"',
    date: "03/09",
    color: "#5A0000",
    poemId: "poem-light",
    targetKind: "post"
  },
  {
    name: "Zhihan",
    info: 'liked your comment: "older light, softer room"',
    date: "02/19",
    color: "#0B75DE",
    commentId: "comment-zhihan-autofill",
    poemId: "poem-light",
    targetKind: "comment"
  },
  {
    name: "Jinghe",
    info: 'liked your post: "a moon in every window"',
    date: "02/18",
    color: "#7AA0DD",
    poemId: "poem-orbit",
    targetKind: "post"
  },
  {
    name: "Ray",
    info: 'liked your comment: "the line breaks open here"',
    date: "02/12",
    color: "#8C7DE4",
    commentId: "comment-ray-loneliness",
    poemId: "poem-light",
    targetKind: "comment"
  },
  {
    name: "Someone",
    info: 'liked your post: "relay notes before dawn"',
    date: "02/09",
    color: "#F63D49",
    poemId: "poem-cedar",
    targetKind: "post"
  }
];

const defaultCommentRow: DetailRow = {
  name: "Lili",
  action: "commented on your comment",
  body: "Yeah!",
  quote: "I think this is really interesting!",
  color: "#5A0000",
  threadId: "thread-lili-comment",
  poemId: "poem-light",
  targetKind: "comment"
};

const commentRows: DetailRow[] = [defaultCommentRow];

const threadRows: DetailRow[] = [
  {
    name: "Ray",
    action: "continued your thread",
    body: "That's a beautiful line! I like...",
    quote: '"rain without rain"',
    color: "#8C7DE4",
    threadId: "thread-ray-summer",
    targetThreadId: "thread-rain-without-rain",
    poemId: "poem-light",
    targetKind: "thread"
  },
  {
    name: "Zhihan",
    action: "continued your thread",
    body: "A folded letter found another ending.",
    quote: '"the unopened letter"',
    color: "#0B75DE",
    threadId: "thread-zhihan-comment",
    targetThreadId: "thread-unopened-letter",
    poemId: "poem-light",
    targetKind: "thread"
  },
  {
    name: "Jinghe",
    action: "continued your thread",
    body: "The city edge now has a second voice.",
    quote: '"at the city edge"',
    color: "#7AA0DD",
    threadId: "thread-jinghe-comment",
    targetThreadId: "thread-city-edge",
    poemId: "poem-orbit",
    targetKind: "thread"
  },
  {
    name: "Lili",
    action: "continued your thread",
    body: "The returning place became a shared room.",
    quote: '"the place we return"',
    color: "#5A0000",
    threadId: "thread-lili-followup",
    targetThreadId: "thread-place-return",
    poemId: "poem-light",
    targetKind: "thread"
  }
];

export function InboxScreen() {
  const [page, setPage] = useState<InboxPage>("home");
  const [previousPage, setPreviousPage] = useState<InboxPage>("home");
  const [selectedContact, setSelectedContact] = useState<ActivityRow>(homeRows[0]!);
  const [mutualFollow, setMutualFollow] = useState(false);
  const [readContacts, setReadContacts] = useState<Set<string>>(() => new Set());
  const inboxSummaryQuery = useQuery({
    queryKey: ["inbox-activity-summary", currentUserId],
    queryFn: () => lineSpaceApi.getInboxActivitySummary(currentUserId)
  });
  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId)
  });

  function openDm(contact: ActivityRow, sourcePage: InboxPage) {
    setSelectedContact(contact);
    setPreviousPage(sourcePage);
    setMutualFollow(false);
    setReadContacts((items) => new Set(items).add(contact.name));
    setPage("dm");
  }

  return (
    <AppScreen
      scroll={false}
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.canvas}>
        {page === "home" ? (
          <HomePage
            counts={inboxSummaryQuery.data?.unread}
            onOpen={setPage}
            onOpenDm={(contact) => openDm(contact, "home")}
            readContacts={readContacts}
          />
        ) : page === "dm" ? (
          <DmPage
            contact={selectedContact}
            mutualFollow={mutualFollow}
            onBack={() => setPage(previousPage === "dm" ? "home" : previousPage)}
            onFollowBack={() => setMutualFollow(true)}
          />
        ) : (
          <DetailPage
            page={page}
            summary={inboxSummaryQuery.data}
            onBack={() => setPage("home")}
            onOpenDm={(contact) => openDm(contact, page)}
          />
        )}
      </View>

      {page === "home" ? (
        <BottomNavigation
          items={mainTabs}
          profileAvatar={
            profileQuery.data
              ? {
                  color: profileQuery.data.avatarColor,
                  imageSource: profileQuery.data.avatarUrl
                    ? { uri: profileQuery.data.avatarUrl }
                    : undefined,
                  label: profileQuery.data.displayName
                }
              : undefined
          }
          value="inbox"
          onChange={(value: MainTab) => {
            router.push(tabRoutes[value]);
          }}
        />
      ) : null}
    </AppScreen>
  );
}

function HomePage({
  counts,
  onOpen,
  onOpenDm,
  readContacts
}: {
  counts?: Record<"comments" | "likes" | "thread", number>;
  onOpen: (page: InboxPage) => void;
  onOpenDm: (contact: ActivityRow) => void;
  readContacts: Set<string>;
}) {
  const unreadCounts = counts ?? { comments: 0, likes: 0, thread: 0 };
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return homeRows;
    return homeRows.filter((row) =>
      `${row.name} ${row.info}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <View style={styles.home}>
      <View style={styles.homeTop}>
        {searchOpen ? (
          <View style={styles.searchField}>
            <SearchIcon width={18} height={18} color="#9D9D9D" />
            <TextInput
              autoFocus
              onChangeText={setQuery}
              placeholder="Search people or messages"
              placeholderTextColor="#9D9D9D"
              style={styles.searchInput}
              value={query}
            />
            <Pressable onPress={() => { setQuery(""); setSearchOpen(false); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Inbox</Text>
            <Pressable
              accessibilityLabel="Search inbox"
              accessibilityRole="button"
              onPress={() => setSearchOpen(true)}
              style={styles.searchIcon}
            >
              <SearchIcon width={22} height={22} color={colors.black} />
            </Pressable>
          </>
        )}

        <InboxShortcut
          badge={formatBadgeCount(unreadCounts.comments)}
          label="comments"
          centerX={67}
          onPress={() => onOpen("comments")}
          renderIcon={() => <CommentIcon width={29} height={29} color={colors.black} />}
        />
        <InboxShortcut
          badge={formatBadgeCount(unreadCounts.likes)}
          label="likes"
          centerX={201}
          onPress={() => onOpen("likes")}
          renderIcon={() => <LikeIcon width={30} height={26} color={colors.black} />}
        />
        <InboxShortcut
          badge={formatBadgeCount(unreadCounts.thread)}
          label="thread"
          centerX={335}
          onPress={() => onOpen("thread")}
          renderIcon={() => <ActivityIcon width={29} height={27} color={colors.black} />}
        />

        <View style={styles.homeRule} />
      </View>

      <View style={styles.homeList}>
        {visibleRows.map((row, index) => (
          <ActivityListRow
            key={row.name}
            onPress={() => onOpenDm(row)}
            row={readContacts.has(row.name) ? { ...row, unread: undefined } : row}
            top={24 + index * 84}
          />
        ))}
      </View>
    </View>
  );
}

function InboxShortcut({
  badge,
  label,
  centerX,
  onPress,
  renderIcon
}: {
  badge: string;
  label: string;
  centerX: number;
  onPress: () => void;
  renderIcon: () => ReactNode;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.shortcut, { left: centerX - shortcutWidth / 2 }]}
    >
      <View style={styles.shortcutIconWrap}>
        <View style={styles.shortcutIcon}>{renderIcon()}</View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

function formatBadgeCount(count: number) {
  if (count <= 0) return "";
  if (count >= 99) return "+99";
  return `+${count}`;
}

const shortcutWidth = 88;

function DetailPage({
  page,
  summary,
  onBack,
  onOpenDm
}: {
  page: Exclude<InboxPage, "home" | "dm">;
  summary?: InboxActivitySummary;
  onBack: () => void;
  onOpenDm: (contact: ActivityRow) => void;
}) {
  const isThread = page === "thread";
  const rows = useMemo(() => {
    const recent = summary?.recent[page];
    if (recent?.length) {
      return page === "likes"
        ? recent.map(mapActivityPreviewToActivityRow)
        : recent.map(mapActivityPreviewToDetailRow);
    }
    return page === "likes" ? likesRows : isThread ? threadRows : commentRows;
  }, [isThread, page, summary]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replyTarget, setReplyTarget] = useState<DetailRow | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [repliesByRow, setRepliesByRow] = useState<Record<string, string[]>>({});
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      `${row.name} ${"info" in row ? row.info : `${row.action} ${row.body} ${row.quote}`}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, rows]);

  return (
    <View style={styles.detail}>
      <Pressable
        accessibilityLabel="Back to Inbox"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.backButton}
      >
        <BackIcon width={22} height={22} color={colors.black} />
      </Pressable>
      {searchOpen ? (
        <View style={styles.detailSearchField}>
          <SearchIcon width={18} height={18} color="#9D9D9D" />
          <TextInput
            autoFocus
            onChangeText={setQuery}
            placeholder={`Search ${page}`}
            placeholderTextColor="#9D9D9D"
            style={styles.searchInput}
            value={query}
          />
          <Pressable onPress={() => { setQuery(""); setSearchOpen(false); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{page}</Text>
          <Pressable
            accessibilityLabel={`Search ${page}`}
            accessibilityRole="button"
            onPress={() => setSearchOpen(true)}
            style={styles.searchIcon}
          >
            <SearchIcon width={22} height={22} color={colors.black} />
          </Pressable>
        </>
      )}

      {page === "likes"
        ? visibleRows.map((row, index) => (
            <ActivityListRow
              key={row.name}
              onPress={() => openActivityTarget(row as ActivityRow)}
              row={row as ActivityRow}
              top={115 + index * 84}
            />
          ))
        : (
            <View style={styles.detailRows}>
              {visibleRows.map((row, index) => (
                <DetailListRow
                  key={`${(row as DetailRow).name}-${index}`}
                  onOpenTarget={() =>
                    page === "thread"
                      ? openThreadTarget(row as DetailRow)
                      : openDetailActivityTarget(row as DetailRow)
                  }
                  onReplyPress={() => {
                    setReplyTarget(row as DetailRow);
                    setReplyDraft("");
                  }}
                  replies={repliesByRow[(row as DetailRow).threadId] ?? []}
                  row={row as DetailRow}
                />
              ))}
            </View>
          )}
      {page !== "likes" && replyTarget ? (
        <View style={styles.bottomReplyComposer}>
          <TextInput
            autoFocus
            onChangeText={setReplyDraft}
            onSubmitEditing={() => {
              const next = replyDraft.trim();
              if (!next) return;
              setRepliesByRow((items) => ({
                ...items,
                [replyTarget.threadId]: [...(items[replyTarget.threadId] ?? []), next]
              }));
              setReplyDraft("");
              setReplyTarget(null);
            }}
            placeholder={`Reply to ${replyTarget.name}`}
            placeholderTextColor="#9D9D9D"
            returnKeyType="send"
            style={styles.bottomReplyInput}
            value={replyDraft}
          />
          <Pressable
            accessibilityLabel="Send reply"
            accessibilityRole="button"
            onPress={() => {
              const next = replyDraft.trim();
              if (!next) return;
              setRepliesByRow((items) => ({
                ...items,
                [replyTarget.threadId]: [...(items[replyTarget.threadId] ?? []), next]
              }));
              setReplyDraft("");
              setReplyTarget(null);
            }}
            style={[
              styles.inlineReplyButton,
              replyDraft.trim().length > 0 && styles.inlineReplyButtonActive
            ]}
          >
            <Text style={styles.inlineReplySend}>^</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function openActivityTarget(row: ActivityRow) {
  if (!row.poemId) return;
  router.push({
    pathname: "/poem/[id]",
    params: {
      id: row.poemId,
      ...(row.targetKind ? { targetKind: row.targetKind } : {}),
      ...(row.commentId ? { commentId: row.commentId } : {})
    }
  });
}

function openDetailActivityTarget(row: DetailRow) {
  if (!row.poemId) return;
  router.push({
    pathname: "/poem/[id]",
    params: {
      id: row.poemId,
      targetKind: row.targetKind ?? "comment",
      ...(row.commentId ? { commentId: row.commentId } : {})
    }
  });
}

function openThreadTarget(row: DetailRow) {
  if (!row.targetThreadId) return;
  router.push({
    pathname: "/thread/[id]",
    params: { id: row.targetThreadId }
  } as unknown as Href);
}

function mapActivityPreviewToActivityRow(activity: InboxActivityPreview): ActivityRow {
  return {
    userId: activity.actor.id,
    name: activity.actor.displayName,
    info: formatActivityInfo(activity),
    date: activity.dateLabel,
    color: activity.actor.avatarColor,
    poemId: activity.target.poemId,
    commentId: activity.target.commentId,
    targetKind: activity.target.kind,
    unread: activity.unread ? 1 : undefined
  };
}

function mapActivityPreviewToDetailRow(activity: InboxActivityPreview): DetailRow {
  return {
    name: activity.actor.displayName,
    action: formatActivityAction(activity),
    body: activity.target.excerpt,
    quote: activity.target.title,
    color: activity.actor.avatarColor,
    threadId: activity.id,
    targetThreadId: activity.target.threadId,
    poemId: activity.target.poemId,
    commentId: activity.target.commentId,
    targetKind: activity.target.kind
  };
}

function formatActivityInfo(activity: InboxActivityPreview) {
  if (activity.kind === "likes") {
    return activity.target.kind === "comment"
      ? `liked your comment: "${activity.target.excerpt}"`
      : `liked your post: "${activity.target.excerpt}"`;
  }
  if (activity.kind === "thread") {
    return `continued your thread: "${activity.target.title}"`;
  }
  return activity.target.kind === "comment"
    ? `commented on your comment: "${activity.target.excerpt}"`
    : `commented on your post: "${activity.target.title}"`;
}

function formatActivityAction(activity: InboxActivityPreview) {
  if (activity.kind === "thread") return "continued your thread";
  if (activity.target.kind === "comment") return "commented on your comment";
  return "commented on your post";
}

function ActivityListRow({
  row,
  top,
  onPress
}: {
  row: ActivityRow;
  top: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open chat with ${row.name}`}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.activityRow, { top }]}
    >
      <View style={[styles.avatar, { backgroundColor: row.color }]} />
      <Text style={styles.name}>{row.name}</Text>
      <Text numberOfLines={1} style={styles.info}>
        {row.info}
      </Text>
      <Text style={styles.date}>{row.date}</Text>
      {row.unread ? (
        <View style={styles.unreadDot}>
          <Text style={styles.unreadText}>{row.unread > 9 ? "9+" : row.unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function DetailListRow({
  row,
  onOpenTarget,
  onReplyPress,
  replies
}: {
  row: DetailRow;
  onOpenTarget: () => void;
  onReplyPress: () => void;
  replies: string[];
}) {
  const [liked, setLiked] = useState(false);
  const latestReply = replies.at(-1);

  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailAvatar, { backgroundColor: row.color }]} />
      <Pressable
        accessibilityLabel={`Open ${row.name}'s activity target`}
        accessibilityRole="button"
        onPress={onOpenTarget}
        style={styles.detailTextBlock}
      >
        <Text style={styles.detailNameText}>{row.name}</Text>
        <Text numberOfLines={1} style={styles.action}>
          {row.action}
        </Text>
        <Text numberOfLines={1} style={styles.bodyText}>
          {row.body}
        </Text>
        <View style={styles.quoteRow}>
          <View style={styles.quoteLine} />
          <Text numberOfLines={1} style={styles.quote}>
            {row.quote}
          </Text>
        </View>
      </Pressable>
      {!latestReply ? (
        <View style={styles.miniActions}>
          <Pressable
            accessibilityLabel={`Reply to ${row.name}`}
            accessibilityRole="button"
            onPress={onReplyPress}
            style={styles.miniActionButton}
          >
            <CommentIcon width={20} height={18} color={colors.black} />
          </Pressable>
          <Pressable
            accessibilityLabel={liked ? `Unlike ${row.name}'s thread` : `Like ${row.name}'s thread`}
            accessibilityRole="button"
            onPress={() => setLiked((value) => !value)}
            style={styles.miniActionButton}
          >
            <LikeIcon
              width={20}
              height={18}
              color={liked ? "#FC1111" : colors.black}
              activeColor="#FC1111"
              filled={liked}
            />
          </Pressable>
        </View>
      ) : null}
      {latestReply ? (
        <Pressable
          accessibilityLabel={`Reply again to ${row.name}`}
          accessibilityRole="button"
          onPress={onReplyPress}
          style={styles.replyPreview}
        >
          <Text numberOfLines={1} style={styles.myReply}>
            Me: {latestReply}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.thumb} />
    </View>
  );
}

function DmPage({
  contact,
  mutualFollow,
  onBack,
  onFollowBack
}: {
  contact: ActivityRow;
  mutualFollow: boolean;
  onBack: () => void;
  onFollowBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sentMessages, setSentMessages] = useState<SentDmMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const inboxMessagesQuery = useQuery({
    queryKey: ["inbox-messages", currentUserId, contact.userId],
    enabled: Boolean(contact.userId),
    queryFn: () => lineSpaceApi.listInboxMessages(currentUserId, contact.userId!)
  });
  const sharedMessages = (inboxMessagesQuery.data ?? []).filter((message) => message.kind === "shared-post");
  const searchableText = `${contact.name} ${contact.info} ${sentMessages
    .map((item) => item.text)
    .join(" ")}`.toLowerCase();
  const searchHasMatch =
    searchText.trim().length > 0 &&
    searchableText.includes(searchText.trim().toLowerCase());
  const canReply = mutualFollow || sentMessages.length === 0;

  function sendMessage() {
    const next = draft.trim();
    if (!canReply || !next) return;
    setDraft("");
    setSentMessages((items) => [
      ...items,
      { id: `sent-${Date.now()}-${items.length}`, text: next }
    ]);
  }

  function recallMessage(messageId: string) {
    setSentMessages((items) =>
      items.map((item) =>
        item.id === messageId ? { ...item, recalled: true, text: "message recalled" } : item
      )
    );
    setSelectedMessageId(null);
  }

  function deleteMessage(messageId: string) {
    setSentMessages((items) => items.filter((item) => item.id !== messageId));
    setSelectedMessageId(null);
  }

  return (
    <View style={styles.dm}>
      <View style={styles.dmHeader}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <BackIcon width={22} height={22} color={colors.black} />
        </Pressable>
        {searchOpen ? (
          <View style={styles.detailSearchField}>
            <SearchIcon width={18} height={18} color="#9D9D9D" />
            <TextInput
              autoFocus
              onChangeText={setSearchText}
              placeholder="Search this chat"
              placeholderTextColor="#9D9D9D"
              style={styles.searchInput}
              value={searchText}
            />
            <Pressable onPress={() => { setSearchText(""); setSearchOpen(false); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{contact.name}</Text>
            <Pressable
              accessibilityLabel="Search this chat"
              accessibilityRole="button"
              onPress={() => setSearchOpen(true)}
              style={styles.searchIcon}
            >
              <SearchIcon width={22} height={22} color={colors.black} />
            </Pressable>
          </>
        )}
      </View>

      <View style={[styles.dmAvatar, { backgroundColor: contact.color }]} />
      <Text style={styles.dmName}>{contact.name}</Text>
      <Text numberOfLines={1} style={styles.dmSubtitle}>
        {contact.date} - {contact.info.replace("...", "")}
      </Text>

      {sharedMessages.map((message, index) => message.sharedPost ? (
        <Pressable key={message.id} onPress={() => router.push({ pathname: "/poem/[id]", params: { id: message.sharedPost!.id } })} style={[styles.sharedPostCard, { top: 292 + index * 112 }]}>
          <View style={styles.sharedPostHeader}><Text style={styles.sharedPostLabel}>SHARED A POST</Text><Text style={styles.sharedPostTime}>{formatMessageTime(message.createdAt)}</Text></View>
          <Text numberOfLines={1} style={styles.sharedPostTitle}>{message.sharedPost.title}</Text>
          <Text numberOfLines={2} style={styles.sharedPostExcerpt}>{message.sharedPost.excerpt}</Text>
          <Text style={styles.sharedPostOpen}>Open post ›</Text>
        </Pressable>
      ) : null)}

      <Text style={[styles.bubble, styles.incomingBubble]}>
        {contact.info}
      </Text>
      {mutualFollow ? (
        <Text style={[styles.bubble, styles.outgoingBubble]}>
          Thanks, I followed you back.
        </Text>
      ) : null}
      {sentMessages.map((message, index) => (
        <Pressable
          key={message.id}
          accessibilityLabel="Message actions"
          accessibilityRole="button"
          onLongPress={() => setSelectedMessageId(message.id)}
          style={[styles.sentBubbleWrap, { top: 382 + sharedMessages.length * 112 + index * 58 }]}
        >
          <Text style={[styles.bubble, styles.sentBubble, message.recalled && styles.recalledBubble]}>
            {message.text}
          </Text>
        </Pressable>
      ))}

      {selectedMessageId ? (
        <View style={styles.messageMenu}>
          <Pressable onPress={() => recallMessage(selectedMessageId)} style={styles.messageMenuItem}>
            <Text style={styles.messageMenuText}>Recall</Text>
          </Pressable>
          <View style={styles.messageMenuDivider} />
          <Pressable onPress={() => deleteMessage(selectedMessageId)} style={styles.messageMenuItem}>
            <Text style={styles.messageMenuText}>Delete</Text>
          </Pressable>
        </View>
      ) : null}

      {searchOpen && searchText.trim() ? (
        <Text style={styles.searchResultText}>
          {searchHasMatch ? "Found in this conversation" : "No matching message"}
        </Text>
      ) : null}

      {!mutualFollow ? (
        <>
          <Text style={[styles.dmRule, { top: 405 + sharedMessages.length * 112 + sentMessages.length * 58 }]}>
            You can reply once. Follow back to continue freely.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onFollowBack}
            style={[styles.followBack, { top: 486 + sharedMessages.length * 112 + sentMessages.length * 58 }]}
          >
            <Text style={styles.followBackText}>Follow back</Text>
          </Pressable>
        </>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          editable={canReply}
          onChangeText={setDraft}
          onSubmitEditing={sendMessage}
          placeholder={canReply ? "Message" : "Follow back to continue"}
          placeholderTextColor="#9D9D9D"
          returnKeyType="send"
          style={styles.composerInput}
          value={draft}
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          disabled={!canReply || draft.trim().length === 0}
          onPress={sendMessage}
          style={[
            styles.sendButton,
            canReply && draft.trim().length > 0 && styles.sendButtonActive
          ]}
        >
          <Text style={styles.sendText}>^</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#F6F7F7"
  },
  screen: {
    backgroundColor: "#F6F7F7",
    alignItems: "center"
  },
  canvas: {
    position: "relative",
    width: 402,
    maxWidth: "100%",
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#F6F7F7"
  },
  home: {
    flex: 1,
    backgroundColor: "#F6F7F7"
  },
  homeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 402,
    height: 246,
    backgroundColor: colors.surface
  },
  detail: {
    flex: 1,
    backgroundColor: colors.surface
  },
  title: {
    position: "absolute",
    top: 61,
    left: 0,
    width: 402,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "400",
    color: colors.black
  },
  searchIcon: {
    position: "absolute",
    top: 61,
    left: 356
  },
  backButton: {
    position: "absolute",
    top: 64,
    left: 20,
    zIndex: 1,
    width: 22,
    height: 22
  },
  shortcut: {
    position: "absolute",
    top: 132,
    width: 88,
    height: 62,
    alignItems: "center"
  },
  shortcutIconWrap: {
    position: "relative",
    width: 58,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5
  },
  shortcutIcon: {
    width: 34,
    height: 29,
    justifyContent: "center",
    alignItems: "center"
  },
  shortcutLabel: {
    fontSize: 16,
    lineHeight: 19,
    color: colors.black
  },
  badge: {
    position: "absolute",
    top: -3,
    right: 0,
    minWidth: 33,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#FC1111",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  badgeText: {
    color: colors.surface,
    fontSize: 13,
    lineHeight: 16
  },
  homeRule: {
    position: "absolute",
    top: 216,
    left: 0,
    width: 402,
    height: 1,
    backgroundColor: "#EEEEEE"
  },
  homeList: {
    position: "absolute",
    top: 246,
    left: 0,
    width: 402,
    height: 558,
    backgroundColor: colors.surface
  },
  activityRow: {
    position: "absolute",
    left: 0,
    width: 402,
    height: 76,
    paddingLeft: 28
  },
  avatar: {
    position: "absolute",
    top: 0,
    left: 28,
    width: 54,
    height: 54,
    borderRadius: 27
  },
  name: {
    position: "absolute",
    top: 3,
    left: 96,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "500",
    color: colors.black
  },
  info: {
    position: "absolute",
    top: 32,
    left: 96,
    width: 238,
    fontSize: 14,
    lineHeight: 18,
    color: "#5F5F5F"
  },
  date: {
    position: "absolute",
    top: 6,
    right: 28,
    fontSize: 14,
    lineHeight: 18,
    color: "#9D9D9D"
  },
  unreadDot: {
    position: "absolute",
    top: 32,
    right: 30,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#FC1111",
    alignItems: "center",
    justifyContent: "center"
  },
  unreadText: {
    color: colors.surface,
    fontSize: 11,
    lineHeight: 13
  },
  detailRows: {
    position: "absolute",
    top: 113,
    left: 14,
    width: 361
  },
  detailRow: {
    position: "relative",
    flexDirection: "row",
    width: 361,
    height: 136,
    marginBottom: 16
  },
  detailOpenArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    zIndex: 1
  },
  detailAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginTop: 2,
    marginRight: 10
  },
  detailTextBlock: {
    width: 250,
    paddingRight: 8
  },
  detailNameText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "400",
    color: colors.black
  },
  action: {
    fontSize: 13,
    lineHeight: 16,
    color: "#9D9D9D"
  },
  bodyText: {
    marginTop: 7,
    width: 238,
    fontSize: 16,
    lineHeight: 19,
    color: colors.black
  },
  quoteRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  quoteLine: {
    width: 1,
    height: 10,
    backgroundColor: "#9D9D9D"
  },
  quote: {
    width: 215,
    fontSize: 12,
    lineHeight: 14,
    color: "#9D9D9D"
  },
  miniActions: {
    position: "absolute",
    top: 104,
    left: 51,
    flexDirection: "row",
    gap: 34,
    zIndex: 2
  },
  miniActionButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  inlineReply: {
    position: "absolute",
    top: 94,
    left: 51,
    width: 270,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    paddingLeft: 13,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 3
  },
  inlineReplyInput: {
    flex: 1,
    height: 36,
    color: colors.black,
    fontSize: 13
  },
  bottomReplyComposer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F0F0",
    paddingLeft: 18,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10
  },
  bottomReplyInput: {
    flex: 1,
    height: 48,
    color: colors.black,
    fontSize: 15
  },
  inlineReplyButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CFCFCF"
  },
  inlineReplyButtonActive: {
    backgroundColor: colors.black
  },
  inlineReplySend: {
    color: colors.surface,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600"
  },
  replyPreview: {
    position: "absolute",
    top: 100,
    left: 51,
    width: 270,
    height: 18,
    zIndex: 2
  },
  myReply: {
    width: 270,
    color: "#5F5F5F",
    fontSize: 12,
    lineHeight: 16
  },
  thumb: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 42,
    height: 42,
    borderRadius: 5,
    backgroundColor: "#D9D9D9"
  },
  dm: {
    flex: 1,
    backgroundColor: colors.surface
  },
  dmHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 402,
    height: 112,
    backgroundColor: colors.surface
  },
  searchField: {
    position: "absolute",
    top: 56,
    left: 22,
    width: 358,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: "#F3F3F3",
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  detailSearchField: {
    position: "absolute",
    top: 56,
    left: 58,
    width: 286,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: "#F3F3F3",
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  searchInput: {
    flex: 1,
    height: 38,
    color: colors.black,
    fontSize: 14
  },
  cancelText: {
    color: "#777777",
    fontSize: 13,
    lineHeight: 16
  },
  dmAvatar: {
    position: "absolute",
    top: 126,
    left: 32,
    width: 54,
    height: 54,
    borderRadius: 27
  },
  dmName: {
    position: "absolute",
    top: 122,
    left: 102,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "400",
    color: colors.black
  },
  dmSubtitle: {
    position: "absolute",
    top: 154,
    left: 102,
    width: 245,
    fontSize: 14,
    lineHeight: 18,
    color: "#9D9D9D"
  },
  bubble: {
    position: "absolute",
    maxWidth: 272,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    fontSize: 16,
    lineHeight: 21,
    overflow: "hidden"
  },
  incomingBubble: {
    top: 226,
    left: 32,
    backgroundColor: "#F0F0F0",
    color: colors.black
  },
  sharedPostCard: { position: "absolute", left: 32, right: 32, minHeight: 96, padding: 13, borderRadius: 16, backgroundColor: colors.black, shadowColor: colors.black, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  sharedPostHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sharedPostLabel: { color: "rgba(255,255,255,0.66)", fontSize: 9, letterSpacing: 1.1 },
  sharedPostTime: { color: "rgba(255,255,255,0.55)", fontSize: 10 },
  sharedPostTitle: { marginTop: 7, color: colors.white, fontSize: 16, fontWeight: "600" },
  sharedPostExcerpt: { marginTop: 3, color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 16 },
  sharedPostOpen: { marginTop: 6, color: colors.white, fontSize: 11 },
  outgoingBubble: {
    top: 318,
    right: 24,
    backgroundColor: colors.black,
    color: colors.surface
  },
  sentBubble: {
    backgroundColor: colors.black,
    color: colors.surface
  },
  sentBubbleWrap: {
    position: "absolute",
    right: 24,
    maxWidth: 272
  },
  recalledBubble: {
    backgroundColor: "#EFEFEF",
    color: "#777777"
  },
  messageMenu: {
    position: "absolute",
    top: 340,
    right: 24,
    width: 132,
    borderRadius: 10,
    backgroundColor: colors.black,
    overflow: "hidden"
  },
  messageMenuItem: {
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  messageMenuText: {
    color: colors.surface,
    fontSize: 14,
    lineHeight: 18
  },
  messageMenuDivider: {
    height: 1,
    backgroundColor: "#333333"
  },
  searchResultText: {
    position: "absolute",
    top: 190,
    left: 32,
    color: "#777777",
    fontSize: 13,
    lineHeight: 18
  },
  dmRule: {
    position: "absolute",
    top: 405,
    left: 32,
    width: 338,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#F6F7F7",
    color: "#5F5F5F",
    fontSize: 13,
    lineHeight: 18,
    overflow: "hidden"
  },
  followBack: {
    position: "absolute",
    top: 486,
    left: 132,
    width: 138,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black
  },
  followBackText: {
    color: colors.surface,
    fontSize: 15,
    lineHeight: 18
  },
  composer: {
    position: "absolute",
    left: 16,
    bottom: 22,
    width: 370,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F0F0",
    paddingLeft: 18,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  composerInput: {
    flex: 1,
    height: 48,
    color: colors.black,
    fontSize: 15
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#CFCFCF"
  },
  sendButtonActive: {
    backgroundColor: colors.black
  },
  sendText: {
    color: colors.surface,
    fontSize: 16,
    lineHeight: 18
  }
});
