import "server-only";

import { timingSafeEqual } from "node:crypto";

import { getSql } from "./db";
import { isHostToken, isUuid } from "./validate";

export type HostCheck =
  | { ok: true }
  | { ok: false; status: 403 | 404; error: string };

const denied: HostCheck = { ok: false, status: 403, error: "Host link is not valid." };

/** The host token never grants a live query. It only authorizes writes. */
export async function requireHost(sessionId: string, token: unknown): Promise<HostCheck> {
  if (!isUuid(sessionId)) return { ok: false, status: 404, error: "Session not found." };
  if (!isHostToken(token)) return denied;

  const rows = (await getSql().query("SELECT host_token FROM sessions WHERE id = $1::uuid", [
    sessionId,
  ])) as unknown[];
  const row = rows[0];
  if (typeof row !== "object" || row === null || !("host_token" in row)) {
    return { ok: false, status: 404, error: "Session not found." };
  }
  const stored = (row as { host_token: unknown }).host_token;
  if (typeof stored !== "string" || !tokensMatch(stored, token)) return denied;
  return { ok: true };
}

function tokensMatch(stored: string, provided: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
