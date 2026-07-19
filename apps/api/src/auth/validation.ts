import type {
  LoginAuthInput,
  RefreshAuthInput,
  RegisterAuthInput
} from "@linespace/api-client";
import { ApiAuthError } from "./errors.js";

const usernamePattern = /^[a-z0-9][a-z0-9._-]*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidatedRegistration = {
  username: string;
  email: string;
  password: string;
};

export type ValidatedLogin = {
  username: string;
  password: string;
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
    typeof source.email !== "string" ||
    typeof source.password !== "string" ||
    typeof source.confirmPassword !== "string"
  ) {
    throw invalidInput("username, email, password, and confirmPassword are required.");
  }

  const username = validateUsername(source.username);
  const email = source.email.normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (email.length > 320 || !emailPattern.test(email)) {
    throw invalidInput("A valid email address is required.");
  }
  if (source.password !== source.confirmPassword) {
    throw invalidInput("Password confirmation does not match.");
  }
  validatePassword(source.password);

  return { username, email, password: source.password };
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
  const length = [...password].length;
  const strongEnough =
    length >= 8 &&
    length <= 128 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password);
  if (!strongEnough) {
    throw new ApiAuthError(
      "WEAK_PASSWORD",
      422,
      "Password must be 8 to 128 characters and include uppercase, lowercase, and numeric characters."
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
