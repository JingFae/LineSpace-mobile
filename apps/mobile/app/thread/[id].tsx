import { useLocalSearchParams } from "expo-router";
import { ThreadDetailScreen } from "@/features/thread/ThreadScreens";

export default function ThreadDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThreadDetailScreen threadId={id} />;
}
