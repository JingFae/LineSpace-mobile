import type { Href } from "expo-router";

export type MainTab = "home" | "discover" | "compose" | "comments" | "profile";

export const mainTabs = [
  { value: "home", label: "Home" },
  { value: "discover", label: "Read" },
  { value: "compose", label: "Compose" },
  { value: "comments", label: "Notes" },
  { value: "profile", label: "Me" }
] as const;

export const tabRoutes: Record<MainTab, Href> = {
  home: "/(tabs)",
  discover: "/(tabs)/discover",
  compose: "/(tabs)/compose",
  comments: "/(tabs)/comments",
  profile: "/(tabs)/profile"
};
