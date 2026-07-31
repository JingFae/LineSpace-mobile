import type {
  ChangePasswordInput,
  LoginAuthInput,
  RefreshAuthInput,
  RegisterAuthInput
} from "@linespace/api-client";
import { ApiAuthError } from "./errors.js";

const usernamePattern = /^[a-z0-9][a-z0-9._-]*$/;

export type ValidatedRegistration = {
  username: string;
  password: string;
};

export type ValidatedLogin = {
  username: string;
  password: string;
};

export type ValidatedPasswordChange = {
  currentPassword: string;
  newPassword: string;
};

export function normalizeUsername(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function parseRegistration(body: unknown): ValidatedRegistration {
  if (!body || typeof body !== "object") {
    throw invalidInput("Registration details are required.");
  }

  const source = body as Partial<Record<keyof RegisterAuthInput, unknown>>;
  if (
    typeof source.username !== "string" ||
    typeof source.password !== "string"
  ) {
    throw invalidInput("username and password are required.");
  }

  const username = validateUsername(source.username);
  validatePassword(source.password);

  return { username, password: source.password };
}

export function parseLogin(body: unknown): ValidatedLogin {
  if (!body || typeof body !== "object") {
    throw invalidCredentials();
  }

  const source = body as Partial<Record<keyof LoginAuthInput, unknown>>;
  if (typeof source.username !== "string" || typeof source.password !== "string") {
    throw invalidCredentials();
  }

  const username = normalizeUsername(source.username);
  const length = [...username].length;
  if (length < 3 || length > 32 || !usernamePattern.test(username)) {
    throw invalidCredentials();
  }

  return { username, password: source.password };
}

export function parsePasswordChange(body: unknown): ValidatedPasswordChange {
  if (!body || typeof body !== "object") {
    throw invalidInput("Password details are required.");
  }

  const source = body as Partial<Record<keyof ChangePasswordInput, unknown>>;
  if (
    typeof source.currentPassword !== "string" ||
    typeof source.newPassword !== "string" ||
    typeof source.confirmPassword !== "string"
  ) {
    throw invalidInput("currentPassword, newPassword, and confirmPassword are required.");
  }
  if (!source.currentPassword) {
    throw invalidInput("Your current password is required.");
  }
  if (source.newPassword !== source.confirmPassword) {
    throw invalidInput("Password confirmation does not match.");
  }
  validatePassword(source.newPassword);
  return { currentPassword: source.currentPassword, newPassword: source.newPassword };
}

export function parseRefreshToken(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new ApiAuthError(
      "INVALID_REFRESH_TOKEN",
      401,
      "A valid refresh token is required."
    );
  }

  const source = body as Partial<Record<keyof RefreshAuthInput, unknown>>;
  if (typeof source.refreshToken !== "string" || source.refreshToken.trim().length === 0) {
    throw new ApiAuthError(
      "INVALID_REFRESH_TOKEN",
      401,
      "A valid refresh token is required."
    );
  }
  return source.refreshToken;
}

export function parseBearerToken(authorization: string | undefined) {
  if (!authorization) {
    throw new ApiAuthError("INVALID_TOKEN", 401, "A valid access token is required.");
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  const token = match?.[1]?.trim();
  if (!token) {
    throw new ApiAuthError("INVALID_TOKEN", 401, "A valid access token is required.");
  }
  return token;
}

function validateUsername(value: string) {
  const username = normalizeUsername(value);
  const length = [...username].length;
  if (length < 3 || length > 32) {
    throw invalidInput("Username must contain 3 to 32 characters.");
  }
  if (!usernamePattern.test(username)) {
    throw invalidInput(
      "Username may contain lowercase letters, numbers, periods, underscores, and hyphens."
    );
  }
  return username;
}

function validatePassword(password: string) {
  if ([...password].length < 6) {
    throw new ApiAuthError(
      "WEAK_PASSWORD",
      422,
      "Password must contain at least 6 characters."
    );
  }
}

function invalidInput(message: string) {
  return new ApiAuthError("INVALID_AUTH_INPUT", 400, message);
}

function invalidCredentials() {
  return new ApiAuthError(
    "INVALID_CREDENTIALS",
    401,
    "Invalid username or password."
  );
}
