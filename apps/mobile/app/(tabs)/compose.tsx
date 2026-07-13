import { useLocalSearchParams } from "expo-router";
import { ComposeScreen } from "@/features/compose/ComposeScreen";

export default function ComposeRoute() {
  const params = useLocalSearchParams<{ session?: string }>();
  return <ComposeScreen sessionKey={params.session ?? "default"} />;
}
