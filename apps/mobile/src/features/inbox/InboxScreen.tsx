import { useState, type ReactNode } from "react";
import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  ActivityIcon,
  AppScreen,
  Avatar,
  BackIcon,
  BottomNavigation,
  CommentIcon,
  LineSpaceLogoIcon,
  LikeIcon,
  MoreIcon,
  SearchIcon
} from "@linespace/ui";
import { colors, spacing, typography } from "@linespace/tokens";
import type {
  InboxActivityKind,
  InboxActivityPreview,
  InboxActivitySummary,
  InboxConversationMessage,
  InboxGroup,
  InboxGroupMember,
  UserProfile
} from "@linespace/api-client";
import { mainTabs, tabRoutes, type MainTab } from "@/navigation/tabs";
import { currentUserId, lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";

type InboxView =
  | { kind: "home" }
  | { kind: "activity"; activity: InboxActivityKind }
  | { kind: "direct"; contact: UserProfile }
  | { kind: "group"; groupId: string };

const activityLabels: Record<InboxActivityKind, string> = {
  comments: "Comments",
  likes: "Likes",
  thread: "Thread"
};

const fallbackContacts: Array<UserProfile & { preview: string; date: string; unread?: number }> = [
  {
    id: "user-ray",
    handle: "ray",
    displayName: "Ray",
    avatarColor: "#8C7DE4",
    preview: "The summer thread is ready whenever you are.",
    date: "Mon"
  },
  {
    id: "user-jinghe",
    handle: "jinghe",
    displayName: "Jinghe",
    avatarColor: "#7AA0DD",
    preview: "Can I quote the moon image in my reply?",
    date: "Yesterday",
    unread: 2
  },
  {
    id: "user-zhihan",
    handle: "zhihan",
    displayName: "Zhihan",
    avatarColor: "#0B75DE",
    preview: "Your draft feels warmer after the second stanza.",
    date: "12:10"
  },
  {
    id: "user-roma",
    handle: "roma",
    displayName: "Roma",
    avatarColor: "#F63D49",
    preview: "I found your poem through the relay page.",
    date: "03/09"
  }
];

const fallbackActivity: Record<InboxActivityKind, InboxActivityPreview[]> = {
  comments: [
    {
      id: "activity-comment-1",
      kind: "comments",
      actor: {
        id: "user-ray",
        handle: "ray",
        displayName: "Ray",
        avatarColor: "#8C7DE4"
      },
      target: {
        kind: "post",
        title: "summer folded into rain",
        excerpt: "I kept the window open for the weather to answer.",
        poemId: "poem-summer"
      },
      dateLabel: "Today"
    },
    {
      id: "activity-comment-2",
      kind: "comments",
      actor: {
        id: "user-jinghe",
        handle: "jinghe",
        displayName: "Jinghe",
        avatarColor: "#7AA0DD"
      },
      target: {
        kind: "comment",
        title: "A softer ending",
        excerpt: "This image stays with me.",
        commentId: "comment-1",
        poemId: "poem-summer"
      },
      dateLabel: "Yesterday"
    }
  ],
  likes: [
    {
      id: "activity-like-1",
      kind: "likes",
      actor: {
        id: "user-lili",
        handle: "lili",
        displayName: "Lili",
        avatarColor: "#5A0000"
      },
      target: {
        kind: "post",
        title: "summer folded into rain",
        excerpt: "liked your post",
        poemId: "poem-summer"
      },
      dateLabel: "14:28"
    }
  ],
  thread: [
    {
      id: "activity-thread-1",
      kind: "thread",
      actor: {
        id: "user-ray",
        handle: "ray",
        displayName: "Ray",
        avatarColor: "#8C7DE4"
      },
      target: {
        kind: "thread",
        title: "The summer thread",
        excerpt: "Ray added a new line to your shared thread.",
        threadId: "thread-summer"
      },
      dateLabel: "Mon"
    }
  ]
};

export function InboxScreen() {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? "";
  const [view, setView] = useState<InboxView>({ kind: "home" });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [settingsGroupId, setSettingsGroupId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["user-profile", currentUserId],
    queryFn: () => lineSpaceApi.getUserProfile(currentUserId),
    enabled: currentUserId.length > 0
  });
  const summaryQuery = useQuery({
    queryKey: ["inbox-summary", currentUserId],
    queryFn: () => lineSpaceApi.getInboxActivitySummary(currentUserId),
    enabled: currentUserId.length > 0
  });
  const groupsQuery = useQuery({
    queryKey: ["inbox-groups", currentUserId],
    queryFn: () => lineSpaceApi.listInboxGroups(currentUserId),
    enabled: currentUserId.length > 0
  });
  const invitesQuery = useQuery({
    queryKey: ["inbox-group-invites", currentUserId],
    queryFn: () => lineSpaceApi.listInboxGroupInvites(currentUserId),
    enabled: currentUserId.length > 0
  });

  const respondInvite = useMutation({
    mutationFn: ({ groupId, accept }: { groupId: string; accept: boolean }) =>
      lineSpaceApi.respondInboxGroupInvite({ groupId, userId: currentUserId, accept }),
    onSuccess: (_group, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["inbox-group-invites", currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-groups", currentUserId] });
      if (variables.accept) setView({ kind: "group", groupId: variables.groupId });
    }
  });

  const groups = groupsQuery.data ?? [];
  const invites = invitesQuery.data ?? [];
  const page = view.kind === "activity" ? view.activity : null;
  const currentProfile = profileQuery.data;

  const navigateTab = (value: MainTab) => {
    if (value === "inbox") return;
    router.push(tabRoutes[value] as Href);
  };

  return (
    <AppScreen
      scroll={false}
      padded={false}
      style={styles.safeArea}
      contentContainerStyle={styles.screen}
    >
      {view.kind === "home" ? (
        <HomePage
          profile={currentProfile ?? undefined}
          summary={summaryQuery.data}
          groups={groups}
          invites={invites}
          onOpenActivity={(activity) => setView({ kind: "activity", activity })}
          onOpenDirect={(contact) => setView({ kind: "direct", contact })}
          onOpenGroup={(groupId) => setView({ kind: "group", groupId })}
          onCreateGroup={() => setShowCreateGroup(true)}
          onRespondInvite={(groupId, accept) => respondInvite.mutate({ groupId, accept })}
        />
      ) : view.kind === "activity" ? (
        <ActivityPage
          activity={view.activity}
          summary={summaryQuery.data}
          onBack={() => setView({ kind: "home" })}
          onOpenDirect={(contact) => setView({ kind: "direct", contact })}
        />
      ) : view.kind === "direct" ? (
        <DirectChatPage
          contact={view.contact}
          onBack={() => setView({ kind: "home" })}
        />
      ) : (
        <GroupChatPage
          groupId={view.groupId}
          onBack={() => setView({ kind: "home" })}
          onOpenSettings={() => setSettingsGroupId(view.groupId)}
        />
      )}

      {view.kind === "home" ? (
        <BottomNavigation
          items={mainTabs}
          profileAvatar={
            currentProfile
              ? {
                  color: currentProfile.avatarColor,
                  imageSource: currentProfile.avatarUrl ? { uri: currentProfile.avatarUrl } : undefined,
                  label: currentProfile.displayName
                }
              : undefined
          }
          value="inbox"
          onChange={navigateTab}
        />
      ) : null}

      <CreateGroupSheet
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(group) => {
          setShowCreateGroup(false);
          void queryClient.invalidateQueries({ queryKey: ["inbox-groups", currentUserId] });
          void queryClient.invalidateQueries({ queryKey: ["inbox-group-invites", currentUserId] });
          setView({ kind: "group", groupId: group.id });
        }}
      />

      {settingsGroupId ? (
        <GroupSettingsSheet
          groupId={settingsGroupId}
          visible
          onClose={() => setSettingsGroupId(null)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ["inbox-groups", currentUserId] });
            void queryClient.invalidateQueries({ queryKey: ["inbox-group", settingsGroupId] });
          }}
        />
      ) : null}
    </AppScreen>
  );
}

function InboxHeader({
  onBack,
  title,
  right
}: {
  onBack?: () => void;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityLabel="Back to inbox" hitSlop={12} onPress={onBack} style={styles.headerSide}>
          <BackIcon color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}
      {title ? (
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      ) : (
        <LineSpaceLogoIcon color={colors.black} width={54} height={31} />
      )}
      <View style={[styles.headerSide, styles.headerRight]}>{right ?? <SearchIcon color={colors.ink} />}</View>
    </View>
  );
}

function HomePage({
  profile,
  summary,
  groups,
  invites,
  onOpenActivity,
  onOpenDirect,
  onOpenGroup,
  onCreateGroup,
  onRespondInvite
}: {
  profile?: UserProfile;
  summary?: InboxActivitySummary;
  groups: InboxGroup[];
  invites: InboxGroup[];
  onOpenActivity: (kind: InboxActivityKind) => void;
  onOpenDirect: (contact: UserProfile) => void;
  onOpenGroup: (groupId: string) => void;
  onCreateGroup: () => void;
  onRespondInvite: (groupId: string, accept: boolean) => void;
}) {
  const contacts = fallbackContacts.filter((contact) => contact.id !== currentUserId);
  const pending = invites[0];

  return (
    <View style={styles.page}>
      <InboxHeader
        right={
          <Pressable accessibilityLabel="Create group" hitSlop={10} onPress={onCreateGroup} style={styles.plusButton}>
            <Text style={styles.plusText}>＋</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeContent}>
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.eyebrow}>INBOX</Text>
            <Text style={styles.pageTitle}>Keep the lines going.</Text>
          </View>
          <View style={styles.profileHalo}>
            {profile ? (
              <Avatar
                color={profile.avatarColor}
                imageSource={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
                label={profile.displayName}
                size={46}
              />
            ) : (
              <ActivityIndicator color={colors.ink} />
            )}
          </View>
        </View>

        <View style={styles.activityRail}>
          <ActivityShortcut
            icon={<CommentIcon color={colors.ink} />}
            label="Comments"
            count={summary?.unread.comments ?? 0}
            onPress={() => onOpenActivity("comments")}
          />
          <ActivityShortcut
            icon={<LikeIcon color={colors.ink} />}
            label="Likes"
            count={summary?.unread.likes ?? 0}
            onPress={() => onOpenActivity("likes")}
          />
          <ActivityShortcut
            icon={<ActivityIcon color={colors.ink} />}
            label="Thread"
            count={summary?.unread.thread ?? 0}
            onPress={() => onOpenActivity("thread")}
          />
        </View>

        {pending ? (
          <PermissionCard
            group={pending}
            onAccept={() => onRespondInvite(pending.id, true)}
            onDecline={() => onRespondInvite(pending.id, false)}
          />
        ) : null}

        <SectionHeader title="Conversations" action="New group" onAction={onCreateGroup} />
        {groups.map((group) => (
          <ConversationRow
            key={group.id}
            group={group}
            onPress={() => onOpenGroup(group.id)}
          />
        ))}
        {contacts.map((contact) => (
          <ConversationRow key={contact.id} contact={contact} onPress={() => onOpenDirect(contact)} />
        ))}
      </ScrollView>
    </View>
  );
}

function ActivityShortcut({
  icon,
  label,
  count,
  onPress
}: {
  icon: ReactNode;
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.activityShortcut, pressed && styles.pressed]}>
      <View style={styles.activityIcon}>{icon}</View>
      <Text style={styles.activityLabel}>{label}</Text>
      {count > 0 ? <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View> : null}
    </Pressable>
  );
}

function SectionHeader({
  title,
  action,
  onAction
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ConversationRow({
  contact,
  group,
  onPress
}: {
  contact?: UserProfile & { preview: string; date: string; unread?: number };
  group?: InboxGroup;
  onPress: () => void;
}) {
  const latest = group?.lastMessage;
  const label = group?.name ?? contact?.displayName ?? "";
  const preview = group
    ? latest?.text ?? `${group.members.filter((member) => member.status === "active").length} members`
    : contact?.preview ?? "";
  const date = group ? formatMessageTime(latest?.createdAt ?? group.updatedAt) : contact?.date ?? "";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}>
      {group ? <GroupAvatar size={56} /> : contact ? <ProfileAvatar profile={contact} size={56} /> : null}
      <View style={styles.conversationCopy}>
        <View style={styles.conversationTopline}>
          <Text numberOfLines={1} style={styles.conversationName}>{label}</Text>
          <Text style={styles.conversationDate}>{date}</Text>
        </View>
        <Text numberOfLines={1} style={styles.conversationPreview}>{preview}</Text>
      </View>
      {(group?.unreadCount ?? contact?.unread ?? 0) > 0 ? (
        <View style={styles.rowBadge}><Text style={styles.rowBadgeText}>{group?.unreadCount ?? contact?.unread}</Text></View>
      ) : null}
    </Pressable>
  );
}

function ProfileAvatar({ profile, size = 40 }: { profile: UserProfile; size?: number }) {
  return (
    <Avatar
      color={profile.avatarColor}
      imageSource={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
      label={profile.displayName}
      size={size}
    />
  );
}

function GroupAvatar({ size = 56 }: { size?: number }) {
  return (
    <View style={[styles.groupAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.groupAvatarText}>Group</Text>
    </View>
  );
}

function PermissionCard({
  group,
  onAccept,
  onDecline
}: {
  group: InboxGroup;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const invitation = group.members.find((member) => member.user.id === currentUserId);
  const inviter = invitation?.invitedBy;
  return (
    <View style={styles.permissionCard}>
      <View style={styles.permissionHeader}>
        <GroupAvatar size={48} />
        <View style={styles.permissionCopy}>
          <Text style={styles.permissionTitle}>Group invitation</Text>
          <Text style={styles.permissionSubtitle}>
            {inviter?.displayName ?? "A mutual connection"} invited you to <Text style={styles.permissionStrong}>{group.name}</Text>
          </Text>
        </View>
      </View>
      <Text style={styles.permissionBody}>Accept to join the conversation. You can leave or mute it anytime.</Text>
      <View style={styles.permissionActions}>
        <Pressable onPress={onDecline} style={styles.declineButton}><Text style={styles.declineText}>Not now</Text></Pressable>
        <Pressable onPress={onAccept} style={styles.acceptButton}><Text style={styles.acceptText}>Join group</Text></Pressable>
      </View>
    </View>
  );
}

function ActivityPage({
  activity,
  summary,
  onBack,
  onOpenDirect
}: {
  activity: InboxActivityKind;
  summary?: InboxActivitySummary;
  onBack: () => void;
  onOpenDirect: (contact: UserProfile) => void;
}) {
  const rows = summary?.recent[activity] ?? fallbackActivity[activity];
  return (
    <View style={styles.page}>
      <InboxHeader title={activityLabels[activity]} onBack={onBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <Text style={styles.detailIntro}>A quiet place for the responses that keep your work moving.</Text>
        {rows.map((row) => (
          <Pressable
            key={row.id}
            style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
            onPress={() => {
              if (row.actor.id !== currentUserId) onOpenDirect(row.actor);
              else if (row.target.poemId) router.push({ pathname: "/poem/[id]", params: { id: row.target.poemId } });
            }}
          >
            <ProfileAvatar profile={row.actor} size={46} />
            <View style={styles.activityRowCopy}>
              <Text style={styles.activityRowTitle}>{row.actor.displayName} <Text style={styles.activityRowMuted}>{activity === "likes" ? "liked your post" : activity === "thread" ? "continued your thread" : "commented on your post"}</Text></Text>
              <Text numberOfLines={2} style={styles.activityRowBody}>{row.target.excerpt}</Text>
            </View>
            <Text style={styles.activityRowDate}>{row.dateLabel}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function DirectChatPage({ contact, onBack }: { contact: UserProfile; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const messagesQuery = useQuery({
    queryKey: ["inbox-messages", currentUserId, contact.id],
    queryFn: () => lineSpaceApi.listInboxMessages(currentUserId, contact.id)
  });
  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      lineSpaceApi.sendInboxMessage({ senderId: currentUserId, recipientId: contact.id, text }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["inbox-messages", currentUserId, contact.id] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-summary", currentUserId] });
    }
  });

  const messages = messagesQuery.data ?? [];
  return (
    <View style={styles.chatPage}>
      <InboxHeader
        title={contact.displayName}
        onBack={onBack}
        right={
          <Pressable onPress={() => openProfile(contact.id)} hitSlop={10}>
            <ProfileAvatar profile={contact} size={32} />
          </Pressable>
        }
      />
      <Pressable onPress={() => openProfile(contact.id)} style={styles.chatIdentity}>
        <ProfileAvatar profile={contact} size={54} />
        <View style={styles.chatIdentityCopy}>
          <Text style={styles.chatIdentityName}>{contact.displayName}</Text>
          <Text style={styles.chatIdentityHandle}>@{contact.handle}</Text>
        </View>
        <Text style={styles.viewProfile}>View profile</Text>
      </Pressable>
      <ScrollView
        style={styles.messageScroll}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <Text style={styles.emptyMessage}>Start a thoughtful conversation.</Text>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} own={message.sender.id === currentUserId} />
          ))
        )}
      </ScrollView>
      <ChatComposer
        draft={draft}
        onChange={setDraft}
        onSend={() => {
          if (!draft.trim() || sendMutation.isPending) return;
          sendMutation.mutate(draft);
        }}
        pending={sendMutation.isPending}
      />
    </View>
  );
}

function GroupChatPage({
  groupId,
  onBack,
  onOpenSettings
}: {
  groupId: string;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const groupQuery = useQuery({
    queryKey: ["inbox-group", groupId, currentUserId],
    queryFn: () => lineSpaceApi.getInboxGroup(groupId, currentUserId)
  });
  const messagesQuery = useQuery({
    queryKey: ["inbox-group-messages", groupId, currentUserId],
    queryFn: () => lineSpaceApi.listInboxGroupMessages(groupId, currentUserId),
    enabled: Boolean(groupQuery.data)
  });
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const sendMutation = useMutation({
    mutationFn: (text: string) => lineSpaceApi.sendInboxMessage({ senderId: currentUserId, groupId, text }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["inbox-group-messages", groupId, currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-group", groupId, currentUserId] });
      void queryClient.invalidateQueries({ queryKey: ["inbox-groups", currentUserId] });
    }
  });
  const group = groupQuery.data;
  if (!group) {
    return (
      <View style={styles.chatPage}>
        <InboxHeader onBack={onBack} title="Group" />
        <View style={styles.loadingWrap}><ActivityIndicator color={colors.ink} /></View>
      </View>
    );
  }

  return (
    <View style={styles.chatPage}>
      <InboxHeader
        title={group.name}
        onBack={onBack}
        right={
          <Pressable accessibilityLabel="Group settings" onPress={onOpenSettings} hitSlop={10}>
            <MoreIcon color={colors.ink} />
          </Pressable>
        }
      />
      <Pressable onPress={onOpenSettings} style={styles.groupIdentity}>
        <GroupAvatar size={54} />
        <View style={styles.chatIdentityCopy}>
          <Text style={styles.chatIdentityName}>{group.name}</Text>
          <Text style={styles.chatIdentityHandle}>{group.members.filter((member) => member.status === "active").length} members</Text>
        </View>
        <Text style={styles.viewProfile}>Manage</Text>
      </Pressable>
      <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent} showsVerticalScrollIndicator={false}>
        {(messagesQuery.data ?? []).map((message) => (
            <GroupMessageItem key={message.id} message={message} own={message.sender.id === currentUserId} />
        ))}
      </ScrollView>
      <ChatComposer
        draft={draft}
        onChange={setDraft}
        onSend={() => {
          if (!draft.trim() || sendMutation.isPending) return;
          sendMutation.mutate(draft);
        }}
        pending={sendMutation.isPending}
      />
    </View>
  );
}

function MessageItem({ message, own }: { message: InboxConversationMessage; own: boolean }) {
  const sharedThread = message.sharedThread;
  const openSharedThread = () => {
    if (!sharedThread) return;
    router.push(
      sharedThread.continuationId
        ? ({
            pathname: "/thread/continue/[id]",
            params: { id: sharedThread.continuationId }
          } as unknown as Href)
        : ({
            pathname: "/thread/[id]",
            params: { id: sharedThread.threadId }
          } as unknown as Href)
    );
  };
  return (
    <View style={[styles.messageBlock, own ? styles.messageBlockOwn : styles.messageBlockIncoming]}>
      <View style={[styles.messageBubble, own ? styles.messageBubbleOwn : styles.messageBubbleIncoming]}>
        {sharedThread ? (
          <Pressable accessibilityRole="link" onPress={openSharedThread}>
            <Text style={[styles.sharedLabel, own && styles.sharedLabelOwn]}>
              {sharedThread.continuationId
                ? `Shared continuation · line ${sharedThread.lineNumber ?? "—"}`
                : "Shared thread"}
            </Text>
            <Text style={[styles.messageText, own && styles.messageTextOwn]}>
              {sharedThread.title}
            </Text>
            <Text style={[styles.sharedExcerpt, own && styles.sharedExcerptOwn]}>
              {sharedThread.excerpt}
            </Text>
            <Text style={[styles.sharedOpenHint, own && styles.sharedExcerptOwn]}>
              Open thread →
            </Text>
          </Pressable>
        ) : message.sharedPost ? (
          <View>
            <Text style={[styles.sharedLabel, own && styles.sharedLabelOwn]}>Shared post</Text>
            <Text style={[styles.messageText, own && styles.messageTextOwn]}>{message.sharedPost.title}</Text>
            <Text style={[styles.sharedExcerpt, own && styles.sharedExcerptOwn]}>{message.sharedPost.excerpt}</Text>
          </View>
        ) : (
          <Text style={[styles.messageText, own && styles.messageTextOwn]}>{message.text}</Text>
        )}
      </View>
      <Text style={[styles.messageTime, own && styles.messageTimeOwn]}>{formatMessageTime(message.createdAt)}</Text>
    </View>
  );
}

function GroupMessageItem({
  message,
  own
}: {
  message: InboxConversationMessage;
  own: boolean;
}) {
  return (
    <View style={[styles.groupMessageLine, own && styles.groupMessageLineOwn]}>
      {!own ? (
        <Pressable onPress={() => openProfile(message.sender.id)} style={styles.groupMessageAvatar}>
          <ProfileAvatar profile={message.sender} size={34} />
        </Pressable>
      ) : null}
      <View style={[styles.messageBlock, own ? styles.messageBlockOwn : styles.messageBlockIncoming, styles.groupMessageBlock]}>
        {!own ? <Text style={styles.senderName}>{message.sender.displayName}</Text> : null}
        <View style={[styles.messageBubble, own ? styles.messageBubbleOwn : styles.messageBubbleIncoming]}>
          <Text style={[styles.messageText, own && styles.messageTextOwn]}>{message.text}</Text>
        </View>
        <Text style={[styles.messageTime, own && styles.messageTimeOwn]}>{formatMessageTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

function ChatComposer({
  draft,
  onChange,
  onSend,
  pending
}: {
  draft: string;
  onChange: (text: string) => void;
  onSend: () => void;
  pending: boolean;
}) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={12}>
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={onChange}
          onSubmitEditing={onSend}
          placeholder="Write a message..."
          placeholderTextColor={colors.profileMuted}
          multiline
          maxLength={2000}
          style={styles.composerInput}
        />
        <Pressable
          accessibilityLabel="Send message"
          disabled={!draft.trim() || pending}
          onPress={onSend}
          style={[styles.sendButton, (!draft.trim() || pending) && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function CreateGroupSheet({
  visible,
  onClose,
  onCreated
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: InboxGroup) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const friendsQuery = useQuery({
    queryKey: ["inbox-mutuals", currentUserId],
    queryFn: () => lineSpaceApi.searchUsers("", currentUserId)
  });
  const createMutation = useMutation({
    mutationFn: () => lineSpaceApi.createInboxGroup({ ownerId: currentUserId, name, inviteeIds: selected }),
    onSuccess: onCreated
  });
  const friends = (friendsQuery.data?.friends ?? []).filter((friend) => friend.id !== currentUserId);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>NEW CONVERSATION</Text>
              <Text style={styles.sheetTitle}>Create a group</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={colors.profileMuted}
            maxLength={80}
            style={styles.nameInput}
          />
          <Text style={styles.pickerLabel}>Invite mutual connections</Text>
          <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false}>
            {friends.map((friend) => {
              const active = selected.includes(friend.id);
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => setSelected((ids) => active ? ids.filter((id) => id !== friend.id) : [...ids, friend.id])}
                  style={[styles.friendRow, active && styles.friendRowActive]}
                >
                  <ProfileAvatar profile={friend} size={42} />
                  <View style={styles.friendCopy}><Text style={styles.friendName}>{friend.displayName}</Text><Text style={styles.friendHandle}>@{friend.handle} · mutual</Text></View>
                  <View style={[styles.checkCircle, active && styles.checkCircleActive]}>{active ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                </Pressable>
              );
            })}
            {!friendsQuery.isLoading && friends.length === 0 ? <Text style={styles.emptyPicker}>Only mutual connections can be invited.</Text> : null}
          </ScrollView>
          {createMutation.isError ? <Text style={styles.errorText}>{createMutation.error instanceof Error ? createMutation.error.message : "Unable to create group."}</Text> : null}
          <Pressable disabled={!name.trim() || selected.length === 0 || createMutation.isPending} onPress={() => createMutation.mutate()} style={[styles.primaryButton, (!name.trim() || selected.length === 0) && styles.primaryButtonDisabled]}>
            {createMutation.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Create group</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function GroupSettingsSheet({
  groupId,
  visible,
  onClose,
  onChanged
}: {
  groupId: string;
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const groupQuery = useQuery({
    queryKey: ["inbox-group", groupId, currentUserId],
    queryFn: () => lineSpaceApi.getInboxGroup(groupId, currentUserId)
  });
  const friendsQuery = useQuery({
    queryKey: ["inbox-mutuals", currentUserId],
    queryFn: () => lineSpaceApi.searchUsers("", currentUserId)
  });
  const group = groupQuery.data;
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const owner = group?.ownerId === currentUserId;
  const updateMutation = useMutation({
    mutationFn: () => lineSpaceApi.updateInboxGroup({ groupId, userId: currentUserId, name }),
    onSuccess: () => { onChanged(); }
  });
  const inviteMutation = useMutation({
    mutationFn: () => lineSpaceApi.inviteInboxGroupMembers({ groupId, inviterId: currentUserId, inviteeIds: selected }),
    onSuccess: () => { setSelected([]); onChanged(); }
  });

  if (!group) return null;
  const existing = new Set(group.members.map((member) => member.user.id));
  const friends = (friendsQuery.data?.friends ?? []).filter((friend) => friend.id !== currentUserId && !existing.has(friend.id));
  const activeMembers = group.members.filter((member) => member.status === "active");
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetEyebrow}>GROUP SETTINGS</Text><Text style={styles.sheetTitle}>Manage group</Text></View>
            <Pressable onPress={onClose} hitSlop={10}><Text style={styles.closeText}>Close</Text></Pressable>
          </View>
          {owner ? (
            <View style={styles.renameRow}>
              <TextInput value={name || group.name} onChangeText={setName} maxLength={80} style={styles.renameInput} />
              <Pressable onPress={() => updateMutation.mutate()} disabled={!name.trim() || name.trim() === group.name} style={styles.saveNameButton}><Text style={styles.saveNameText}>Save</Text></Pressable>
            </View>
          ) : <Text style={styles.memberNote}>Only the group owner can change the name.</Text>}
          <Text style={styles.pickerLabel}>Members · {activeMembers.length}</Text>
          <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
            {group.members.map((member) => <MemberRow key={member.user.id} member={member} />)}
          </ScrollView>
          {owner || activeMembers.some((member) => member.user.id === currentUserId) ? (
            <>
              <Text style={styles.pickerLabel}>Invite more mutuals</Text>
              <ScrollView style={styles.friendListSmall} showsVerticalScrollIndicator={false}>
                {friends.map((friend) => {
                  const active = selected.includes(friend.id);
                  return <Pressable key={friend.id} onPress={() => setSelected((ids) => active ? ids.filter((id) => id !== friend.id) : [...ids, friend.id])} style={styles.friendRow}>
                    <ProfileAvatar profile={friend} size={36} />
                    <View style={styles.friendCopy}><Text style={styles.friendName}>{friend.displayName}</Text><Text style={styles.friendHandle}>@{friend.handle} · mutual</Text></View>
                    <View style={[styles.checkCircle, active && styles.checkCircleActive]}>{active ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                  </Pressable>;
                })}
                {friends.length === 0 ? <Text style={styles.emptyPicker}>Everyone you mutually follow is already here.</Text> : null}
              </ScrollView>
              <Pressable disabled={!selected.length || inviteMutation.isPending} onPress={() => inviteMutation.mutate()} style={[styles.primaryButton, !selected.length && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>{inviteMutation.isPending ? "Inviting..." : "Send invitations"}</Text></Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function MemberRow({ member }: { member: InboxGroupMember }) {
  return (
    <Pressable onPress={() => openProfile(member.user.id)} style={styles.memberRow}>
      <ProfileAvatar profile={member.user} size={38} />
      <View style={styles.friendCopy}><Text style={styles.friendName}>{member.user.displayName}</Text><Text style={styles.friendHandle}>@{member.user.handle}</Text></View>
      <Text style={[styles.memberStatus, member.status === "active" ? styles.memberStatusActive : styles.memberStatusInvited]}>{member.status === "active" ? (member.role === "owner" ? "Owner" : "Joined") : "Invited"}</Text>
    </Pressable>
  );
}

function openProfile(userId: string) {
  router.push({ pathname: "/profile/[id]", params: { id: userId } } as unknown as Href);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas },
  screen: { backgroundColor: colors.surface, flex: 1, paddingBottom: 0 },
  page: { flex: 1, backgroundColor: colors.surface },
  chatPage: { flex: 1, backgroundColor: colors.surface },
  header: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", height: 78, justifyContent: "space-between", paddingHorizontal: spacing.lg },
  headerSide: { alignItems: "center", justifyContent: "center", minWidth: 36 },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { ...typography.label, color: colors.ink, flex: 1, fontSize: 16, fontWeight: "700", textAlign: "center" },
  plusButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  plusText: { color: colors.white, fontSize: 24, fontWeight: "300", lineHeight: 28 },
  homeContent: { paddingBottom: 112, paddingHorizontal: spacing.lg },
  welcomeRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingBottom: 20, paddingTop: 26 },
  eyebrow: { ...typography.caption, color: colors.profileMuted, fontWeight: "700", letterSpacing: 1.6 },
  pageTitle: { ...typography.title, color: colors.ink, fontSize: 26, marginTop: 5 },
  profileHalo: { alignItems: "center", backgroundColor: colors.canvas, borderRadius: 28, height: 58, justifyContent: "center", width: 58 },
  activityRail: { backgroundColor: colors.canvas, borderRadius: 20, flexDirection: "row", justifyContent: "space-around", marginBottom: 26, paddingVertical: 12 },
  activityShortcut: { alignItems: "center", gap: 4, minWidth: 80, position: "relative" },
  activityIcon: { alignItems: "center", backgroundColor: colors.white, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  activityLabel: { ...typography.caption, color: colors.ink },
  countBadge: { backgroundColor: colors.accent, borderRadius: 9, minWidth: 18, paddingHorizontal: 5, position: "absolute", right: 10, top: -4 },
  countText: { color: colors.white, fontSize: 10, fontWeight: "700", textAlign: "center" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { ...typography.label, color: colors.ink, fontSize: 18, fontWeight: "700" },
  sectionAction: { ...typography.caption, color: colors.profileMuted },
  conversationRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 13, minHeight: 82, paddingVertical: 12 },
  conversationCopy: { flex: 1, minWidth: 0 },
  conversationTopline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  conversationName: { ...typography.label, color: colors.ink, flex: 1, fontSize: 16, fontWeight: "700" },
  conversationDate: { ...typography.caption, color: colors.profileMuted, marginLeft: 8 },
  conversationPreview: { ...typography.body, color: colors.profileMuted, marginTop: 5 },
  rowBadge: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, paddingHorizontal: 5 },
  rowBadgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  groupAvatar: { alignItems: "center", backgroundColor: colors.ink, justifyContent: "center" },
  groupAvatarText: { color: colors.white, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  permissionCard: { backgroundColor: "#FBF4EF", borderColor: "#E7D7CC", borderRadius: 20, borderWidth: 1, marginBottom: 25, padding: 17 },
  permissionHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  permissionCopy: { flex: 1 },
  permissionTitle: { ...typography.label, color: colors.ink, fontSize: 16, fontWeight: "700" },
  permissionSubtitle: { ...typography.caption, color: colors.profileMuted, lineHeight: 18, marginTop: 3 },
  permissionStrong: { color: colors.ink, fontWeight: "700" },
  permissionBody: { ...typography.caption, color: colors.profileMuted, lineHeight: 18, marginTop: 14 },
  permissionActions: { flexDirection: "row", gap: 10, marginTop: 15 },
  declineButton: { alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 11 },
  declineText: { ...typography.caption, color: colors.ink, fontWeight: "600" },
  acceptButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 12, flex: 1, paddingVertical: 11 },
  acceptText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  detailContent: { paddingBottom: 112, paddingHorizontal: spacing.lg },
  detailIntro: { ...typography.body, color: colors.profileMuted, lineHeight: 21, paddingBottom: 22, paddingTop: 25 },
  activityRow: { alignItems: "flex-start", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 12, paddingVertical: 17 },
  activityRowCopy: { flex: 1, minWidth: 0 },
  activityRowTitle: { ...typography.body, color: colors.ink, lineHeight: 20 },
  activityRowMuted: { color: colors.profileMuted },
  activityRowBody: { ...typography.caption, color: colors.profileMuted, lineHeight: 18, marginTop: 5 },
  activityRowDate: { ...typography.caption, color: colors.profileMuted },
  chatIdentity: { alignItems: "center", backgroundColor: colors.canvas, borderRadius: 19, flexDirection: "row", margin: 15, padding: 13 },
  groupIdentity: { alignItems: "center", backgroundColor: colors.canvas, borderRadius: 19, flexDirection: "row", margin: 15, padding: 13 },
  chatIdentityCopy: { flex: 1, marginLeft: 11 },
  chatIdentityName: { ...typography.label, color: colors.ink, fontSize: 16, fontWeight: "700" },
  chatIdentityHandle: { ...typography.caption, color: colors.profileMuted, marginTop: 2 },
  viewProfile: { ...typography.caption, color: colors.profileMuted },
  messageScroll: { flex: 1 },
  messageContent: { gap: 14, paddingBottom: 18, paddingHorizontal: spacing.lg, paddingTop: 10 },
  emptyMessage: { ...typography.body, color: colors.profileMuted, paddingTop: 40, textAlign: "center" },
  messageBlock: { maxWidth: "82%" },
  messageBlockIncoming: { alignSelf: "flex-start" },
  messageBlockOwn: { alignSelf: "flex-end" },
  messageBubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  messageBubbleIncoming: { backgroundColor: "#F0F0F0", borderBottomLeftRadius: 6 },
  messageBubbleOwn: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  messageText: { ...typography.body, color: colors.ink, fontSize: 16, lineHeight: 24, flexShrink: 1 },
  messageTextOwn: { color: colors.white },
  messageTime: { ...typography.caption, color: colors.profileMuted, fontSize: 11, marginTop: 5 },
  messageTimeOwn: { textAlign: "right" },
  sharedLabel: { ...typography.caption, color: colors.profileMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginBottom: 7 },
  sharedLabelOwn: { color: "#B9B9B9" },
  sharedExcerpt: { ...typography.caption, color: colors.profileMuted, lineHeight: 18, marginTop: 4 },
  sharedOpenHint: { ...typography.caption, color: colors.accent, marginTop: 8, fontWeight: "600" },
  sharedExcerptOwn: { color: "#D1D1D1" },
  groupMessageLine: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  groupMessageLineOwn: { justifyContent: "flex-end" },
  groupMessageAvatar: { alignSelf: "flex-end" },
  groupMessageBlock: { maxWidth: "76%" },
  senderName: { ...typography.caption, color: colors.profileMuted, fontWeight: "700", marginBottom: 4, marginLeft: 3 },
  composer: { alignItems: "flex-end", backgroundColor: colors.white, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 11 },
  composerInput: { ...typography.body, backgroundColor: colors.canvas, borderRadius: 19, color: colors.ink, flex: 1, maxHeight: 100, minHeight: 42, paddingHorizontal: 15, paddingVertical: 10 },
  sendButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 21, height: 42, justifyContent: "center", width: 42 },
  sendButtonDisabled: { backgroundColor: "#D8D8D8" },
  sendButtonText: { color: colors.white, fontSize: 22, lineHeight: 24 },
  pressed: { opacity: 0.72 },
  loadingWrap: { alignItems: "center", flex: 1, justifyContent: "center" },
  sheetBackdrop: { backgroundColor: "rgba(0,0,0,0.32)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88%", padding: spacing.lg, paddingBottom: 24 },
  sheetHandle: { alignSelf: "center", backgroundColor: "#D8D8D8", borderRadius: 3, height: 5, marginBottom: 18, width: 42 },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  sheetEyebrow: { ...typography.caption, color: colors.profileMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  sheetTitle: { ...typography.title, color: colors.ink, fontSize: 24, marginTop: 4 },
  closeText: { ...typography.caption, color: colors.profileMuted, fontWeight: "600" },
  nameInput: { ...typography.body, backgroundColor: colors.canvas, borderRadius: 14, color: colors.ink, paddingHorizontal: 14, paddingVertical: 13 },
  pickerLabel: { ...typography.caption, color: colors.profileMuted, fontWeight: "700", marginBottom: 8, marginTop: 20 },
  friendList: { maxHeight: 250 },
  friendListSmall: { maxHeight: 145 },
  friendRow: { alignItems: "center", borderColor: "transparent", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginBottom: 4, padding: 8 },
  friendRowActive: { backgroundColor: colors.canvas, borderColor: colors.line },
  friendCopy: { flex: 1, minWidth: 0 },
  friendName: { ...typography.body, color: colors.ink, fontWeight: "600" },
  friendHandle: { ...typography.caption, color: colors.profileMuted, marginTop: 2 },
  checkCircle: { alignItems: "center", borderColor: "#C9C9C9", borderRadius: 12, borderWidth: 1, height: 24, justifyContent: "center", width: 24 },
  checkCircleActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: "700" },
  emptyPicker: { ...typography.caption, color: colors.profileMuted, paddingVertical: 14 },
  errorText: { ...typography.caption, color: colors.accent, marginTop: 8 },
  primaryButton: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 14, justifyContent: "center", marginTop: 17, minHeight: 48 },
  primaryButtonDisabled: { backgroundColor: "#D2D2D2" },
  primaryButtonText: { ...typography.label, color: colors.white, fontSize: 15, fontWeight: "700" },
  renameRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  renameInput: { ...typography.body, backgroundColor: colors.canvas, borderRadius: 12, color: colors.ink, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  saveNameButton: { backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  saveNameText: { ...typography.caption, color: colors.white, fontWeight: "700" },
  memberNote: { ...typography.caption, color: colors.profileMuted, lineHeight: 18 },
  memberList: { maxHeight: 180 },
  memberRow: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 7 },
  memberStatus: { ...typography.caption },
  memberStatusActive: { color: colors.ink },
  memberStatusInvited: { color: colors.profileMuted }
});
