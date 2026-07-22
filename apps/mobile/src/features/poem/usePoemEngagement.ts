import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryKey
} from "@tanstack/react-query";
import type {
  PoemCollectionKind,
  PoemEngagementResult,
  PoemSummary,
  UpdatePoemCollectionInput
} from "@linespace/api-client";
import { lineSpaceApi } from "@/services/lineSpaceApi";
import { useAuth } from "@/auth/AuthSessionProvider";
import { useGuestAccess } from "@/auth/GuestAccessProvider";

type CacheSnapshot = Array<readonly [QueryKey, unknown]>;

export function usePoemEngagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { requireAccount } = useGuestAccess();
  const currentUserId = user?.id ?? "";
  const mutation = useMutation<
    PoemEngagementResult,
    Error,
    UpdatePoemCollectionInput,
    { snapshots: CacheSnapshot }
  >({
    mutationFn: (input) => lineSpaceApi.setPoemCollection(input),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["feed"] }),
        queryClient.cancelQueries({ queryKey: ["poem", input.poemId] })
      ]);

      const snapshots: CacheSnapshot = [
        ...queryClient.getQueriesData({ queryKey: ["feed"] }),
        ...queryClient.getQueriesData({ queryKey: ["poem", input.poemId] })
      ];

      updatePoemCaches(queryClient, input.poemId, (poem) =>
        applyOptimisticCollection(poem, input.collection, input.isActive)
      );

      return { snapshots };
    },
    onError: (_error, _input, context) => {
      context?.snapshots.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (result, input) => {
      updatePoemCaches(queryClient, result.poem.id, () => result.poem);
      queryClient.setQueryData(
        ["profile-poem-collections", result.collections.userId],
        result.collections
      );
      void queryClient.invalidateQueries({
        queryKey: ["user-profile", result.poem.author.id]
      });

      void queryClient.invalidateQueries({
        queryKey: ["user-profile", result.collections.userId]
      });
      void queryClient.invalidateQueries({
        queryKey: ["user-profile-content", result.collections.userId]
      });
      void queryClient.invalidateQueries({ queryKey: ["inbox-summary"] });
    }
  });

  return {
    isPending: mutation.isPending,
    setCollection: (
      poemId: string,
      collection: PoemCollectionKind,
      isActive: boolean
    ) => {
      if (!requireAccount(collection === "liked" ? "like this post" : "save this post")) return;
      if (!currentUserId) return;
      mutation.mutate({ userId: currentUserId, poemId, collection, isActive });
    }
  };
}

function updatePoemCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  poemId: string,
  update: (poem: PoemSummary) => PoemSummary
) {
  queryClient.setQueriesData<
    InfiniteData<PoemSummary[], string | undefined> | PoemSummary[]
  >({ queryKey: ["feed"] }, (feed) => {
    if (!feed) return feed;

    // The current feed is an infinite query. Keeping support for a plain array
    // also makes this updater safe for older/smaller feed consumers.
    if (Array.isArray(feed)) {
      return feed.map((poem) => (poem.id === poemId ? update(poem) : poem));
    }

    return {
      ...feed,
      pages: feed.pages.map((page) =>
        page.map((poem) => (poem.id === poemId ? update(poem) : poem))
      )
    };
  });
  queryClient.setQueriesData<PoemSummary | null>(
    { queryKey: ["poem", poemId] },
    (poem) => (poem ? update(poem) : poem)
  );
}

function applyOptimisticCollection(
  poem: PoemSummary,
  collection: PoemCollectionKind,
  isActive: boolean
): PoemSummary {
  const currentState = collection === "liked" ? poem.viewer.liked : poem.viewer.saved;
  if (currentState === isActive) {
    return poem;
  }

  const metric = collection === "liked" ? "likes" : "saves";
  const delta = isActive ? 1 : -1;

  return {
    ...poem,
    metrics: {
      ...poem.metrics,
      [metric]: Math.max(0, poem.metrics[metric] + delta)
    },
    viewer: {
      ...poem.viewer,
      [collection === "liked" ? "liked" : "saved"]: isActive
    }
  };
}
