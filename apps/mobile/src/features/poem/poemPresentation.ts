import type {
  PoemBackgroundId,
  PoemDraftMedia,
  PoemStickerId,
  PoemSummary,
  PoemTypographyId
} from "@linespace/api-client";
import type { ImageSourcePropType } from "react-native";

export type PoemLayoutPresentation = {
  backgroundRole:
    | "ruled"
    | "kraft"
    | "postcard"
    | "dark"
    | "rice"
    | "grid"
    | "blush"
    | "museum";
  typographyRole: "serif" | "script" | "sans" | "editorial" | "rounded" | "mono";
  stickerSymbols: string[];
  mediaSource?: ImageSourcePropType;
  mediaFallbackSource?: ImageSourcePropType;
  mediaAspectRatio?: number;
};

const backgroundRoles: Record<
  PoemBackgroundId,
  PoemLayoutPresentation["backgroundRole"]
> = {
  "letter-paper": "ruled",
  "kraft-paper": "kraft",
  postcard: "postcard",
  midnight: "dark",
  "rice-paper": "rice",
  "graph-paper": "grid",
  "blush-paper": "blush",
  "museum-card": "museum"
};

const typographyRoles: Record<
  PoemTypographyId,
  PoemLayoutPresentation["typographyRole"]
> = {
  "literary-serif": "serif",
  handwritten: "script",
  "clean-sans": "sans",
  "songti-editorial": "editorial",
  "humanist-sans": "sans",
  "rounded-sans": "rounded",
  "mono-notes": "mono"
};

const stickerSymbols: Record<PoemStickerId, string> = {
  botanical: "❦",
  moon: "☾",
  postmark: "\u2709",
  "pressed-flower": "\u2740",
  paperclip: "\u2318",
  asterism: "\u2726",
  washi: "\u25B0"
};

export function getPoemLayoutPresentation(
  poem: Pick<PoemSummary, "layout" | "media">,
  options: { preferThumbnail?: boolean } = {}
): PoemLayoutPresentation | undefined {
  if (!poem.layout) return undefined;

  const originalMediaUri = poem.media?.kind === "image" ? poem.media.uri : undefined;
  const thumbnailUri =
    options.preferThumbnail && poem.media?.kind === "image"
      ? poem.media.thumbnailUri
      : undefined;

  return {
    backgroundRole: backgroundRoles[poem.layout.backgroundId],
    typographyRole: typographyRoles[poem.layout.typographyId],
    stickerSymbols: poem.layout.stickerIds.map((id) => stickerSymbols[id]),
    mediaSource: thumbnailUri
      ? { uri: thumbnailUri }
      : originalMediaUri
        ? { uri: originalMediaUri }
        : undefined,
    mediaFallbackSource:
      thumbnailUri && originalMediaUri && thumbnailUri !== originalMediaUri
        ? { uri: originalMediaUri }
        : undefined,
    mediaAspectRatio: getMediaAspectRatio(poem.media)
  };
}

export function getMediaAspectRatio(
  media: Pick<PoemDraftMedia, "width" | "height"> | undefined
) {
  if (!media?.width || !media.height || media.width <= 0 || media.height <= 0) {
    return undefined;
  }

  return media.width / media.height;
}
