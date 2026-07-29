import { waitUntil } from "@vercel/functions";

export function keepVercelTaskAlive(promise: Promise<unknown>) {
  waitUntil(promise);
}
