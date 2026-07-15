import { useLocalSearchParams } from "expo-router";
import { CreateHomeScreen } from "@/features/compose/CreateHomeScreen";
import { ComposeScreen } from "@/features/compose/ComposeScreen";
import { ThreadComposeScreen } from "@/features/compose/ThreadComposeScreen";

export default function ComposeRoute() {
  const params = useLocalSearchParams<{ type?: string; session?: string }>();
  if (params.type === "post") return <ComposeScreen sessionKey={params.session ?? "default"} />;
  if (params.type === "thread") return <ThreadComposeScreen sessionKey={params.session ?? "default"} />;
  return <CreateHomeScreen />;
}
