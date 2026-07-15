import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const refreshTokenKey = "linespace.auth.refresh-token";

/**
 * Refresh tokens are kept in the OS keychain on native. Web uses sessionStorage
 * deliberately: it survives reloads in the current tab but is cleared when the
 * browsing session ends. It remains exposed to XSS and should be paired with a
 * strong CSP in production.
 */
export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(refreshTokenKey);
    }
    return (await SecureStore.getItemAsync(refreshTokenKey)) ?? null;
  } catch {
    return null;
  }
}

export async function storeRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.sessionStorage.setItem(refreshTokenKey, refreshToken);
      return;
    }
    await SecureStore.setItemAsync(refreshTokenKey, refreshToken, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
    });
  } catch {
    // A failed write must not leave a partial in-memory session behind.
    throw new Error("Secure session storage is unavailable.");
  }
}

export async function clearStoredRefreshToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(refreshTokenKey);
      return;
    }
    await SecureStore.deleteItemAsync(refreshTokenKey);
  } catch {
    // Clearing is best effort; callers still clear memory and navigate away.
  }
}

