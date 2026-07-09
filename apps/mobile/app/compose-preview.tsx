import { useLocalSearchParams } from "expo-router";
import { ComposePreviewScreen } from "@/features/compose/ComposePreviewScreen";

export default function ComposePreviewRoute() {
  const params = useLocalSearchParams();

  return <ComposePreviewScreen params={params} />;
}
