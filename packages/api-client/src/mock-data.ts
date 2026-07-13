import type {
  PoemSummary,
  UserConnectionKind,
  UserConnectionSummary,
  UserProfile,
  UserProfileContentItem,
  UserProfileContentSection,
  UserProfileDetails
} from "./types";

export const mockUsers: UserProfile[] = [
  {
    id: "user-lili",
    handle: "lili",
    displayName: "Lili",
    avatarColor: "#FF0038",
    bio: "love nature"
  },
  {
    id: "user-ray",
    handle: "ray",
    displayName: "Ray",
    avatarColor: "#E75435",
    bio: "Collaborative poem drafts."
  }
];

export const mockUserProfileDetails: UserProfileDetails[] = [
  {
    ...mockUsers[0]!,
    linespaceId: "12345678",
    level: 12,
    badges: [
      {
        id: "badge-classical",
        label: "Classical",
        symbol: "🏮",
        tone: "warm"
      }
    ],
    stats: {
      followers: 199,
      following: 230,
      likesAndSaves: 590
    },
    contentCounts: {
      posts: 17,
      comments: 42,
      quotes: 9,
      saves: 29
    }
  },
  {
    ...mockUsers[1]!,
    linespaceId: "87654321",
    level: 8,
    badges: [
      {
        id: "badge-modern",
        label: "Modern",
        tone: "neutral"
      }
    ],
    stats: {
      followers: 88,
      following: 104,
      likesAndSaves: 274
    },
    contentCounts: {
      posts: 9,
      comments: 31,
      quotes: 5,
      saves: 18
    }
  }
];

const profilePost = (
  id: string,
  highlightCount: number,
  overrides: Partial<UserProfileContentItem> = {}
): UserProfileContentItem => ({
  id,
  poemId: "poem-cedar",
  title: "Remembered",
  excerpt: "I dreamed that AI …",
  tags: ["AI", "false nostalgia", "dreamed"],
  finishedAt: "2026-09-02T09:00:00.000Z",
  highlightCount,
  ...overrides
});

export const mockUserProfileContent: Record<
  string,
  Record<UserProfileContentSection, UserProfileContentItem[]>
> = {
  "user-lili": {
    posts: [
      profilePost("profile-post-1", 7, { muted: true }),
      profilePost("profile-post-2", 9),
      profilePost("profile-post-3", 17),
      profilePost("profile-post-4", 29),
      profilePost("profile-post-5", 12),
      profilePost("profile-post-6", 21)
    ],
    comments: [
      profilePost("profile-comment-1", 22, {
        title: "A quiet revision",
        excerpt: "The maps insisted I had lived there once."
      }),
      profilePost("profile-comment-2", 18, {
        title: "Between floors",
        excerpt: "It stopped between floors."
      })
    ],
    quotes: [
      profilePost("profile-quote-1", 14, {
        title: "Borrowed light",
        excerpt: "Yesterday kept borrowing tomorrow's light."
      }),
      profilePost("profile-quote-2", 6, {
        title: "Separate moons",
        excerpt: "Every window kept a separate moon."
      })
    ],
    saves: [
      profilePost("profile-save-1", 11),
      profilePost("profile-save-2", 8, {
        title: "orbit",
        poemId: "poem-orbit",
        excerpt: "The city hummed below its own reflection.",
        tags: ["night", "city", "shared"]
      })
    ]
  },
  "user-ray": {
    posts: [profilePost("ray-profile-post-1", 5, { poemId: "poem-cedar" })],
    comments: [],
    quotes: [],
    saves: []
  }
};

const connectionUsers: UserConnectionSummary[] = [
  {
    id: "user-ray",
    handle: "ray",
    displayName: "Ray",
    avatarColor: "#E75435",
    bio: "Collaborative poem drafts.",
    isFollowing: true
  },
  {
    id: "user-jinghe",
    handle: "jinghe",
    displayName: "Jinghe",
    avatarColor: "#E35755",
    bio: "Collecting images from ordinary days.",
    isFollowing: true
  },
  {
    id: "user-zhihan",
    handle: "zhihan",
    displayName: "Zhihan",
    avatarColor: "#AFCEE5",
    bio: "Writes about cities and weather.",
    isFollowing: false
  },
  {
    id: "user-roma",
    handle: "roma",
    displayName: "Roma",
    avatarColor: "#4A5E2E",
    bio: "Short poems, long walks.",
    isFollowing: true
  }
];

export const mockUserConnections: Record<
  string,
  Record<UserConnectionKind, UserConnectionSummary[]>
> = {
  "user-lili": {
    followers: connectionUsers,
    following: [connectionUsers[0]!, connectionUsers[1]!, connectionUsers[3]!]
  },
  "user-ray": {
    followers: [
      {
        ...mockUsers[0]!,
        isFollowing: true
      }
    ],
    following: []
  }
};

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
