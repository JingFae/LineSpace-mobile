import type { Href } from "expo-router";

export type MainTab = "thread" | "post" | "compose" | "inbox" | "profile";

export const mainTabs = [
<<<<<<< HEAD
  { value: "home", label: "Thread" },
  { value: "discover", label: "Post" },
  { value: "compose", label: "Compose" },
  { value: "comments", label: "Notes" },
  { value: "profile", label: "Me" }
=======
  { value: "thread", label: "Thread" },
  { value: "post", label: "Post" },
  { value: "compose", label: "Create" },
  { value: "inbox", label: "Inbox" },
  { value: "profile", label: "Profile" }
>>>>>>> b32be5f845e8e6c89ad0496b46de0a750e3de28f
] as const;

export const tabRoutes: Record<MainTab, Href> = {
  thread: "/(tabs)",
  post: "/(tabs)/discover",
  compose: "/(tabs)/compose",
  inbox: "/(tabs)/comments",
  profile: "/(tabs)/profile"
};
