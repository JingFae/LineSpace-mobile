export type AuthErrorCode =
  | "AUTH_NOT_CONFIGURED"
  | "INVALID_AUTH_INPUT"
  | "USERNAME_TAKEN"
  | "WEAK_PASSWORD"
  | "REGISTRATION_FAILED"
  | "INVALID_CREDENTIALS"
  | "INVALID_TOKEN"
  | "INVALID_REFRESH_TOKEN"
  | "AUTH_PROFILE_MISSING"
  | "AUTH_PROVIDER_UNAVAILABLE";

export class ApiAuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly status: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "ApiAuthError";
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.publicMessage }
    };
  }

  return {
    status: 503,
    body: {
      code: "AUTH_PROVIDER_UNAVAILABLE" satisfies AuthErrorCode,
      message: "Authentication is temporarily unavailable."
    }
  };
}

export function invalidCredentialsError() {
  return new ApiAuthError(
    "INVALID_CREDENTIALS",
    401,
    "Invalid username or password."
  );
}

export function invalidTokenError() {
  return new ApiAuthError("INVALID_TOKEN", 401, "A valid access token is required.");
}
