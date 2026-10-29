import { readJson, runRoute } from "@/lib/http";
import { respond, votePoll } from "@/lib/writes";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; pollId: string }> },
) {
  return runRoute(async () => {
    const { id, pollId } = await context.params;
    return respond(await votePoll(id, pollId, await readJson(request)));
  });
}
