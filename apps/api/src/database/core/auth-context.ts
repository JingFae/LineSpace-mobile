import type { DatabaseClient } from "./client.js";
import { ensureDatabaseResult } from "./errors.js";

export async function getCurrentLinespaceUserId(
  client: DatabaseClient
): Promise<string | null> {
  const result = await client.rpc("current_linespace_user_id");
  ensureDatabaseResult(result.error);
  return typeof result.data === "string" ? result.data : null;
}
