import type { PoemSummary, UserProfile } from "./types";

export const mockUsers: UserProfile[] = [
  {
    id: "user-lili",
    handle: "lili",
    displayName: "Lili",
    avatarColor: "#FF0038",
    bio: "Writes small weather systems."
  },
  {
    id: "user-ray",
    handle: "ray",
    displayName: "Ray",
    avatarColor: "#E75435",
    bio: "Collaborative poem drafts."
  }
];

const creditPeople = {
  lili: {
    handle: "LILI",
    displayName: "LILI",
    avatarColor: "#4A5E2E"
  },
  jinghe: {
    handle: "Jinghe",
    displayName: "Jinghe",
    avatarColor: "#E35755"
  },
  zhihan: {
    handle: "Zhihan",
    displayName: "Zhihan",
    avatarColor: "#FBECD4"
  },
  ray: {
    handle: "Ray",
    displayName: "Ray",
    avatarColor: "#AFCEE5"
  }
} as const;

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
      commentThreads: 2,
      likes: 5234,
      contributions: 1923,
      contributionLines: 4,
      saves: 111
    },
    viewer: { liked: false, saved: false },
    artworkTone: "water",
    credits: {
      startedBy: creditPeople.lili,
      commentContributors: [creditPeople.jinghe, creditPeople.zhihan],
      quoteContributors: [creditPeople.ray]
    },
    comments: [
      {
        id: "comment-lili-childhood",
        author: mockUsers[0]!,
        dateLabel: "8-09",
        body: "and asked me to choose a childhood.",
        badgeLabel: "🏮 Classical",
        badgeTone: "dark",
        annotation: "Used in this poem ✅"
      },
      {
        id: "comment-ray-loneliness",
        author: {
          ...mockUsers[1]!,
          avatarColor: "#25507B"
        },
        dateLabel: "8-09",
        body: "let the loneliness arrive quietly.",
        annotation: "Inspired a revision 💡"
      },
      {
        id: "comment-zhihan-autofill",
        author: {
          id: "user-zhihan",
          handle: "zhihan",
          displayName: "Zhihan",
          avatarColor: "#FF0038"
        },
        dateLabel: "8-09",
        body: "It tapped from inside the autofill box.",
        annotation: "Started a new version 🌱"
      },
      {
        id: "comment-jinghe-floors",
        author: {
          id: "user-jinghe",
          handle: "jinghe",
          displayName: "Jinghe",
          avatarColor: "#CBD2CC"
        },
        dateLabel: "8-09",
        body: "It stopped between floors",
        annotation: "Pinned by author 📌"
      },
      {
        id: "comment-roma-lonely",
        author: {
          id: "user-roma",
          handle: "roma",
          displayName: "Roma",
          avatarColor: "#FF0038"
        },
        dateLabel: "8-09",
        body: "his feels funny at first, then suddenly lonely."
      },
      {
        id: "comment-anna-quiet",
        author: {
          id: "user-anna",
          handle: "anna",
          displayName: "Anna",
          avatarColor: "#FF0038"
        },
        dateLabel: "8-09",
        body: "I love how quiet this final version is."
      }
    ]
  },
  {
    id: "poem-cedar",
    title: "Remembered",
    lines: [
      "dreamed that AI remembered a city I had never visited.",
      "The streets greeted me by my forgotten name.",
      "The maps insisted I had lived there once."
    ],
    author: mockUsers[1]!,
    contributorsCount: 3,
    tags: ["AI", "false nostalgia", "dreamed"],
    status: "growing",
    startedAt: "2026-09-03T13:30:00.000Z",
    metrics: {
      comments: 322,
      commentThreads: 2,
      likes: 5234,
      contributions: 1923,
      contributionLines: 4,
      saves: 111
    },
    viewer: { liked: false, saved: false },
    artworkTone: "paper",
    credits: {
      startedBy: creditPeople.ray,
      commentContributors: [creditPeople.jinghe, creditPeople.zhihan],
      quoteContributors: [creditPeople.lili]
    },
    comments: [
      {
        id: "comment-cedar-one",
        author: mockUsers[1]!,
        dateLabel: "8-09",
        body: "The maps insisted I had lived there once.",
        annotation: "Used in this poem ✅"
      }
    ]
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
      commentThreads: 1,
      likes: 2401,
      contributions: 77,
      contributionLines: 3,
      saves: 220
    },
    viewer: { liked: false, saved: false },
    artworkTone: "night"
  }
];
