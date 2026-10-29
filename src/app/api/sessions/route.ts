import { json, readJson, runRoute } from "@/lib/http";
import { createSession } from "@/lib/writes";

export async function POST(request: Request) {
  return runRoute(async () => {
    const outcome = await createSession(await readJson(request));
    if (!outcome.ok) return json({ error: outcome.error }, outcome.status);
    return json(outcome.session);
  });
}
