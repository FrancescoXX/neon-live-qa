import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import { getEnv } from "./env";

// One HTTP query function for the process. Each call is its own request,
// which fits Vercel functions. The Realtime WebSocket is a different path:
// this client is only for writes and the first server render.

let sql: NeonQueryFunction<false, false> | undefined;

export function getSql() {
  return (sql ??= neon(getEnv().databaseUrl));
}
