import { useLocalSearchParams } from "expo-router";
import { CollaborativeComposeScreen } from "@/features/compose/CollaborativeComposeScreen";

export default function CollaborativeComposeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CollaborativeComposeScreen draftId={id} />;
}
