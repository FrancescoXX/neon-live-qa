import "server-only";

// Lazy on purpose. `next build` imports modules without Neon credentials.
// Nothing here reads the environment until a request actually needs it.

type Env = {
  databaseUrl: string;
  database: string;
  realtimeUrl: string;
  realtimeSecret: string;
};

let cached: Env | undefined;

export function getEnv(): Env {
  return (cached ??= load());
}

function load(): Env {
  const databaseUrl = required("DATABASE_URL");
  const realtimeUrl = required("NEON_REALTIME_URL");
  const realtimeSecret = required("NEON_REALTIME_SECRET");
  return {
    databaseUrl,
    database: databaseName(databaseUrl),
    realtimeUrl,
    realtimeSecret,
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing. Run neon deploy so it is written to .env.local.`);
  }
  return value;
}

function databaseName(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid connection URL.");
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error("DATABASE_URL must include a database name.");
  return name;
}
