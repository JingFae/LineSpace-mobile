import {
  HttpLineSpaceApi,
  createMockLineSpaceApi,
  type LineSpaceApi
} from "@linespace/api-client";

const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS !== "false";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

// Replaced by the authenticated session user once auth is connected.
export const currentUserId = process.env.EXPO_PUBLIC_CURRENT_USER_ID ?? "user-lili";

export const lineSpaceApi: LineSpaceApi =
  useMocks || !apiBaseUrl
    ? createMockLineSpaceApi()
    : new HttpLineSpaceApi(apiBaseUrl.replace(/\/$/, ""));
