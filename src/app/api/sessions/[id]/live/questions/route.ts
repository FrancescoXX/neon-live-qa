import { json, runRoute } from "@/lib/http";
import { getSession, questionsQuery } from "@/lib/queries";
import { getRealtime } from "@/lib/realtime";
import { isUuid } from "@/lib/validate";

// Renewal is a read, so it is a route handler. Server actions run one at a time
// and would queue behind writes. The sealed query is a bearer token: no-store.

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return runRoute(async () => {
    const { id } = await context.params;
    if (!isUuid(id)) return json({ error: "Session not found." }, 404);
    const session = await getSession(id);
    if (!session) return json({ error: "Session not found." }, 404);
    return json(await getRealtime().seal({ query: questionsQuery(id) }));
  });
}
