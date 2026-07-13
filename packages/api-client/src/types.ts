export type FeedSection = "latest" | "popular" | "following";

export type FeedFilter = "all" | "most-contributed" | "growing" | "final";

export type PoemStatus = "growing" | "final" | "draft";

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

export type PoemCreditPerson = {
  handle: string;
  displayName: string;
  avatarColor: string;
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
