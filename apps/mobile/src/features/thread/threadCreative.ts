import type { PoetryThread, ThreadContinuation, UserProfile } from "@linespace/api-client";

export type ThreadMediaId = "rain" | "paper" | "night" | "library" | "signal" | "stone";

export type ThreadMediaPreset = {
  id: ThreadMediaId;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  mutedTextColor: string;
  overlayColor: string;
  uri?: string;
};

export type CreativeThreadViewModel = {
  id: string;
  thread: PoetryThread;
  author: UserProfile;
  writingPrompt: string;
  startingContent: string;
  mediaId: ThreadMediaId;
  createdAt: string;
};

export type PoemVersionLineViewModel = {
  id: string;
  text: string;
  author: UserProfile;
  isStartingContent: boolean;
  lineNumber: number;
  likes: number;
  continuationId?: string;
  parentContinuationId?: string;
};

export type PoemVersionCriterion = "recommended" | "mostPopular" | "longest" | "custom";

export type PoemVersionViewModel = {
  id: string;
  threadId: string;
  leafContinuationId: string | null;
  title: string;
  titleSource: "author" | "mock" | "fallback";
  criterion?: PoemVersionCriterion;
  lines: PoemVersionLineViewModel[];
  contributorIds: string[];
  continuationCount: number;
  totalLikeScore: number;
  totalTextLength: number;
  updatedAt: string;
  aiRationale?: string;
};

type CreativeThreadPreset = {
  writingPrompt?: string;
  startingContent?: string;
  mediaId?: ThreadMediaId;
};

const defaultMediaId: ThreadMediaId = "paper";

const creativeThreadPresets: Record<string, CreativeThreadPreset> = {
  "thread-rain-without-rain": {
    writingPrompt: "Write a rain poem without naming rain.",
    startingContent: "Start with the sound a window remembers.",
    mediaId: "rain"
  },
  "thread-library-breath": {
    writingPrompt: "Begin with a library holding its breath after the last reader leaves.",
    startingContent:
      "After closing, the shelves exhaled in alphabetical order.\nA ladder leaned against the silence like a question.\nThe return cart rolled once by itself, carrying fingerprints, overdue weather, and a bookmark shaped like a train ticket.\nSomewhere in the travel section, a map unfolded without choosing a country.",
    mediaId: "library"
  },
  "thread-shadow-names": {
    writingPrompt: "Give every shadow in the room a name, then let one of them answer.",
    startingContent: "The smallest shadow called itself Almost.",
    mediaId: "night"
  },
  "thread-moon-receipt": {
    startingContent: "The moon wrote: one borrowed tide, paid back in silver.",
    mediaId: "night"
  },
  "thread-unopened-letter": {
    startingContent: "Dear almost, I have learned to stay sealed without staying silent.",
    mediaId: "paper"
  },
  "thread-city-edge": {
    writingPrompt: "Continue the last bus at the edge of the city.",
    startingContent: "At the edge of the city, the last bus writes its name in light.",
    mediaId: "signal"
  },
  "thread-orchard-static": {
    startingContent: "An old radio hummed until its static grew leaves.",
    mediaId: "signal"
  },
  "thread-pocket-stone": {
    startingContent: "All winter, the stone learned the shape of a closed hand.",
    mediaId: "stone"
  },
  "thread-radio-snow": {
    startingContent: "Before the report, snow arrived as a room full of static.",
    mediaId: "signal"
  }
};

export const threadMediaPresets: Record<ThreadMediaId, ThreadMediaPreset> = {
  rain: {
    id: "rain",
    backgroundColor: "#AFCFDB",
    accentColor: "#6A94A5",
    textColor: "#102026",
    mutedTextColor: "#42606A",
    overlayColor: "rgba(255,255,255,0.34)"
  },
  paper: {
    id: "paper",
    backgroundColor: "#EFE6D7",
    accentColor: "#C8A46C",
    textColor: "#241C16",
    mutedTextColor: "#6F6255",
    overlayColor: "rgba(255,255,255,0.36)"
  },
  night: {
    id: "night",
    backgroundColor: "#222735",
    accentColor: "#B4C4E4",
    textColor: "#F7F2EA",
    mutedTextColor: "#D2D6E0",
    overlayColor: "rgba(0,0,0,0.18)"
  },
  library: {
    id: "library",
    backgroundColor: "#D7D4C4",
    accentColor: "#7C8A6A",
    textColor: "#1F241B",
    mutedTextColor: "#616954",
    overlayColor: "rgba(255,255,255,0.3)"
  },
  signal: {
    id: "signal",
    backgroundColor: "#DDE3E7",
    accentColor: "#6F7B87",
    textColor: "#171D22",
    mutedTextColor: "#66717A",
    overlayColor: "rgba(255,255,255,0.26)"
  },
  stone: {
    id: "stone",
    backgroundColor: "#D8D1C6",
    accentColor: "#7F8175",
    textColor: "#211F1B",
    mutedTextColor: "#69645A",
    overlayColor: "rgba(255,255,255,0.3)"
  }
};

export function getDefaultMediaPreset() {
  return threadMediaPresets[defaultMediaId];
}

export function getThreadWritingPrompt(thread: PoetryThread) {
  return creativeThreadPresets[thread.id]?.writingPrompt ?? thread.rules ?? thread.content;
}

export function getThreadStartingContent(thread: PoetryThread) {
  const presetContent = creativeThreadPresets[thread.id]?.startingContent;
  if (presetContent) return presetContent;
  if (thread.startingContent?.trim()) return thread.startingContent.trim();
  return deriveStartingContentFallback(thread.content);
}

export function getThreadMedia(thread: PoetryThread) {
  const mediaId = creativeThreadPresets[thread.id]?.mediaId ?? toneToMediaId(thread.cover?.tone);
  return {
    ...(threadMediaPresets[mediaId] ?? getDefaultMediaPreset()),
    uri: thread.media?.uri
  };
}

export function adaptThreadToCreativeViewModel(thread: PoetryThread): CreativeThreadViewModel {
  return {
    id: thread.id,
    thread,
    author: thread.author,
    writingPrompt: getThreadWritingPrompt(thread),
    startingContent: getThreadStartingContent(thread),
    mediaId: getThreadMedia(thread).id,
    createdAt: thread.createdAt
  };
}

export function getThreadContributors(thread: PoetryThread, continuations: readonly ThreadContinuation[]) {
  const contributors = new Map<string, UserProfile>();
  contributors.set(thread.author.id, thread.author);
  for (const continuation of continuations) {
    contributors.set(continuation.author.id, continuation.author);
  }
  return [...contributors.values()];
}

export function buildPoemVersions(
  thread: PoetryThread,
  continuations: readonly ThreadContinuation[]
): PoemVersionViewModel[] {
  const creativeThread = adaptThreadToCreativeViewModel(thread);
  const paths = collectLeafPaths(continuations);
  return paths.map((path) => buildVersionFromPath(creativeThread, path));
}

export function collectLeafPaths(continuations: readonly ThreadContinuation[]) {
  const childrenByParent = new Map<string, ThreadContinuation[]>();
  const roots: ThreadContinuation[] = [];

  for (const continuation of continuations) {
    const parentId = continuation.parentContinuationId;
    if (!parentId) {
      roots.push(continuation);
      continue;
    }
    const children = childrenByParent.get(parentId) ?? [];
    children.push(continuation);
    childrenByParent.set(parentId, children);
  }

  const sortStable = (items: ThreadContinuation[]) =>
    [...items].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));

  const paths: ThreadContinuation[][] = [];
  const walk = (node: ThreadContinuation, path: ThreadContinuation[]) => {
    const nextPath = [...path, node];
    const children = sortStable(childrenByParent.get(node.id) ?? []);
    if (children.length === 0) {
      paths.push(nextPath);
      return;
    }
    for (const child of children) walk(child, nextPath);
  };

  for (const root of sortStable(roots)) walk(root, []);
  return paths.length > 0 ? paths : [[]];
}

export function getVersionContributors(lines: readonly PoemVersionLineViewModel[]) {
  return [...new Set(lines.map((line) => line.author.id))];
}

export function calculateVersionLikeScore(path: readonly ThreadContinuation[]) {
  return path.reduce((score, continuation) => score + continuation.metrics.likes, 0);
}

export function selectRepresentativeVersions(versions: readonly PoemVersionViewModel[]) {
  if (versions.length <= 1) return versions.map((version) => ({ ...version, criterion: "longest" as const }));

  const byLongest = [...versions].sort(compareLongestVersion);
  const byMostLiked = [...versions].sort(compareMostLikedVersion);
  const longest = { ...byLongest[0]!, criterion: "longest" as const };
  const mostLikedCandidate = byMostLiked.find((version) => version.id !== longest.id);
  return mostLikedCandidate
    ? [longest, { ...mostLikedCandidate, criterion: "mostPopular" as const }]
    : [longest];
}

export function buildCustomPoemVersion(
  thread: PoetryThread,
  continuations: readonly ThreadContinuation[],
  selectedContinuationIds: readonly string[]
) {
  const byId = new Map(continuations.map((item) => [item.id, item]));
  const selected = new Set(selectedContinuationIds);
  const selectedPath: ThreadContinuation[] = [];
  const appendWithAncestors = (item: ThreadContinuation) => {
    if (selectedPath.some((entry) => entry.id === item.id)) return;
    if (item.parentContinuationId) {
      const parent = byId.get(item.parentContinuationId);
      if (parent) appendWithAncestors(parent);
    }
    selectedPath.push(item);
  };
  for (const id of selected) {
    const item = byId.get(id);
    if (item) appendWithAncestors(item);
  }
  return buildVersionFromPath(adaptThreadToCreativeViewModel(thread), selectedPath, "custom");
}

export function getVersionContentHash(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

// Frontend-only mock title generator. Replace with a real LLM title service later.
export function generateMockPoemTitle(lines: readonly PoemVersionLineViewModel[]) {
  const text = lines.map((line) => line.text).join(" ");
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3);
  const uniqueWords = [...new Set(words)];
  if (uniqueWords.length === 0) return { title: "Untitled", titleSource: "fallback" as const };
  const hash = Number.parseInt(getVersionContentHash(text).slice(0, 4), 36) || 0;
  const start = hash % uniqueWords.length;
  const picked = [uniqueWords[start], uniqueWords[(start + 2) % uniqueWords.length], uniqueWords[(start + 5) % uniqueWords.length]]
    .filter(Boolean)
    .slice(0, 3);
  const title = picked.map((word) => word![0]!.toUpperCase() + word!.slice(1).toLowerCase()).join(" ");
  return { title, titleSource: "mock" as const };
}

export function resolvePoemVersionTitle(
  thread: PoetryThread,
  lines: readonly PoemVersionLineViewModel[]
) {
  const authoredTitle = thread.title?.trim();
  if (
    authoredTitle &&
    !/^(poem relay|untitled poem relay|untitled thread)$/i.test(authoredTitle)
  ) {
    return { title: authoredTitle, titleSource: "author" as const };
  }
  return generateMockPoemTitle(lines);
}

export function getFullPoemText(version: PoemVersionViewModel) {
  return version.lines.map((line) => line.text).join("\n\n");
}

function buildVersionFromPath(
  creativeThread: CreativeThreadViewModel,
  path: readonly ThreadContinuation[],
  criterion?: PoemVersionCriterion
): PoemVersionViewModel {
  const lines: PoemVersionLineViewModel[] = [
    {
      id: `${creativeThread.id}:starting-content`,
      text: creativeThread.startingContent,
      author: creativeThread.author,
      isStartingContent: true,
      lineNumber: 1,
      likes: 0
    },
    ...path.map((continuation) => ({
      id: continuation.id,
      text: continuation.content,
      author: continuation.author,
      isStartingContent: false,
      lineNumber: continuation.lineNumber ?? path.indexOf(continuation) + 2,
      likes: continuation.metrics.likes,
      continuationId: continuation.id,
      parentContinuationId: continuation.parentContinuationId
    }))
  ];
  const titleResult = resolvePoemVersionTitle(creativeThread.thread, lines);
  const textLength = lines.reduce((total, line) => total + line.text.length, 0);
  const leaf = path[path.length - 1];

  return {
    id: leaf ? `${creativeThread.id}:${leaf.id}:${getVersionContentHash(lines.map((line) => line.text).join("\n"))}` : `${creativeThread.id}:initial`,
    threadId: creativeThread.id,
    leafContinuationId: leaf?.id ?? null,
    title: titleResult.title,
    titleSource: titleResult.titleSource,
    criterion,
    lines,
    contributorIds: getVersionContributors(lines),
    continuationCount: path.length,
    totalLikeScore: calculateVersionLikeScore(path),
    totalTextLength: textLength,
    updatedAt: leaf?.createdAt ?? creativeThread.createdAt
  };
}

function compareLongestVersion(left: PoemVersionViewModel, right: PoemVersionViewModel) {
  return (
    right.continuationCount - left.continuationCount ||
    right.totalTextLength - left.totalTextLength ||
    right.totalLikeScore - left.totalLikeScore ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareMostLikedVersion(left: PoemVersionViewModel, right: PoemVersionViewModel) {
  return (
    right.totalLikeScore - left.totalLikeScore ||
    right.continuationCount - left.continuationCount ||
    right.totalTextLength - left.totalTextLength ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function deriveStartingContentFallback(content: string) {
  const sentences = content.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  return sentences.length > 1 ? sentences[sentences.length - 1]! : content;
}

function toneToMediaId(tone?: NonNullable<PoetryThread["cover"]>["tone"]): ThreadMediaId {
  if (tone === "night") return "night";
  if (tone === "water") return "rain";
  return defaultMediaId;
}
