import { useLocalSearchParams } from "expo-router";
import { ThreadShareScreen } from "@/features/thread/ThreadShareScreen";

export default function ThreadShareRoute() {
  const { id, kind } = useLocalSearchParams<{
    id?: string;
    kind?: "thread" | "continuation";
  }>();
  return <ThreadShareScreen kind={kind} targetId={id} />;
}
