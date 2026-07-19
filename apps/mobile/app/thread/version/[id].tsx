import { useLocalSearchParams } from "expo-router";
import { PoemVersionPreviewScreen } from "@/features/thread/PoemVersionPreviewScreen";

export default function PoemVersionRoute() {
  const { id, customSelectionIds } = useLocalSearchParams<{
    id: string;
    customSelectionIds?: string;
  }>();
  return (
    <PoemVersionPreviewScreen
      customSelectionIds={customSelectionIds}
      threadId={id}
    />
  );
}
