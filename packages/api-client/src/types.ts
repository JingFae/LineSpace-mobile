export type FeedSection = "latest" | "popular" | "following";

export type FeedFilter = "all" | "most-contributed" | "growing" | "final";

export type PoemStatus = "growing" | "final" | "draft";

export type ComposeMode = "draft" | "relay";

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
};

export type PoemDraftSettings = {
  declareOriginal: boolean;
  isPublic: boolean;
  allowComments: boolean;
  allowQuotes: boolean;
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

export type UserContentCounts = {
  posts: number;
  comments: number;
  quotes: number;
  saves: number;
};

export type UserProfileDetails = UserProfile & {
  linespaceId: string;
  level: number;
  badges: UserBadge[];
  stats: UserProfileStats;
  contentCounts: UserContentCounts;
};

export type UpdateUserProfileInput = {
  userId: string;
  displayName?: string;
  bio?: string;
  /** Durable object-storage URL in production; local cropped URI in mock mode. */
  avatarUrl?: string;
};

export type UserProfileContentSection = "posts" | "comments" | "quotes" | "saves";

export type UserProfileContentItem = {
  id: string;
  poemId?: string;
  title: string;
  excerpt: string;
  tags: string[];
  finishedAt: string;
  highlightCount?: number;
  artworkUrl?: string;
  muted?: boolean;
};

export type UserProfileContentPage = {
  userId: string;
  section: UserProfileContentSection;
  total: number;
  items: UserProfileContentItem[];
};

export type UserConnectionKind = "followers" | "following";

export type UserConnectionSummary = UserProfile & {
  isFollowing: boolean;
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
  viewerId?: string;
};

export type PoemMetrics = {
  comments: number;
  commentThreads?: number;
  likes: number;
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
  annotation?: string;
};

export type PoemSummary = {
  id: string;
  title: string;
  lines: string[];
  author: UserProfile;
  contributorsCount: number;
  tags: string[];
  status: PoemStatus;
  startedAt: string;
  metrics: PoemMetrics;
  viewer: PoemViewerEngagement;
  artworkTone: "water" | "paper" | "night";
  credits?: PoemCredits;
  comments?: PoemComment[];
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
