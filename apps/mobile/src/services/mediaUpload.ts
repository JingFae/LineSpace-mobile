import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import type { PoemDraftMedia } from "@linespace/api-client";
import { lineSpaceApi, useMocks } from "./lineSpaceApi";

const maximumUploadBytes = 10 * 1024 * 1024;

type MediaPurpose = "avatars" | "posts";

export async function uploadPickedMedia({
  asset,
  userId,
  purpose
}: {
  asset: ImagePickerAsset;
  userId: string;
  purpose: MediaPurpose;
}): Promise<PoemDraftMedia> {
  if (asset.fileSize && asset.fileSize > maximumUploadBytes) {
    throw new Error("MEDIA_TOO_LARGE");
  }

  const isVideo = asset.type === "video";
  const prepared = isVideo || asset.mimeType === "image/gif"
    ? {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/gif")
      }
    : await prepareImage(asset, purpose === "avatars" ? 256 : 1600);

  if (isVideo && prepared.mimeType !== "video/mp4") {
    throw new Error("UNSUPPORTED_VIDEO_TYPE");
  }

  const name = purpose === "avatars"
    ? "avatar.jpg"
    : asset.fileName ?? (isVideo ? "video.mp4" : "image.jpg");
  const media: PoemDraftMedia = {
    uri: prepared.uri,
    kind: isVideo ? "video" : "image",
    name,
    width: prepared.width,
    height: prepared.height,
    mimeType: prepared.mimeType
  };

  // Mock mode intentionally remains local-only. Real HTTP mode must never
  // persist a device URI or data URL.
  if (useMocks) return media;
  if (!userId) throw new Error("AUTHENTICATION_REQUIRED");

  const size = await mediaSize(prepared.uri, asset);
  if (size !== undefined && size > maximumUploadBytes) {
    throw new Error("MEDIA_TOO_LARGE");
  }

  const extension = extensionFor(prepared.mimeType);
  const path = `${userId}/${purpose}/${Date.now()}-${randomSuffix()}.${extension}`;
  const target = await lineSpaceApi.createStorageUpload({
    bucket: "linespace-media",
    path,
    contentType: prepared.mimeType
  });
  if (!target.publicUrl || !target.publicUrl.startsWith("https://")) {
    throw new Error("PUBLIC_MEDIA_URL_UNAVAILABLE");
  }

  await uploadToSignedUrl(target.signedUrl, prepared.uri, prepared.mimeType);
  return { ...media, uri: target.publicUrl };
}

async function prepareImage(asset: ImagePickerAsset, maximumDimension: number) {
  const actions: ImageManipulator.Action[] = [];
  if (asset.width > maximumDimension || asset.height > maximumDimension) {
    actions.push(
      asset.width >= asset.height
        ? { resize: { width: maximumDimension } }
        : { resize: { height: maximumDimension } }
    );
  }
  const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: maximumDimension === 256 ? 0.7 : 0.78,
    format: ImageManipulator.SaveFormat.JPEG
  });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: "image/jpeg"
  };
}

async function mediaSize(uri: string, asset: ImagePickerAsset) {
  if (Platform.OS === "web") {
    if (asset.file && asset.uri === uri) return asset.file.size;
    return (await fetch(uri)).blob().then((blob) => blob.size);
  }
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return info.exists ? info.size : undefined;
}

async function uploadToSignedUrl(signedUrl: string, uri: string, contentType: string) {
  const headers = {
    "cache-control": "max-age=3600",
    "content-type": contentType,
    "x-upsert": "false"
  };

  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(signedUrl, {
        method: "PUT",
        headers,
        body: await blob.arrayBuffer(),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`MEDIA_UPLOAD_FAILED_${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
    return;
  }

  const response = await FileSystem.uploadAsync(signedUrl, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`MEDIA_UPLOAD_FAILED_${response.status}`);
  }
}

function extensionFor(contentType: string) {
  switch (contentType) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "video/mp4": return "mp4";
    default: return "jpg";
  }
}

function randomSuffix() {
  const runtimeCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return (runtimeCrypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 36);
}

export function mediaUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "MEDIA_TOO_LARGE") return "Please choose media smaller than 10 MB.";
  if (message === "UNSUPPORTED_VIDEO_TYPE") return "Only MP4 videos can be uploaded.";
  if (message === "AUTHENTICATION_REQUIRED") return "Please sign in before uploading media.";
  return "The media upload failed. Check your connection and try again.";
}
