import type { AuthService } from "./service.js";
import { authErrorResponse } from "./errors.js";
import { getServerAuthService } from "./supabase-auth-service.js";
import type { ProfileRepository } from "../database/profile-repository.js";
import {
  parseBearerToken,
  parseLogin,
  parseRefreshToken,
  parseRegistration
} from "./validation.js";

export type AuthRouteResponse = {
  status: number;
  body: unknown;
};

export type AuthRequestContext = {
  authorization?: string;
  authService?: AuthService;
  /**
   * Optional request-scoped user-domain repository. Production requests use
   * the JWT-bound Supabase repository; tests can inject a deterministic fake.
   */
  profileRepository?: ProfileRepository;
};

export async function handleAuthRoute(
  method: string,
  pathname: string,
  body: unknown,
  context: AuthRequestContext
): Promise<AuthRouteResponse | null> {
  if (!pathname.startsWith("/v1/auth/")) return null;

  try {
    const service = () => context.authService ?? getServerAuthService();

    if (method === "POST" && pathname === "/v1/auth/register") {
      const input = parseRegistration(body);
      return { status: 201, body: await service().register(input) };
    }

    if (method === "POST" && pathname === "/v1/auth/login") {
      const input = parseLogin(body);
      return { status: 200, body: await service().login(input) };
    }

    if (method === "POST" && pathname === "/v1/auth/refresh") {
      const refreshToken = parseRefreshToken(body);
      return { status: 200, body: await service().refresh(refreshToken) };
    }

    if (method === "POST" && pathname === "/v1/auth/logout") {
      const accessToken = parseBearerToken(context.authorization);
      await service().logout(accessToken);
      return { status: 204, body: null };
    }

    if (method === "GET" && pathname === "/v1/auth/me") {
      const accessToken = parseBearerToken(context.authorization);
      return {
        status: 200,
        body: await service().authenticate(accessToken)
      };
    }

    return { status: 405, body: { code: "METHOD_NOT_ALLOWED" } };
  } catch (error) {
    return authErrorResponse(error);
  }
}
