import { useLocalSearchParams } from "expo-router";
import { PoemVersionPreviewScreen } from "@/features/thread/PoemVersionPreviewScreen";

export default function PoemVersionRoute() {
  const { id, customSelectionIds, focusCustomVersion } = useLocalSearchParams<{
    id: string;
    customSelectionIds?: string;
    focusCustomVersion?: string;
  }>();
  return (
    <PoemVersionPreviewScreen
      customSelectionIds={customSelectionIds}
      focusCustomVersion={focusCustomVersion === "true"}
      threadId={id}
    />
  );
}
