import { readJson, runRoute } from "@/lib/http";
import { closePoll, respond } from "@/lib/writes";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; pollId: string }> },
) {
  return runRoute(async () => {
    const { id, pollId } = await context.params;
    return respond(await closePoll(id, pollId, await readJson(request)));
  });
}
