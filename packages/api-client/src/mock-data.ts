import type {
  PoemDesignCatalog,
  InboxActivitySummary,
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

export const mockInboxActivitySummaries: Record<string, InboxActivitySummary> = {
  "user-lili": {
    userId: "user-lili",
    unread: {
      comments: 132,
      likes: 99,
      thread: 10
    },
    totals: {
      comments: 132,
      likes: 590,
      thread: 10
    },
    recent: {
      comments: [
        {
          id: "comment-jinghe-moon-image",
          kind: "comments",
          actor: {
            id: "user-jinghe",
            handle: "jinghe",
            displayName: "Jinghe",
            avatarColor: "#7AA0DD"
          },
          target: {
            kind: "comment",
            title: "light",
            excerpt: "Can I quote the moon image in my reply?",
            poemId: "poem-light",
            commentId: "comment-jinghe-floors"
          },
          dateLabel: "Yesterday",
          unread: true
        },
        {
          id: "comment-zhihan-autofill",
          kind: "comments",
          actor: {
            id: "user-zhihan",
            handle: "zhihan",
            displayName: "Zhihan",
            avatarColor: "#0B75DE"
          },
          target: {
            kind: "post",
            title: "light",
            excerpt: "Your draft feels warmer after the second stanza.",
            poemId: "poem-light"
          },
          dateLabel: "12:10",
          unread: true
        }
      ],
      likes: [
        {
          id: "like-lili-summer",
          kind: "likes",
          actor: mockUsers[0]!,
          target: {
            kind: "post",
            title: "summer",
            excerpt: "summer folded into rain",
            poemId: "poem-light"
          },
          dateLabel: "03/09",
          unread: true
        },
        {
          id: "like-zhihan-older",
          kind: "likes",
          actor: {
            id: "user-zhihan",
            handle: "zhihan",
            displayName: "Zhihan",
            avatarColor: "#0B75DE"
          },
          target: {
            kind: "comment",
            title: "older",
            excerpt: "older light, softer room",
            poemId: "poem-light",
            commentId: "comment-zhihan-autofill"
          },
          dateLabel: "02/19"
        }
      ],
      thread: [
        {
          id: "thread-ray-light",
          kind: "thread",
          actor: mockUsers[1]!,
          target: {
            kind: "thread",
            title: "light",
            excerpt: "Ray continued your relay with a new stanza.",
            poemId: "poem-light",
            threadId: "thread-rain-without-rain"
          },
          dateLabel: "14:28",
          unread: true
        },
        {
          id: "thread-lili-orbit",
          kind: "thread",
          actor: mockUsers[0]!,
          target: {
            kind: "thread",
            title: "orbit",
            excerpt: "Lili added a continuation to your shared thread.",
            poemId: "poem-orbit",
            threadId: "thread-unopened-letter"
          },
          dateLabel: "8/29",
          unread: true
        }
      ]
    }
  },
  "user-ray": {
    userId: "user-ray",
    unread: {
      comments: 31,
      likes: 18,
      thread: 2
    },
    totals: {
      comments: 31,
      likes: 274,
      thread: 2
    },
    recent: {
      comments: [],
      likes: [],
      thread: []
    }
  }
};

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
      threads: 12,
      comments: 42,
      saves: 29
    },
    visibility: { posts: true, threads: true, comments: true, saves: true }
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
      threads: 6,
      comments: 31,
      saves: 18
    },
    visibility: { posts: true, threads: true, comments: true, saves: true }
  }
];

const profilePost = (
  id: string,
  highlightCount: number,
  overrides: Partial<UserProfileContentItem> = {}
): UserProfileContentItem => ({
  id,
  kind: "post",
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
    threads: [
      profilePost("profile-thread-started", 14, {
        kind: "thread",
        threadId: "thread-city-edge",
        title: "thread started by Lili",
        excerpt: "The first line waits for a stranger to answer.",
        threadRelation: "started"
      }),
      profilePost("profile-thread-joined", 8, {
        kind: "thread",
        threadId: "thread-rain-without-rain",
        title: "thread joined by Lili",
        excerpt: "A continuation can change the temperature of a room.",
        threadRelation: "participated"
      })
    ],
    comments: [
      profilePost("profile-comment-1", 22, {
        kind: "comment",
        commentId: "comment-lili-childhood",
        title: "A quiet revision",
        excerpt: "The maps insisted I had lived there once.",
        reference: { kind: "post", text: "Remembered" }
      }),
      profilePost("profile-comment-2", 18, {
        kind: "comment",
        commentId: "comment-lili-reply",
        title: "Between floors",
        excerpt: "It stopped between floors.",
        reference: { kind: "comment", text: "Can I quote the moon image in my reply?" }
      })
    ],
    saves: [
      profilePost("profile-like-post-1", 11, { collection: "liked", kind: "post", title: "Remembered" }),
      profilePost("profile-like-thread-1", 8, { collection: "liked", kind: "thread", threadId: "thread-unopened-letter", title: "thread · unopened letter", excerpt: "The letter stayed open on the table." }),
      profilePost("profile-like-comment-1", 5, { collection: "liked", kind: "comment", poemId: "poem-light", commentId: "comment-jinghe-floors", title: "comment · Between floors", excerpt: "It stopped between floors.", reference: { kind: "post", text: "light" } }),
      profilePost("profile-save-1", 11, { collection: "saved", kind: "post" }),
      profilePost("profile-save-2", 8, {
        collection: "saved",
        kind: "post",
        title: "orbit",
        poemId: "poem-orbit",
        excerpt: "The city hummed below its own reflection.",
        tags: ["night", "city", "shared"]
      })
    ]
  },
  "user-ray": {
    posts: [profilePost("ray-profile-post-1", 5, { poemId: "poem-cedar" })],
    threads: [],
    comments: [],
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
  },
  {
    id: "thread-moon-receipt",
    author: threadUsers.zhihan,
    content: "Write a receipt from the moon for everything it borrowed from the sea.",
    createdAt: "2026-07-14T13:05:00.000Z",
    community: "Night Ledger",
    topic: "prompt",
    status: "open",
    metrics: { likes: 35, continuations: 5, shares: 7, views: 1100 },
    viewer: { liked: false }
  },
  {
    id: "thread-library-breath",
    author: threadUsers.lili,
    content: "Begin with a library holding its breath after the last reader leaves.",
    createdAt: "2026-07-14T12:22:00.000Z",
    community: "Quiet Rooms",
    topic: "open line",
    status: "open",
    metrics: { likes: 22, continuations: 1, shares: 3, views: 720 },
    viewer: { liked: false }
  },
  {
    id: "thread-shadow-names",
    author: threadUsers.ray,
    content: "Give every shadow in the room a name, then let one of them answer.",
    createdAt: "2026-07-14T07:46:00.000Z",
    community: "Small Hauntings",
    topic: "prompt",
    status: "open",
    metrics: { likes: 14, continuations: 0, shares: 1, views: 310 },
    viewer: { liked: false }
  },
  {
    id: "thread-lost-map",
    author: threadUsers.jinghe,
    content: "Continue this: The map was wrong, but it was wrong in my mother's handwriting.",
    createdAt: "2026-07-13T19:18:00.000Z",
    community: "Memory Atlas",
    topic: "chain",
    status: "open",
    metrics: { likes: 44, continuations: 2, shares: 9, views: 1500 },
    viewer: { liked: true }
  },
  {
    id: "thread-orchard-static",
    author: threadUsers.roma,
    content: "Write a poem where an old radio becomes an orchard.",
    createdAt: "2026-07-13T14:42:00.000Z",
    community: "Object Weather",
    topic: "prompt",
    status: "open",
    metrics: { likes: 27, continuations: 4, shares: 4, views: 880 },
    viewer: { liked: false }
  },
  {
    id: "thread-window-plant",
    author: threadUsers.lili,
    content: "A window plant outgrows the apartment. What does it see first?",
    createdAt: "2026-07-13T12:03:00.000Z",
    community: "Green Rooms",
    topic: "prompt",
    status: "open",
    metrics: { likes: 12, continuations: 0, shares: 1, views: 290 },
    viewer: { liked: false }
  },
  {
    id: "thread-elevator-music",
    author: threadUsers.ray,
    content: "Write from inside an elevator song that has carried strangers for years.",
    createdAt: "2026-07-12T22:31:00.000Z",
    community: "Public Interior",
    topic: "voice",
    status: "open",
    metrics: { likes: 31, continuations: 3, shares: 6, views: 1040 },
    viewer: { liked: false }
  },
  {
    id: "thread-salt-lamp",
    author: threadUsers.zhihan,
    content: "Use one line to make a salt lamp remember the ocean.",
    createdAt: "2026-07-12T20:16:00.000Z",
    community: "Object Weather",
    topic: "short form",
    status: "open",
    metrics: { likes: 18, continuations: 1, shares: 2, views: 520 },
    viewer: { liked: false }
  },
  {
    id: "thread-after-image",
    author: threadUsers.jinghe,
    content: "Describe an afterimage without saying what was looked at.",
    createdAt: "2026-07-12T18:28:00.000Z",
    community: "Light Studies",
    topic: "prompt",
    status: "open",
    metrics: { likes: 16, continuations: 0, shares: 0, views: 410 },
    viewer: { liked: false }
  },
  {
    id: "thread-train-platform",
    author: threadUsers.lili,
    content: "Continue this platform announcement until it becomes a goodbye.",
    createdAt: "2026-07-12T15:49:00.000Z",
    community: "Transit Poems",
    topic: "chain",
    status: "open",
    metrics: { likes: 39, continuations: 2, shares: 8, views: 1320 },
    viewer: { liked: false }
  },
  {
    id: "thread-coffee-cup",
    author: threadUsers.roma,
    content: "The coffee cup knows who held it last. Let it speak carefully.",
    createdAt: "2026-07-12T11:37:00.000Z",
    community: "Table Objects",
    topic: "voice",
    status: "open",
    metrics: { likes: 21, continuations: 1, shares: 4, views: 600 },
    viewer: { liked: false }
  },
  {
    id: "thread-sea-address",
    author: threadUsers.ray,
    content: "Write a change-of-address form for someone moving from land to sea.",
    createdAt: "2026-07-11T23:58:00.000Z",
    community: "Salt Letters",
    topic: "prompt",
    status: "open",
    metrics: { likes: 51, continuations: 3, shares: 11, views: 1750 },
    viewer: { liked: true }
  },
  {
    id: "thread-museum-bench",
    author: threadUsers.zhihan,
    content: "A museum bench has heard every painting misunderstood. Begin there.",
    createdAt: "2026-07-11T18:26:00.000Z",
    community: "Gallery Hours",
    topic: "open line",
    status: "open",
    metrics: { likes: 9, continuations: 0, shares: 1, views: 260 },
    viewer: { liked: false }
  },
  {
    id: "thread-blue-hour",
    author: threadUsers.jinghe,
    content: "At blue hour, every window rehearses being water. Continue the scene.",
    createdAt: "2026-07-11T17:12:00.000Z",
    community: "Light Studies",
    topic: "chain",
    status: "open",
    metrics: { likes: 26, continuations: 2, shares: 5, views: 790 },
    viewer: { liked: false }
  },
  {
    id: "thread-pocket-stone",
    author: threadUsers.roma,
    content: "A stone kept in a coat pocket crosses the city all winter. What changes?",
    createdAt: "2026-07-11T10:08:00.000Z",
    community: "Small Objects",
    topic: "prompt",
    status: "open",
    metrics: { likes: 17, continuations: 1, shares: 2, views: 470 },
    viewer: { liked: false }
  },
  {
    id: "thread-radio-snow",
    author: threadUsers.lili,
    content: "Make radio static sound like snow arriving before the weather report.",
    createdAt: "2026-07-10T22:42:00.000Z",
    community: "Signal House",
    topic: "sound",
    status: "open",
    metrics: { likes: 13, continuations: 0, shares: 0, views: 330 },
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
  },
  {
    id: "continue-rain-gutter",
    threadId: "thread-rain-without-rain",
    author: threadUsers.jinghe,
    content: "In the gutter, small mirrors kept breaking into sky.",
    createdAt: "2026-07-14T09:55:00.000Z",
    metrics: { likes: 6, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-letter-stamp",
    threadId: "thread-unopened-letter",
    author: threadUsers.roma,
    content: "My stamp is a small country refusing to let go.",
    createdAt: "2026-07-14T12:39:00.000Z",
    metrics: { likes: 8, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-city-platform",
    threadId: "thread-city-edge",
    author: threadUsers.zhihan,
    content: "The platform lights blinked like commas in a sentence nobody finished.",
    createdAt: "2026-07-13T22:05:00.000Z",
    metrics: { likes: 10, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-city-window",
    threadId: "thread-city-edge",
    author: threadUsers.lili,
    content: "Above the bakery, one window stayed awake for the whole block.",
    createdAt: "2026-07-13T22:18:00.000Z",
    metrics: { likes: 7, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-place-calendar",
    threadId: "thread-place-return",
    author: threadUsers.ray,
    content: "The calendar on the wall still opens to a month that knows me.",
    createdAt: "2026-07-13T17:06:00.000Z",
    metrics: { likes: 6, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-moon-tide",
    threadId: "thread-moon-receipt",
    author: threadUsers.lili,
    content: "One silver tide, borrowed nightly, returned in trembling coins.",
    createdAt: "2026-07-14T13:18:00.000Z",
    metrics: { likes: 14, continuations: 1, shares: 2 },
    viewer: { liked: false }
  },
  {
    id: "continue-moon-tide-child",
    threadId: "thread-moon-receipt",
    parentContinuationId: "continue-moon-tide",
    author: threadUsers.ray,
    content: "The waves signed every line with disappearing hands.",
    createdAt: "2026-07-14T13:29:00.000Z",
    metrics: { likes: 8, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-moon-crater",
    threadId: "thread-moon-receipt",
    author: threadUsers.roma,
    content: "For each crater: one bowl of darkness, carefully itemized.",
    createdAt: "2026-07-14T13:44:00.000Z",
    metrics: { likes: 11, continuations: 1, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-moon-crater-child",
    threadId: "thread-moon-receipt",
    parentContinuationId: "continue-moon-crater",
    author: threadUsers.zhihan,
    content: "Even the dust kept a carbon copy of the fall.",
    createdAt: "2026-07-14T13:58:00.000Z",
    metrics: { likes: 5, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-moon-suitcase",
    threadId: "thread-moon-receipt",
    author: threadUsers.jinghe,
    content: "A suitcase of reflected doors, payable before dawn.",
    createdAt: "2026-07-14T14:10:00.000Z",
    metrics: { likes: 9, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-library-lamp",
    threadId: "thread-library-breath",
    author: threadUsers.roma,
    content: "The green lamps lowered their voices until dust became grammar.",
    createdAt: "2026-07-14T12:48:00.000Z",
    metrics: { likes: 7, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-map-margin",
    threadId: "thread-lost-map",
    author: threadUsers.lili,
    content: "Every margin led home by refusing the road.",
    createdAt: "2026-07-13T19:41:00.000Z",
    metrics: { likes: 13, continuations: 0, shares: 2 },
    viewer: { liked: false }
  },
  {
    id: "continue-map-fold",
    threadId: "thread-lost-map",
    author: threadUsers.ray,
    content: "At the fold, a river crossed itself and apologized.",
    createdAt: "2026-07-13T19:59:00.000Z",
    metrics: { likes: 9, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-orchard-dial",
    threadId: "thread-orchard-static",
    author: threadUsers.zhihan,
    content: "Between stations, apples clicked softly into being.",
    createdAt: "2026-07-13T15:02:00.000Z",
    metrics: { likes: 10, continuations: 1, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-orchard-dial-child",
    threadId: "thread-orchard-static",
    parentContinuationId: "continue-orchard-dial",
    author: threadUsers.jinghe,
    content: "The antenna lifted a branch toward weather it could not hear.",
    createdAt: "2026-07-13T15:17:00.000Z",
    metrics: { likes: 6, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-orchard-battery",
    threadId: "thread-orchard-static",
    author: threadUsers.ray,
    content: "Dead batteries slept under roots like black seeds.",
    createdAt: "2026-07-13T15:35:00.000Z",
    metrics: { likes: 8, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-orchard-weather",
    threadId: "thread-orchard-static",
    author: threadUsers.lili,
    content: "Forecasts ripened there, green first, then full of thunder.",
    createdAt: "2026-07-13T15:52:00.000Z",
    metrics: { likes: 5, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-elevator-button",
    threadId: "thread-elevator-music",
    author: threadUsers.jinghe,
    content: "Every button glowed with a floor someone was afraid to choose.",
    createdAt: "2026-07-12T22:48:00.000Z",
    metrics: { likes: 12, continuations: 1, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-elevator-button-child",
    threadId: "thread-elevator-music",
    parentContinuationId: "continue-elevator-button",
    author: threadUsers.roma,
    content: "The song rose anyway, polite as fluorescent weather.",
    createdAt: "2026-07-12T22:59:00.000Z",
    metrics: { likes: 7, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-elevator-door",
    threadId: "thread-elevator-music",
    author: threadUsers.zhihan,
    content: "Doors opened to the same hallway wearing different shoes.",
    createdAt: "2026-07-12T23:12:00.000Z",
    metrics: { likes: 6, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-salt-lamp",
    threadId: "thread-salt-lamp",
    author: threadUsers.lili,
    content: "Inside its amber room, waves kept kneeling into light.",
    createdAt: "2026-07-12T20:40:00.000Z",
    metrics: { likes: 9, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-train-speaker",
    threadId: "thread-train-platform",
    author: threadUsers.ray,
    content: "The speaker cleared its throat and became my father's coat.",
    createdAt: "2026-07-12T16:02:00.000Z",
    metrics: { likes: 15, continuations: 0, shares: 2 },
    viewer: { liked: false }
  },
  {
    id: "continue-train-bench",
    threadId: "thread-train-platform",
    author: threadUsers.roma,
    content: "On the bench, a forgotten glove waved from another winter.",
    createdAt: "2026-07-12T16:17:00.000Z",
    metrics: { likes: 8, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-coffee-handle",
    threadId: "thread-coffee-cup",
    author: threadUsers.zhihan,
    content: "The handle remembered pressure better than names.",
    createdAt: "2026-07-12T11:52:00.000Z",
    metrics: { likes: 10, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-sea-forward",
    threadId: "thread-sea-address",
    author: threadUsers.jinghe,
    content: "Forward my mail to the reef where blue repeats itself.",
    createdAt: "2026-07-12T00:20:00.000Z",
    metrics: { likes: 18, continuations: 1, shares: 3 },
    viewer: { liked: false }
  },
  {
    id: "continue-sea-forward-child",
    threadId: "thread-sea-address",
    parentContinuationId: "continue-sea-forward",
    author: threadUsers.lili,
    content: "If I am not home, leave the envelope with the foam.",
    createdAt: "2026-07-12T00:33:00.000Z",
    metrics: { likes: 9, continuations: 0, shares: 1 },
    viewer: { liked: false }
  },
  {
    id: "continue-sea-zip",
    threadId: "thread-sea-address",
    author: threadUsers.roma,
    content: "My new zip code is a gull turning once above the pier.",
    createdAt: "2026-07-12T00:46:00.000Z",
    metrics: { likes: 7, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-blue-window",
    threadId: "thread-blue-hour",
    author: threadUsers.ray,
    content: "Each pane held its breath until the streetlights learned to float.",
    createdAt: "2026-07-11T17:29:00.000Z",
    metrics: { likes: 12, continuations: 0, shares: 2 },
    viewer: { liked: false }
  },
  {
    id: "continue-blue-sink",
    threadId: "thread-blue-hour",
    author: threadUsers.lili,
    content: "In the kitchen sink, a teaspoon carried the whole evening.",
    createdAt: "2026-07-11T17:45:00.000Z",
    metrics: { likes: 8, continuations: 0, shares: 0 },
    viewer: { liked: false }
  },
  {
    id: "continue-pocket-stone",
    threadId: "thread-pocket-stone",
    author: threadUsers.jinghe,
    content: "By March, it knew the shape of every unsent hand.",
    createdAt: "2026-07-11T10:24:00.000Z",
    metrics: { likes: 6, continuations: 0, shares: 0 },
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
