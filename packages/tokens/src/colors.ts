export const colors = {
  canvas: "#F4F2F0",
  profileCanvas: "#F6F7F7",
  surface: "#FFFFFF",
  surfaceWarm: "#F9F6EF",
  surfaceMuted: "#F7F7F6",
  surfacePressed: "#EEEEEC",
  ink: "#151515",
  inkSoft: "#3B3937",
  muted: "#9C9995",
  profileMuted: "#949494",
  tabMuted: "#AAAAAA",
  faint: "#DCD8D3",
  line: "#E8E4DF",
  accent: "#F5324A",
  accentWarm: "#E95638",
  accentSoft: "#FFE4E0",
  liked: "#FF2E49",
  saved: "#F2C94C",
  badge: "#626262",
  badgeWarm: "#FF8624",
  success: "#63A85E",
  black: "#000000",
  white: "#FFFFFF"
} as const;

export type ColorToken = keyof typeof colors;
