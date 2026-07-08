import {
  HttpLineSpaceApi,
  createMockLineSpaceApi,
  type LineSpaceApi
} from "@linespace/api-client";

const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS !== "false";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const lineSpaceApi: LineSpaceApi =
  useMocks || !apiBaseUrl
    ? createMockLineSpaceApi()
    : new HttpLineSpaceApi(apiBaseUrl.replace(/\/$/, ""));
