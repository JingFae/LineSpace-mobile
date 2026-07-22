import { classifyDatabaseError } from "../core/errors.js";

export type ProfileRepositoryErrorCode =
  | "PROFILE_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_PROFILE"
  | "INVALID_CURSOR"
  | "USER_DOMAIN_UNAVAILABLE"
  | "USER_DOMAIN_CONFLICT";

export class ProfileRepositoryError extends Error {
  constructor(
    readonly code: ProfileRepositoryErrorCode,
    readonly status: number,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "ProfileRepositoryError";
  }
}

export function ensureProfileDatabaseResult(
  error: { code?: string; message?: string } | null
): void {
  if (!error) return;
  const failure = classifyDatabaseError(error);
  if (failure === "forbidden") {
    throw new ProfileRepositoryError(
      "FORBIDDEN",
      403,
      "You are not allowed to access this user data."
    );
  }
  if (failure === "unique-violation") {
    throw new ProfileRepositoryError(
      "USER_DOMAIN_CONFLICT",
      409,
      "This user relationship already exists."
    );
  }
  throw new ProfileRepositoryError(
    "USER_DOMAIN_UNAVAILABLE",
    503,
    "User data is temporarily unavailable."
  );
}
