import type { SealedLiveQuery } from "@neon/realtime/client";

import type { WriteResult } from "./types";

export async function refreshSealed<Row>(url: string): Promise<SealedLiveQuery<Row>> {
  const response = await fetch(url, { method: "POST", cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not renew the live query (${response.status}).`);
  }
  const payload: unknown = await response.json();
  if (!isSealed(payload)) throw new Error("Renewal response was not a sealed query.");
  return payload as SealedLiveQuery<Row>;
}

export async function postWrite(url: string, body: unknown): Promise<WriteResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "rejected", reason: "Network error. Try again." };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const reason =
      isRecord(payload) && typeof payload.error === "string" ? payload.error : "Request failed.";
    return { kind: "rejected", reason };
  }

  if (isRecord(payload) && payload.kind === "unchanged") return { kind: "unchanged" };
  if (isRecord(payload) && payload.kind === "committed" && typeof payload.txid === "string") {
    return { kind: "committed", txid: payload.txid };
  }
  return { kind: "rejected", reason: "Unexpected response from the server." };
}

function isSealed(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.capability === "string" &&
    typeof value.queryFingerprint === "string" &&
    typeof value.expiresAt === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
