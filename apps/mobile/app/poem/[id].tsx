import { useLocalSearchParams } from "expo-router";
import { PoemDetailScreen } from "@/features/poem/PoemDetailScreen";

export default function PoemDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PoemDetailScreen id={id} />;
}
