import {
  HttpLineSpaceApi,
  createMockLineSpaceApi,
  type LineSpaceApi
} from "@linespace/api-client";
import { getAccessToken, refreshAccessToken, setAccessToken } from "@/auth/session-store";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

// Mock data is an explicit development choice. Missing deployment variables
// must never silently authenticate the fixed Lili account in a production Web
// build, because that hides a broken real-data configuration.
export const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS === "true";

if (!useMocks && !apiBaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is required when EXPO_PUBLIC_USE_MOCKS is not true."
  );
}

// Mock mode keeps its existing development identity. HTTP mode is populated only
// from the authenticated session and never from EXPO_PUBLIC_CURRENT_USER_ID.
export let currentUserId = useMocks
  ? process.env.EXPO_PUBLIC_CURRENT_USER_ID ?? "user-lili"
  : "";

export function setCurrentUserId(userId: string | null) {
  currentUserId = useMocks
    ? process.env.EXPO_PUBLIC_CURRENT_USER_ID ?? "user-lili"
    : userId ?? "";
}

export const lineSpaceApi: LineSpaceApi =
  useMocks
    ? createMockLineSpaceApi()
    : new HttpLineSpaceApi(apiBaseUrl!.replace(/\/$/, ""), {
        getAccessToken,
        refreshAccessToken,
        onRefreshFailure: () => setAccessToken(null)
      });
