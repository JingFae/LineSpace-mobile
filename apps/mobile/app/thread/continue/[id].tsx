import { useLocalSearchParams } from "expo-router";
import { ContinueDetailScreen } from "@/features/thread/ThreadScreens";

export default function ContinueDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContinueDetailScreen continuationId={id} />;
}
