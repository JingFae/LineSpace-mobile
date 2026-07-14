import type { Href } from "expo-router";

export type MainTab = "thread" | "post" | "compose" | "inbox" | "profile";

export const mainTabs = [
  { value: "thread", label: "Thread" },
  { value: "post", label: "Post" },
  { value: "compose", label: "Create" },
  { value: "inbox", label: "Inbox" },
  { value: "profile", label: "Profile" }
] as const;

export const tabRoutes: Record<MainTab, Href> = {
  thread: "/(tabs)",
  post: "/(tabs)/discover",
  compose: "/(tabs)/compose",
  inbox: "/(tabs)/comments",
  profile: "/(tabs)/profile"
};
