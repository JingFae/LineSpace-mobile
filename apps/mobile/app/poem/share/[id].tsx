import { useLocalSearchParams } from "expo-router";
import { PostShareScreen } from "@/features/poem/PostShareScreen";

export default function PostShareRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <PostShareScreen poemId={id} />;
}
