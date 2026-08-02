import { useEffect, useState } from "react";
import {
  Image,
  type ImageProps,
  type ImageSourcePropType
} from "react-native";

type FallbackImageProps = ImageProps & {
  fallbackSource?: ImageSourcePropType;
};

/** Uses the durable original asset if a derived thumbnail cannot be loaded. */
export function FallbackImage({
  fallbackSource,
  onError,
  source,
  ...props
}: FallbackImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const primaryKey = imageSourceKey(source);
  const effectiveFallbackSource =
    fallbackSource ?? supabaseOriginalSource(source);

  useEffect(() => {
    setUseFallback(false);
  }, [primaryKey]);

  return (
    <Image
      {...props}
      onError={(event) => {
        if (!useFallback && effectiveFallbackSource) {
          setUseFallback(true);
          return;
        }
        onError?.(event);
      }}
      source={
        useFallback && effectiveFallbackSource
          ? effectiveFallbackSource
          : source
      }
    />
  );
}

function imageSourceKey(source: ImageSourcePropType | undefined) {
  if (!source) return "";
  if (typeof source === "number") return String(source);
  if (Array.isArray(source)) {
    return source.map((item) => item.uri ?? "").join("|");
  }
  return source.uri ?? "";
}

function supabaseOriginalSource(
  source: ImageSourcePropType | undefined
): ImageSourcePropType | undefined {
  if (!source || typeof source === "number" || Array.isArray(source) || !source.uri) {
    return undefined;
  }

  try {
    const url = new URL(source.uri);
    const renderPath = "/storage/v1/render/image/public/";
    if (!url.pathname.includes(renderPath)) return undefined;
    url.pathname = url.pathname.replace(
      renderPath,
      "/storage/v1/object/public/"
    );
    url.searchParams.delete("width");
    url.searchParams.delete("height");
    url.searchParams.delete("quality");
    url.searchParams.delete("resize");
    return { ...source, uri: url.toString() };
  } catch {
    return undefined;
  }
}
