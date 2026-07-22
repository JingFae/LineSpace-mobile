export class DomainRepositoryError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INVALID"
      | "UNAVAILABLE",
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "DomainRepositoryError";
  }
}

export type DatabaseFailureKind =
  | "unique-violation"
  | "forbidden"
  | "serialization-conflict"
  | "unavailable";

export function classifyDatabaseError(error: {
  code?: string;
}): DatabaseFailureKind {
  if (error.code === "23505") return "unique-violation";
  if (error.code === "42501" || error.code === "PGRST301") {
    return "forbidden";
  }
  if (error.code === "40001") return "serialization-conflict";
  return "unavailable";
}

export function ensureDatabaseResult(
  error: { code?: string; message?: string } | null
): void {
  if (!error) return;
  const failure = classifyDatabaseError(error);
  if (failure === "unique-violation") {
    throw new DomainRepositoryError(
      "CONFLICT",
      409,
      "The requested resource already exists."
    );
  }
  if (failure === "forbidden") {
    throw new DomainRepositoryError(
      "FORBIDDEN",
      403,
      "You do not have permission to perform this action."
    );
  }
  if (failure === "serialization-conflict") {
    throw new DomainRepositoryError(
      "CONFLICT",
      409,
      "The resource changed. Please retry."
    );
  }
  throw new DomainRepositoryError(
    "UNAVAILABLE",
    503,
    "The data service is temporarily unavailable."
  );
}
