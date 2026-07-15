import { useLocalSearchParams } from "expo-router";
import { PoemVersionPreviewScreen } from "@/features/thread/PoemVersionPreviewScreen";

export default function PoemVersionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PoemVersionPreviewScreen threadId={id} />;
}
