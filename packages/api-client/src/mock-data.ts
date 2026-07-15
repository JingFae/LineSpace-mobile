import type {
  PoemDesignCatalog,
  PoemSummary,
  PoetryThread,
  ThreadContinuation,
  UserConnectionKind,
  UserConnectionSummary,
  UserProfile,
  UserProfileContentItem,
  UserProfileContentSection,
  UserProfileDetails
} from "./types";

export const mockPoemDesignCatalog: PoemDesignCatalog = {
  templates: [
    {
      id: "quiet-letter",
      label: "Quiet letter",
      description: "Ruled paper, literary serif and a botanical mark.",
      role: "template",
      swatch: "#F4EFE2",
      layout: {
        templateId: "quiet-letter",
        typographyId: "literary-serif",
        backgroundId: "letter-paper",
        stickerIds: ["botanical"]
      }
    },
    {
      id: "night-whisper",
      label: "Night whisper",
      description: "Dark blue paper, handwritten lines and a quiet moon.",
      role: "template",
      swatch: "#213142",
      layout: {
        templateId: "night-whisper",
        typographyId: "handwritten",
        backgroundId: "midnight",
        stickerIds: ["moon"]
      }
    },
    {
      id: "travel-postcard",
      label: "Postcard",
      description: "Warm correspondence paper with a postmark accent.",
      role: "template",
      swatch: "#EADBC5",
      layout: {
        templateId: "travel-postcard",
        typographyId: "clean-sans",
        backgroundId: "postcard",
        stickerIds: ["postmark"]
      }
    }
  ],
  typography: [
    {
      id: "literary-serif",
      label: "Literary",
      description: "A classic serif for reflective poems.",
      role: "serif",
      swatch: "#151515"
    },
    {
      id: "handwritten",
      label: "Handwritten",
      description: "A softer English script for intimate lines.",
      role: "script",
      swatch: "#38516B"
    },
    {
      id: "clean-sans",
      label: "Clear",
      description: "A restrained modern voice.",
      role: "sans",
      swatch: "#626262"
    }
  ],
  backgrounds: [
    {
      id: "letter-paper",
      label: "Letter paper",
      description: "Warm ruled stationery.",
      role: "ruled",
      swatch: "#F4EFE2"
    },
    {
      id: "kraft-paper",
      label: "Kraft",
      description: "Earthy paper with a tactile tone.",
      role: "kraft",
      swatch: "#C6A476"
    },
    {
      id: "postcard",
      label: "Postcard",
      description: "Vintage correspondence stock.",
      role: "postcard",
      swatch: "#EADBC5"
    },
    {
      id: "midnight",
      label: "Midnight",
      description: "Deep blue for luminous text.",
      role: "dark",
      swatch: "#213142"
    }
  ],
  stickers: [
    {
      id: "botanical",
      label: "Botanical",
      description: "A small pressed-leaf mark.",
      role: "botanical",
      swatch: "#66765A",
      symbol: "❦"
    },
    {
      id: "moon",
      label: "Moon",
      description: "A pale crescent for night poems.",
      role: "moon",
      swatch: "#F3E8C8",
      symbol: "☾"
    },
    {
      id: "postmark",
      label: "Postmark",
      description: "A simple correspondence stamp.",
      role: "postmark",
      swatch: "#9D5D4D",
      symbol: "✦"
    }
  ]
};

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

const threadUsers = {
  lili: mockUsers[0]!,
  ray: mockUsers[1]!,
  jinghe: {
    id: "user-jinghe",
    handle: "jinghe",
    displayName: "Jinghe",
    avatarColor: "#E35755",
    bio: "Collecting images from ordinary days."
  },
  zhihan: {
    id: "user-zhihan",
    handle: "zhihan",
    displayName: "Zhihan",
    avatarColor: "#AFCEE5",
    bio: "Writes about cities and weather."
  },
  roma: {
    id: "user-roma",
    handle: "roma",
    displayName: "Roma",
    avatarColor: "#4A5E2E",
    bio: "Short poems, long walks."
  }
} as const;

export const mockThreads: PoetryThread[] = [
  {
    id: "thread-rain-without-rain",
    author: threadUsers.jinghe,
    content:
      "Write a rain poem without naming rain. Start with the sound a window remembers.",
    createdAt: "2026-07-14T08:10:00.000Z",
    community: "Poetry Threads",
    topic: "prompt",
    status: "open",
    metrics: { likes: 42, continuations: 6, shares: 8, views: 1800 },
    viewer: { liked: false }
  },
  {
    id: "thread-unopened-letter",
    author: threadUsers.ray,
    content:
      "Write from the perspective of an unopened letter. Let every line want to be read.",
    createdAt: "2026-07-14T10:35:00.000Z",
    community: "LineSpace Relay",
    topic: "chain",
    status: "open",
    metrics: { likes: 28, continuations: 3, shares: 5, views: 920 },
    viewer: { liked: true }
  },
  {
    id: "thread-city-edge",
    author: threadUsers.lili,
    content:
      "At the edge of the city, the last bus writes its name in light. Continue the next line.",
    createdAt: "2026-07-13T21:09:00.000Z",
    community: "Night Lines",
    topic: "open line",
    status: "open",
    metrics: { likes: 63, continuations: 4, shares: 13, views: 2400 },
    viewer: { liked: false }
  },
  {
    id: "thread-place-return",
    author: threadUsers.roma,
    content:
      "Describe the place you most want to return to, but only through what stayed behind.",
    createdAt: "2026-07-13T16:20:00.000Z",
    community: "Memory Atlas",
    topic: "prompt",
    status: "open",
    metrics: { likes: 19, continuations: 2, shares: 2, views: 640 },
    viewer: { liked: false }
  }
];

export const mockThreadContinuations: ThreadContinuation[] = [
  {
    id: "continue-rain-glass",
    threadId: "thread-rain-without-rain",
    author: threadUsers.lili,
    content: "The glass learned a thousand small knocks before morning opened its hand.",
    createdAt: "2026-07-14T08:33:00.000Z",
    metrics: { likes: 12, continuations: 2, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-rain-glass-child",
    threadId: "thread-rain-without-rain",
    parentContinuationId: "continue-rain-glass",
    author: threadUsers.ray,
    content: "Each knock became a seed of silver on the sill.",
    createdAt: "2026-07-14T08:47:00.000Z",
    metrics: { likes: 8, continuations: 1, shares: 0 },
    viewer: { liked: true }
  },
  {
    id: "continue-rain-glass-grandchild",
    threadId: "thread-rain-without-rain",
    parentContinuationId: "continue-rain-glass-child",
    author: threadUsers.zhihan,
    content: "By noon, the room had grown a quiet river.",
    createdAt: "2026-07-14T09:06:00.000Z",
    metrics: { likes: 5, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-rain-rooftop",
    threadId: "thread-rain-without-rain",
    author: threadUsers.roma,
    content: "The rooftops lowered their voices and waited for the sky to confess.",
    createdAt: "2026-07-14T09:20:00.000Z",
    metrics: { likes: 7, continuations: 1, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-rain-rooftop-child",
    threadId: "thread-rain-without-rain",
    parentContinuationId: "continue-rain-rooftop",
    author: threadUsers.zhihan,
    content: "Under every eave, a bucket kept practicing the sky.",
    createdAt: "2026-07-14T09:34:00.000Z",
    metrics: { likes: 5, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-letter-threshold",
    threadId: "thread-unopened-letter",
    author: threadUsers.jinghe,
    content: "I have lived for weeks at the threshold of your thumb.",
    createdAt: "2026-07-14T11:04:00.000Z",
    metrics: { likes: 10, continuations: 1, shares: 2 },
    viewer: { liked: false }
  },
  {
    id: "continue-letter-threshold-child",
    threadId: "thread-unopened-letter",
    parentContinuationId: "continue-letter-threshold",
    author: threadUsers.lili,
    content: "Inside me, the ink keeps practicing your name.",
    createdAt: "2026-07-14T11:19:00.000Z",
    metrics: { likes: 6, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-letter-drawer",
    threadId: "thread-unopened-letter",
    author: threadUsers.zhihan,
    content: "The drawer is a dark post office where I never stop arriving.",
    createdAt: "2026-07-14T12:14:00.000Z",
    metrics: { likes: 4, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-city-bus",
    threadId: "thread-city-edge",
    author: threadUsers.ray,
    content: "A moth follows the route map like it knows where loneliness ends.",
    createdAt: "2026-07-13T21:22:00.000Z",
    metrics: { likes: 17, continuations: 1, shares: 3 },
    viewer: { liked: false }
  },
  {
    id: "continue-city-bus-child",
    threadId: "thread-city-edge",
    parentContinuationId: "continue-city-bus",
    author: threadUsers.roma,
    content: "At the depot, even the dark keeps a transfer ticket.",
    createdAt: "2026-07-13T21:40:00.000Z",
    metrics: { likes: 9, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-place-key",
    threadId: "thread-place-return",
    author: threadUsers.zhihan,
    content: "The old key still tastes like winter when I hold it to the light.",
    createdAt: "2026-07-13T16:44:00.000Z",
    metrics: { likes: 11, continuations: 0, shares: 1 },
    viewer: { liked: false }
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
