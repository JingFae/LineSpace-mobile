export type FeedSection = "latest" | "popular" | "following";

export type AuthUser = {
  id: string;
  authUserId: string;
  username: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
  createdAt: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expiresIn: number;
  tokenType: string;
};

export type RegisterAuthInput = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginAuthInput = {
  username: string;
  password: string;
};

export type RefreshAuthInput = {
  refreshToken: string;
};

export type AuthRegistrationResult = {
  user: AuthUser;
  session: AuthSession | null;
  emailConfirmationRequired: boolean;
};

export type AuthSessionResult = {
  user: AuthUser;
  session: AuthSession;
};

export type FeedFilter = "all" | "most-contributed" | "growing" | "final";

export type PoemStatus = "growing" | "final" | "draft";

export type ComposeMode = "draft" | "relay";

export type DraftVisibility = "public" | "include" | "exclude";

export type PoemDraftStatus = "editing" | "ready" | "published";

export type PoemTypographyId = "literary-serif" | "handwritten" | "clean-sans";

export type PoemBackgroundId = "letter-paper" | "kraft-paper" | "postcard" | "midnight";

export type PoemTemplateId = "quiet-letter" | "night-whisper" | "travel-postcard";

export type PoemStickerId = "botanical" | "moon" | "postmark";

export type PoemLayoutConfig = {
  templateId: PoemTemplateId;
  typographyId: PoemTypographyId;
  backgroundId: PoemBackgroundId;
  stickerIds: PoemStickerId[];
};

export type PoemDesignOption<TId extends string, TRole extends string> = {
  id: TId;
  label: string;
  description: string;
  role: TRole;
  swatch: string;
};

export type PoemTemplateOption = PoemDesignOption<PoemTemplateId, "template"> & {
  layout: PoemLayoutConfig;
};

export type PoemDesignCatalog = {
  templates: PoemTemplateOption[];
  typography: Array<PoemDesignOption<PoemTypographyId, "serif" | "script" | "sans">>;
  backgrounds: Array<
    PoemDesignOption<PoemBackgroundId, "ruled" | "kraft" | "postcard" | "dark">
  >;
  stickers: Array<PoemDesignOption<PoemStickerId, "botanical" | "moon" | "postmark"> & {
    symbol: string;
  }>;
};

export type PoemDraftMedia = {
  uri: string;
  kind: "image" | "video";
  name: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export type PoemDraftSettings = {
  declareOriginal: boolean;
  isPublic: boolean;
  visibility: DraftVisibility;
  audienceUserIds: string[];
  allowComments: boolean;
  allowQuotes: boolean;
  allowSharing: boolean;
  allowSave: boolean;
};

export type DraftCollaborator = {
  user: UserProfile;
  role: "owner" | "editor";
  status: "invited" | "active";
  cursorLine?: number;
  lastSeenAt: string;
};

export type PoemDraft = {
  id: string;
  ownerId: string;
  mode: ComposeMode;
  status: PoemDraftStatus;
  title: string;
  body: string;
  byline: string;
  tags: string[];
  mentions: string[];
  media?: PoemDraftMedia;
  settings: PoemDraftSettings;
  layout: PoemLayoutConfig;
  collaborators: DraftCollaborator[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePoemDraftInput = {
  ownerId: string;
  mode: ComposeMode;
};

export type UpdatePoemDraftInput = {
  draftId: string;
  userId: string;
  title?: string;
  body?: string;
  byline?: string;
  tags?: string[];
  mentions?: string[];
  media?: PoemDraftMedia | null;
  settings?: Partial<PoemDraftSettings>;
  layout?: PoemLayoutConfig;
};

export type DraftOperationInput = {
  draftId: string;
  userId: string;
  title: string;
  body: string;
  baseVersion: number;
};

export type DraftInvitation = {
  id: string;
  draftId: string;
  inviterId: string;
  inviteeId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};

export type InviteDraftCollaboratorInput = {
  draftId: string;
  inviterId: string;
  inviteeId: string;
};

export type PublishPoemDraftInput = {
  draftId: string;
  userId: string;
};

export type PublishPoemDraftResult = {
  draft: PoemDraft;
  poem: PoemSummary;
};

export type PublishThreadDraftInput = {
  draftId: string;
  userId: string;
};

export type PublishThreadDraftResult = {
  draft: PoemDraft;
  thread: PoetryThread;
};

export type SavePoemDraftInput = {
  draftId: string;
  userId: string;
};

export type UserProfile = {
  id: string;
  handle: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string;
  bio?: string;
};

export type UserBadge = {
  id: string;
  label: string;
  symbol?: string;
  tone: "neutral" | "warm";
};

export type UserProfileStats = {
  followers: number;
  following: number;
  likesAndSaves: number;
};

export type UserProfileVisibility = {
  posts: boolean;
  threads: boolean;
  comments: boolean;
  saves: boolean;
};

export type UserContentCounts = {
  posts: number;
  threads: number;
  comments: number;
  saves: number;
};

export type UserProfileDetails = UserProfile & {
  linespaceId: string;
  level: number;
  badges: UserBadge[];
  stats: UserProfileStats;
  contentCounts: UserContentCounts;
  visibility: UserProfileVisibility;
};

export type UpdateUserProfileInput = {
  userId: string;
  displayName?: string;
  bio?: string;
  /** Durable object-storage URL in production; local cropped URI in mock mode. */
  avatarUrl?: string;
  avatarColor?: string;
  visibility?: Partial<UserProfileVisibility>;
};

export type UserProfileContentSection = "posts" | "threads" | "comments" | "saves";

export type UserProfileContentKind = "post" | "thread" | "comment";
export type UserThreadRelation = "started" | "participated";
export type UserCollectionKind = "liked" | "saved";

export type UserProfileContentQuery = {
  viewerId?: string;
  threadRelation?: UserThreadRelation;
  collection?: UserCollectionKind;
  contentKind?: UserProfileContentKind;
};

export type UserProfileContentItem = {
  id: string;
  kind: UserProfileContentKind;
  poemId?: string;
  threadId?: string;
  commentId?: string;
  title: string;
  excerpt: string;
  tags: string[];
  finishedAt: string;
  highlightCount?: number;
  artworkUrl?: string;
  muted?: boolean;
  threadRelation?: UserThreadRelation;
  collection?: UserCollectionKind;
  reference?: {
    kind: "post" | "comment";
    text: string;
  };
};

export type UserProfileContentPage = {
  userId: string;
  section: UserProfileContentSection;
  total: number;
  items: UserProfileContentItem[];
  visible: boolean;
};

export type UserDraftPage = {
  userId: string;
  total: number;
  items: PoemDraft[];
};

export type UserConnectionKind = "followers" | "following";

export type UserConnectionSummary = UserProfile & {
  isFollowing: boolean;
  followsYou: boolean;
  isFriend: boolean;
};

export type UserConnectionPage = {
  userId: string;
  kind: UserConnectionKind;
  total: number;
  items: UserConnectionSummary[];
  nextCursor?: string;
};

export type UserConnectionQuery = {
  cursor?: string;
  limit?: number;
  /** Mock-only compatibility field; HTTP mode derives the viewer from JWT. */
  viewerId?: string;
};

export type UpdateUserFollowInput = {
  userId: string;
  targetUserId: string;
  isActive: boolean;
};

export type UserFollowResult = {
  targetUserId: string;
  isFollowing: boolean;
  followsYou: boolean;
  isFriend: boolean;
  followers: number;
  following: number;
};

export type PoemMetrics = {
  comments: number;
  commentThreads?: number;
  likes: number;
  shares: number;
  contributions: number;
  contributionLines?: number;
  saves: number;
};

export type PoemViewerEngagement = {
  liked: boolean;
  saved: boolean;
};

export type PoemCollectionKind = "liked" | "saved";

export type UpdatePoemCollectionInput = {
  userId: string;
  poemId: string;
  collection: PoemCollectionKind;
  isActive: boolean;
};

export type UserPoemCollections = {
  userId: string;
  likedPoemIds: string[];
  savedPoemIds: string[];
};

export type InboxActivityKind = "comments" | "likes" | "thread";

export type InboxActivityCounts = Record<InboxActivityKind, number>;

export type InboxActivityTargetKind = "post" | "comment" | "thread";

export type InboxActivityPreview = {
  id: string;
  kind: InboxActivityKind;
  actor: UserProfile;
  target: {
    kind: InboxActivityTargetKind;
    title: string;
    excerpt: string;
    poemId?: string;
    commentId?: string;
    threadId?: string;
  };
  dateLabel: string;
  unread?: boolean;
};

export type InboxActivitySummary = {
  userId: string;
  unread: InboxActivityCounts;
  totals: InboxActivityCounts;
  recent: Record<InboxActivityKind, InboxActivityPreview[]>;
};

export type PoemCreditPerson = {
  handle: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string;
};

export type PoemCredits = {
  startedBy: PoemCreditPerson;
  commentContributors: PoemCreditPerson[];
  quoteContributors: PoemCreditPerson[];
};

export type PoemComment = {
  id: string;
  author: UserProfile;
  dateLabel: string;
  body: string;
  badgeLabel?: string;
  badgeTone?: "dark" | "warm";
  level?: number;
  createdAt?: string;
  parentCommentId?: string;
  likes?: number;
  viewer?: {
    liked: boolean;
    saved: boolean;
  };
};

export type PoemSummary = {
  id: string;
  title: string;
  lines: string[];
  author: UserProfile;
  contributorsCount: number;
  tags: string[];
  mentions?: string[];
  visibility?: DraftVisibility;
  audienceUserIds?: string[];
  declareOriginal?: boolean;
  allowComments?: boolean;
  allowSharing?: boolean;
  status: PoemStatus;
  startedAt: string;
  editedAt?: string;
  artworkUrl?: string;
  media?: PoemDraftMedia;
  layout?: PoemLayoutConfig;
  metrics: PoemMetrics;
  viewer: PoemViewerEngagement;
  artworkTone: "water" | "paper" | "night";
  credits?: PoemCredits;
  comments?: PoemComment[];
};

export type CreatePoemCommentInput = {
  poemId: string;
  userId: string;
  body: string;
  parentCommentId?: string;
};

export type UpdateCommentCollectionInput = {
  poemId: string;
  commentId: string;
  userId: string;
  collection: PoemCollectionKind;
  isActive: boolean;
};

export type PoemCommentEngagementResult = {
  poem: PoemSummary;
  comment: PoemComment;
};

export type UserSearchResult = UserProfile & {
  isFriend: boolean;
  hasRecentChat: boolean;
};

export type UserSearchQuery = {
  /** Opaque numeric cursor for the current in-memory adapter. */
  cursor?: string;
  limit?: number;
};

export type UserSearchPage = {
  query: string;
  recent: UserSearchResult[];
  friends: UserSearchResult[];
  results: UserSearchResult[];
  nextCursor: string | null;
};

export type SharePoemInput = {
  poemId: string;
  senderId: string;
  recipientIds: string[];
  note?: string;
};

export type SharePoemResult = {
  poemId: string;
  recipientIds: string[];
  messages: InboxConversationMessage[];
};

export type InboxConversationMessage = {
  id: string;
  sender: UserProfile;
  recipient: UserProfile;
  createdAt: string;
  kind: "text" | "shared-post";
  text?: string;
  sharedPost?: {
    id: string;
    title: string;
    excerpt: string;
    tags: string[];
    author: UserProfile;
    artworkUrl?: string;
  };
};

export type FeedQuery = {
  section?: FeedSection;
  filter?: FeedFilter;
  viewerId?: string;
};

export type PoemEngagementResult = {
  poem: PoemSummary;
  collections: UserPoemCollections;
};

export type ThreadSort = "top" | "latest" | "following";

export type ThreadViewerState = {
  liked: boolean;
};

export type ThreadMetrics = {
  likes: number;
  continuations: number;
  shares: number;
  views?: number;
};

export type PoetryThread = {
  id: string;
  author: UserProfile;
  title?: string;
  content: string;
  rules?: string;
  tags?: string[];
  mentions?: string[];
  visibility?: DraftVisibility;
  audienceUserIds?: string[];
  createdAt: string;
  community?: string;
  topic?: string;
  status?: "open" | "complete";
  cover?: {
    tone: "water" | "paper" | "night";
  };
  metrics: ThreadMetrics;
  viewer: ThreadViewerState;
};

export type ThreadContinuation = {
  id: string;
  threadId: string;
  parentContinuationId?: string;
  author: UserProfile;
  content: string;
  createdAt: string;
  metrics: ThreadMetrics;
  viewer: ThreadViewerState;
};

export type ThreadFeedQuery = {
  sort?: ThreadSort;
  viewerId?: string;
};

export type ThreadDetail = {
  thread: PoetryThread;
  continuations: ThreadContinuation[];
};

export type ContinuationDetail = {
  thread: PoetryThread;
  path: ThreadContinuation[];
  current: ThreadContinuation;
  children: ThreadContinuation[];
};

export type CreateThreadContinuationInput = {
  threadId: string;
  userId: string;
  content: string;
};

export type CreateContinuationInput = {
  continuationId: string;
  userId: string;
  content: string;
};

export type UpdateThreadLikeInput = {
  threadId: string;
  userId: string;
  isActive: boolean;
};

export type UpdateContinuationLikeInput = {
  continuationId: string;
  userId: string;
  isActive: boolean;
};

export type ThreadShareTarget =
  | { kind: "thread"; threadId: string; userId: string }
  | { kind: "continuation"; continuationId: string; userId: string };

export type ThreadShareResult = {
  targetId: string;
  shareCount: number;
};

export type AiAssistIntent =
  | "continue-poem"
  | "revise-line"
  | "title-suggestion"
  | "tag-suggestion"
  | "moderation-preview";

export type AiAssistRequest = {
  intent: AiAssistIntent;
  poemId?: string;
  text: string;
  locale?: "en" | "zh";
};

export type AiAssistResponse = {
  id: string;
  intent: AiAssistIntent;
  suggestions: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
};
