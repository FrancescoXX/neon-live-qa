import { json, runRoute } from "@/lib/http";
import { getSession, openPollQuery } from "@/lib/queries";
import { getRealtime } from "@/lib/realtime";
import { isUuid } from "@/lib/validate";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return runRoute(async () => {
    const { id } = await context.params;
    if (!isUuid(id)) return json({ error: "Session not found." }, 404);
    const session = await getSession(id);
    if (!session) return json({ error: "Session not found." }, 404);
    return json(await getRealtime().seal({ query: openPollQuery(id) }));
  });
}
