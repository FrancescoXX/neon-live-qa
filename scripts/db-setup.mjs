import { readFile } from "node:fs/promises";
import { Client } from "pg";

// Reads DATABASE_URL from .env.local only, so a shell variable cannot silently
// point this script at a different database. The value is never printed.

const envPath = new URL("../.env.local", import.meta.url);
const schemaPath = new URL("../db/schema.sql", import.meta.url);

let envText;
try {
  envText = await readFile(envPath, "utf8");
} catch {
  console.error("Missing .env.local. From the project root, run `neon link` then `neon deploy`.");
  process.exit(1);
}

const databaseUrl = readDatabaseUrl(envText);
if (!databaseUrl) {
  console.error("DATABASE_URL is empty in .env.local. Run `neon deploy` and try again.");
  process.exit(1);
}

const schema = await readFile(schemaPath, "utf8");
const client = new Client({ connectionString: withVerifyFull(databaseUrl) });

try {
  await client.connect();
  await client.query(schema);
  console.log("Applied db/schema.sql");
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "42P07") {
    console.error("Tables already exist, so db/schema.sql was not applied again.");
  } else {
    const message = error instanceof Error ? error.message : "Failed to apply db/schema.sql";
    console.error(message.includes("://") ? "Failed to apply db/schema.sql" : message);
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

function readDatabaseUrl(text) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const stripped = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const eq = stripped.indexOf("=");
    if (eq === -1) continue;
    const key = stripped.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let value = stripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return "";
}

// node-postgres treats prefer/require/verify-ca as verify-full and warns.
// Say so explicitly. This does not print the URL.
function withVerifyFull(connectionString) {
  return connectionString.replace(
    /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/,
    "$1sslmode=verify-full",
  );
}
