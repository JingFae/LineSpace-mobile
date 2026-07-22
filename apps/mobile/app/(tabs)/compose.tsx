import { useLocalSearchParams } from "expo-router";
import { CreateHomeScreen } from "@/features/compose/CreateHomeScreen";
import { ComposeScreen } from "@/features/compose/ComposeScreen";
import { ThreadComposeScreen } from "@/features/compose/ThreadComposeScreen";

export default function ComposeRoute() {
  const params = useLocalSearchParams<{
    type?: string;
    session?: string;
    sourceVersionId?: string;
    sourceThreadId?: string;
    generatedTitle?: string;
    fullPoemText?: string;
    contributorIds?: string;
    contributorHandles?: string;
    versionLines?: string;
    mediaUri?: string;
    mediaKind?: "image" | "video";
    lockedVersionContent?: string;
    draftId?: string;
    editPostId?: string;
    editThreadId?: string;
  }>();
  if (params.type === "post") {
    return <ComposeScreen params={params} sessionKey={params.session ?? "default"} />;
  }
  if (params.type === "thread") {
    return <ThreadComposeScreen
      draftId={params.draftId}
      editThreadId={params.editThreadId}
      sessionKey={params.session ?? "default"}
    />;
  }
  return <CreateHomeScreen />;
}
