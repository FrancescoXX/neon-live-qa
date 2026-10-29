import "server-only";

import { isRecord } from "./rows";

const noStore = { "cache-control": "private, no-store" };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: noStore });
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return null;
  if (text.length > 20_000) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  if (message.includes("://") || message.toLowerCase().includes("password")) return "database error";
  return message;
}

export async function runRoute(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    const message = safeError(error);
    console.error(message);
    const config = /is missing|not a valid|must include a database name/.test(message);
    return json({ error: config ? message : "Something went wrong. Try again." }, 500);
  }
}

export { isRecord };
