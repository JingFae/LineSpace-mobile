import type { PoemSummary, UserProfile } from "./types";

export const mockUsers: UserProfile[] = [
  {
    id: "user-lili",
    handle: "lili",
    displayName: "lili",
    avatarColor: "#F5324A",
    bio: "Writes small weather systems."
  },
  {
    id: "user-ray",
    handle: "ray",
    displayName: "Ray",
    avatarColor: "#E95638",
    bio: "Collaborative poem drafts."
  }
];

export const mockPoems: PoemSummary[] = [
  {
    id: "poem-light",
    title: "light",
    lines: [
      "Yesterday kept borrowing tomorrow's light.",
      "Morning arrived already exhausted.",
      "Nobody questioned the clock."
    ],
    author: mockUsers[0]!,
    contributorsCount: 3,
    tags: ["AI", "false nostalgia", "dreamed"],
    status: "growing",
    startedAt: "2026-09-02T09:00:00.000Z",
    metrics: {
      comments: 322,
      likes: 5234,
      contributions: 1923,
      saves: 111
    },
    artworkTone: "water"
  },
  {
    id: "poem-cedar",
    title: "cedar room",
    lines: [
      "A quiet table kept the rain outside.",
      "Ink gathered at the edge of a name.",
      "Someone opened the window carefully."
    ],
    author: mockUsers[1]!,
    contributorsCount: 2,
    tags: ["room", "rain", "linework"],
    status: "growing",
    startedAt: "2026-09-03T13:30:00.000Z",
    metrics: {
      comments: 88,
      likes: 913,
      contributions: 41,
      saves: 27
    },
    artworkTone: "paper"
  },
  {
    id: "poem-orbit",
    title: "orbit",
    lines: [
      "The city hummed below its own reflection.",
      "Every window kept a separate moon.",
      "We walked until the street forgot us."
    ],
    author: mockUsers[0]!,
    contributorsCount: 5,
    tags: ["night", "city", "shared"],
    status: "final",
    startedAt: "2026-08-28T21:20:00.000Z",
    metrics: {
      comments: 144,
      likes: 2401,
      contributions: 77,
      saves: 220
    },
    artworkTone: "night"
  }
];
