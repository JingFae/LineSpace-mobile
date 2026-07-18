import type {
  PoemBackgroundId,
  PoemDraftMedia,
  PoemStickerId,
  PoemSummary,
  PoemTypographyId
} from "@linespace/api-client";
import type { ImageSourcePropType } from "react-native";

export type PoemLayoutPresentation = {
  backgroundRole: "ruled" | "kraft" | "postcard" | "dark";
  typographyRole: "serif" | "script" | "sans";
  stickerSymbols: string[];
  mediaSource?: ImageSourcePropType;
  mediaAspectRatio?: number;
};

const backgroundRoles: Record<
  PoemBackgroundId,
  PoemLayoutPresentation["backgroundRole"]
> = {
  "letter-paper": "ruled",
  "kraft-paper": "kraft",
  postcard: "postcard",
  midnight: "dark"
};

const typographyRoles: Record<
  PoemTypographyId,
  PoemLayoutPresentation["typographyRole"]
> = {
  "literary-serif": "serif",
  handwritten: "script",
  "clean-sans": "sans"
};

const stickerSymbols: Record<PoemStickerId, string> = {
  botanical: "❦",
  moon: "☾",
  postmark: "✦"
};

export function getPoemLayoutPresentation(
  poem: Pick<PoemSummary, "layout" | "media">
): PoemLayoutPresentation | undefined {
  if (!poem.layout) return undefined;

  return {
    backgroundRole: backgroundRoles[poem.layout.backgroundId],
    typographyRole: typographyRoles[poem.layout.typographyId],
    stickerSymbols: poem.layout.stickerIds.map((id) => stickerSymbols[id]),
    mediaSource:
      poem.media?.kind === "image" ? { uri: poem.media.uri } : undefined,
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
