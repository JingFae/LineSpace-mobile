export const fontFamilies = {
  sans: "System",
  serif: "Georgia"
} as const;

export const typography = {
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700"
  },
  poemTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "500"
  },
  poemLine: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "400"
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400"
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500"
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400"
  }
} as const;
