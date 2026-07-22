import type {
  AuthRegistrationResult,
  AuthSessionResult,
  AuthUser,
  ChangePasswordInput,
  LoginAuthInput,
  RegisterAuthInput
} from "./types";

export type AuthClientErrorCode =
  | "INVALID_AUTH_INPUT"
  | "USERNAME_TAKEN"
  | "WEAK_PASSWORD"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "INVALID_REFRESH_TOKEN"
  | "AUTH_PROVIDER_UNAVAILABLE"
  | "UNKNOWN";

/** A safe, typed error for client-side auth flows. Server details are never exposed. */
export class AuthClientError extends Error {
  constructor(
    readonly code: AuthClientErrorCode,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthClientError";
  }
}

export type AuthClientOptions = {
  fetch?: typeof globalThis.fetch;
};

export class HttpAuthClient {
  private readonly requestFn: typeof globalThis.fetch;

  constructor(
    private readonly baseUrl: string,
    options: AuthClientOptions = {}
  ) {
    const requestFn = options.fetch ?? globalThis.fetch;
    // Browser fetch must be called with the global object as its receiver.
    // Storing it as an instance property and calling `this.requestFn(...)`
    // otherwise throws "Illegal invocation" before any request is sent.
    this.requestFn = requestFn.bind(globalThis);
  }

  register(input: RegisterAuthInput): Promise<AuthRegistrationResult> {
    return this.request<AuthRegistrationResult>("POST", "/v1/auth/register", input);
  }

  login(input: LoginAuthInput): Promise<AuthSessionResult> {
    return this.request<AuthSessionResult>("POST", "/v1/auth/login", input);
  }

  refresh(refreshToken: string): Promise<AuthSessionResult> {
    return this.request<AuthSessionResult>("POST", "/v1/auth/refresh", { refreshToken });
  }

  async logout(accessToken: string): Promise<void> {
    await this.request<void>("POST", "/v1/auth/logout", undefined, accessToken, true);
  }

  me(accessToken: string): Promise<AuthUser> {
    return this.request<AuthUser>("GET", "/v1/auth/me", undefined, accessToken);
  }

  async changePassword(accessToken: string, input: ChangePasswordInput): Promise<void> {
    await this.request<void>("POST", "/v1/auth/password", input, accessToken, true);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    accessToken?: string,
    noContent = false
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await this.requestFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new AuthClientError(
        "AUTH_PROVIDER_UNAVAILABLE",
        503,
        "Authentication is temporarily unavailable."
      );
    }

    if (!response.ok) {
      throw await this.toClientError(response, path);
    }
    if (noContent || response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async toClientError(response: Response, path: string) {
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { code?: unknown };
      code = typeof payload.code === "string" ? payload.code : undefined;
    } catch {
      // Keep the public error generic when the server did not return JSON.
    }

    const normalized = normalizeCode(code);
    return new AuthClientError(
      normalized,
      response.status,
      safeMessage(normalized, path)
    );
  }
}

function normalizeCode(value: string | undefined): AuthClientErrorCode {
  switch (value) {
    case "INVALID_AUTH_INPUT":
    case "USERNAME_TAKEN":
    case "WEAK_PASSWORD":
    case "INVALID_CREDENTIALS":
    case "INVALID_TOKEN":
    case "INVALID_REFRESH_TOKEN":
    case "AUTH_PROVIDER_UNAVAILABLE":
      return value;
    default:
      return "UNKNOWN";
  }
}

function safeMessage(code: AuthClientErrorCode, path: string) {
  if (path === "/v1/auth/login") {
    return "Invalid username or password.";
  }
  if (path === "/v1/auth/password" && code === "INVALID_CREDENTIALS") {
    return "Your current password is incorrect.";
  }
  if (code === "INVALID_CREDENTIALS") return "Invalid username or password.";
  if (code === "USERNAME_TAKEN") return "That username is unavailable.";
  if (code === "WEAK_PASSWORD") return "Choose a stronger password.";
  if (code === "INVALID_REFRESH_TOKEN" || code === "INVALID_TOKEN") {
    return "Your session has expired. Please sign in again.";
  }
  if (code === "INVALID_AUTH_INPUT") return "Please check the information you entered.";
  return "Authentication is temporarily unavailable.";
}
