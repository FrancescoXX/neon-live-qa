import { readJson, runRoute } from "@/lib/http";
import { respond, voteQuestion } from "@/lib/writes";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; questionId: string }> },
) {
  return runRoute(async () => {
    const { id, questionId } = await context.params;
    return respond(await voteQuestion(id, questionId, await readJson(request)));
  });
}
