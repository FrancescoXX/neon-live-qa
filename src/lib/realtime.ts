import "server-only";

import { createRealtime } from "@neon/realtime/server";

import { getEnv } from "./env";

// No ORM adapter: queries are rawSql. debugMode is development-only because
// it puts database error text inside the sealed query.

let realtime: ReturnType<typeof create> | undefined;

function create() {
  const env = getEnv();
  return createRealtime({
    secret: env.realtimeSecret,
    db: env.database,
    debugMode: process.env.NODE_ENV === "development",
  });
}

export function getRealtime() {
  return (realtime ??= create());
}
