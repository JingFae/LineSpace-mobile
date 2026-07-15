import { useLocalSearchParams } from "expo-router";
import { PoemDetailScreen } from "@/features/poem/PoemDetailScreen";

export default function PoemDetailRoute() {
  const { commentId, id, targetKind } = useLocalSearchParams<{
    commentId?: string;
    id: string;
    targetKind?: "post" | "comment";
  }>();

  return <PoemDetailScreen commentId={commentId} id={id} targetKind={targetKind} />;
}
