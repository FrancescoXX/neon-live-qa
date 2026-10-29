import { readJson, runRoute } from "@/lib/http";
import { answerQuestion, respond } from "@/lib/writes";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; questionId: string }> },
) {
  return runRoute(async () => {
    const { id, questionId } = await context.params;
    return respond(await answerQuestion(id, questionId, await readJson(request)));
  });
}
