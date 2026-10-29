import { readJson, runRoute } from "@/lib/http";
import { createPoll, respond } from "@/lib/writes";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return runRoute(async () => {
    const { id } = await context.params;
    return respond(await createPoll(id, await readJson(request)));
  });
}
