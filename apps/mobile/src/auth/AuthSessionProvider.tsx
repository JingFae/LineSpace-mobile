import {
  AuthClientError,
  HttpAuthClient,
  type AuthRegistrationResult,
  type AuthSession,
  type AuthSessionResult,
  type AuthUser,
  type LoginAuthInput,
  type RegisterAuthInput
} from "@linespace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { colors } from "@linespace/tokens";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { mockUsers } from "@linespace/api-client";
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  storeRefreshToken
} from "./authStorage";
import { getAccessToken, refreshAccessToken, setAccessToken, setRefreshHandler } from "./session-store";
import { setCurrentUserId, useMocks } from "@/services/lineSpaceApi";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  register: (input: RegisterAuthInput) => Promise<AuthRegistrationResult>;
  login: (input: LoginAuthInput) => Promise<AuthSessionResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  completeEmailConfirmation: (session: AuthSession) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authClientRef = useRef<HttpAuthClient | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);

  if (!useMocks && !authClientRef.current) {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (baseUrl) authClientRef.current = new HttpAuthClient(baseUrl.replace(/\/$/, ""));
  }

  const clearSession = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
    setAccessToken(null);
    setAccessTokenState(null);
    setUser(null);
    setCurrentUserId(null);
    sessionUserIdRef.current = null;
    setStatus("unauthenticated");
    await clearStoredRefreshToken();
    queryClient.clear();
  }, [queryClient]);

  const applySession = useCallback(async (result: AuthSessionResult) => {
    if (!useMocks) {
      try {
        await storeRefreshToken(result.session.refreshToken);
      } catch {
        await clearStoredRefreshToken();
        setAccessToken(null);
        setAccessTokenState(null);
        setUser(null);
        setCurrentUserId(null);
        sessionUserIdRef.current = null;
        setStatus("unauthenticated");
        queryClient.clear();
        throw new Error("Authentication is temporarily unavailable.");
      }
    }
    if (sessionUserIdRef.current !== result.user.id) {
      queryClient.clear();
    }
    sessionUserIdRef.current = result.user.id;
    setAccessToken(result.session.accessToken);
    setAccessTokenState(result.session.accessToken);
    setUser(result.user);
    setCurrentUserId(result.user.id);
    setStatus("authenticated");
    if (!useMocks) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const refreshInMs = Math.max(
        1_000,
        Math.min(2_147_000_000, result.session.expiresAt * 1_000 - Date.now() - 60_000)
      );
      refreshTimerRef.current = setTimeout(() => {
        void refreshAccessToken();
      }, refreshInMs);
    }
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const promise = (async () => {
      if (useMocks) {
        const mockUser = createMockAuthUser();
        setUser(mockUser);
        setCurrentUserId(mockUser.id);
        setStatus("authenticated");
        return true;
      }

      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken || !authClientRef.current) {
        await clearSession();
        return false;
      }

      try {
        const result = await authClientRef.current.refresh(refreshToken);
        await applySession(result);
        return true;
      } catch {
        await clearSession();
        return false;
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    refreshPromiseRef.current = promise;
    return promise;
  }, [applySession, clearSession]);

  useEffect(() => {
    setRefreshHandler(async () => {
      const restored = await refreshSession();
      return restored ? getAccessToken() : null;
    });
    void refreshSession();
    return () => {
      setRefreshHandler(null);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refreshSession]);

  const login = useCallback(async (input: LoginAuthInput) => {
    if (useMocks) {
      const result = mockSessionResult();
      await applySession(result);
      return result;
    }
    if (!authClientRef.current) throw new Error("Authentication is temporarily unavailable.");
    try {
      const result = await authClientRef.current.login(input);
      await applySession(result);
      return result;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }, [applySession]);

  const register = useCallback(async (input: RegisterAuthInput) => {
    if (useMocks) {
      const result = mockSessionResult();
      await applySession(result);
      return { ...result, emailConfirmationRequired: false };
    }
    if (!authClientRef.current) throw new Error("Authentication is temporarily unavailable.");
    try {
      const result = await authClientRef.current.register(input);
      if (result.session) {
        await applySession({ user: result.user, session: result.session });
      } else {
        await clearSession();
      }
      return result;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }, [applySession, clearSession]);

  const completeEmailConfirmation = useCallback(async (session: AuthSession) => {
    if (useMocks) return true;
    if (!authClientRef.current) return false;
    try {
      const confirmedUser = await authClientRef.current.me(session.accessToken);
      await applySession({ user: confirmedUser, session });
      return true;
    } catch {
      await clearSession();
      return false;
    }
  }, [applySession, clearSession]);

  const logout = useCallback(async () => {
    const token = getAccessToken();
    try {
      if (!useMocks && token && authClientRef.current) {
        await authClientRef.current.logout(token);
      }
    } catch {
      // Local cleanup is mandatory even if the server is unavailable.
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      register,
      login,
      logout,
      refreshSession,
      completeEmailConfirmation
    }),
    [accessToken, completeEmailConfirmation, login, logout, refreshSession, register, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthSessionProvider.");
  return context;
}

export function AuthLoadingScreen() {
  return (
    <View style={styles.loading} accessibilityLabel="Loading your session">
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>Opening LineSpace...</Text>
    </View>
  );
}

function createMockAuthUser(): AuthUser {
  const id = process.env.EXPO_PUBLIC_CURRENT_USER_ID ?? "user-lili";
  const profile = mockUsers.find((candidate) => candidate.id === id) ?? mockUsers[0]!;
  return {
    id: profile.id,
    authUserId: profile.id,
    username: profile.handle,
    email: `${profile.handle}@example.com`,
    displayName: profile.displayName,
    emailConfirmed: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}

function mockSessionResult(): AuthSessionResult {
  return {
    user: createMockAuthUser(),
    session: {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      expiresIn: 3600,
      tokenType: "bearer"
    }
  };
}

function normalizeAuthError(error: unknown) {
  if (error instanceof AuthClientError) return error;
  return new Error("Authentication is temporarily unavailable.");
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F2F0",
    gap: 10
  },
  loadingText: { color: colors.profileMuted, fontSize: 14 }
});
