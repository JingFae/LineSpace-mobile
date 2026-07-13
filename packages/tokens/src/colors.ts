export const colors = {
  canvas: "#F4F2F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F7F7F6",
  surfacePressed: "#EEEEEC",
  ink: "#151515",
  inkSoft: "#3B3937",
  muted: "#9C9995",
  faint: "#DCD8D3",
  line: "#E8E4DF",
  accent: "#F5324A",
  accentWarm: "#E95638",
  accentSoft: "#FFE4E0",
  liked: "#FF2E49",
  saved: "#F2C94C",
  success: "#63A85E",
  black: "#000000",
  white: "#FFFFFF"
} as const;

export type ColorToken = keyof typeof colors;
