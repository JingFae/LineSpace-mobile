import type { QueryClient } from "@tanstack/react-query";
import { lineSpaceApi } from "./lineSpaceApi";

const contentStaleTime = 60_000;

export function prefetchPoem(
  queryClient: QueryClient,
  poemId: string,
  viewerId: string
) {
  return queryClient.prefetchQuery({
    queryKey: ["poem", poemId, viewerId],
    queryFn: () => lineSpaceApi.getPoem(poemId, viewerId || undefined),
    staleTime: contentStaleTime
  });
}

export function prefetchThread(
  queryClient: QueryClient,
  threadId: string,
  viewerId: string
) {
  return queryClient.prefetchQuery({
    queryKey: ["thread-detail", threadId, viewerId],
    queryFn: () => lineSpaceApi.getThread(threadId, viewerId || undefined),
    staleTime: contentStaleTime
  });
}

export function prefetchProfile(
  queryClient: QueryClient,
  userId: string
) {
  return queryClient.prefetchQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => lineSpaceApi.getUserProfile(userId),
    staleTime: contentStaleTime
  });
}
