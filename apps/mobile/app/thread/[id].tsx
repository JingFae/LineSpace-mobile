import { useLocalSearchParams } from "expo-router";
import { ThreadDetailScreen } from "@/features/thread/ThreadScreens";

export default function ThreadDetailRoute() {
  const { id, selectVersion, selected } = useLocalSearchParams<{
    id: string;
    selectVersion?: string;
    selected?: string;
  }>();
  return (
    <ThreadDetailScreen
      initialSelectedIds={selected}
      selectionMode={selectVersion === "true"}
      threadId={id}
    />
  );
}
