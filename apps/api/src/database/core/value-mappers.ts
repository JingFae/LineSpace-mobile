export function countValue(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

export function dateLabel(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric"
  });
}

export function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
