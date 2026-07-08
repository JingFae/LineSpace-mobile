export type FeedSection = "latest" | "popular" | "following";

export type FeedFilter = "all" | "most-contributed" | "growing" | "final";

export type PoemStatus = "growing" | "final" | "draft";

export type UserProfile = {
  id: string;
  handle: string;
  displayName: string;
  avatarColor: string;
  bio?: string;
};

export type PoemMetrics = {
  comments: number;
  likes: number;
  contributions: number;
  saves: number;
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
  artworkTone: "water" | "paper" | "night";
};

export type FeedQuery = {
  section?: FeedSection;
  filter?: FeedFilter;
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
