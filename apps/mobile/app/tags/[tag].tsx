import { useLocalSearchParams } from "expo-router";
import { TagResultsScreen } from "@/features/discovery/TagResultsScreen";

export default function TagResultsRoute() {
  const params = useLocalSearchParams<{ tag?: string | string[]; section?: string | string[] }>();
  const tag = Array.isArray(params.tag) ? params.tag[0] ?? "" : params.tag ?? "";
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  return <TagResultsScreen initialSection={rawSection === "threads" ? "threads" : "posts"} tag={tag} />;
}
