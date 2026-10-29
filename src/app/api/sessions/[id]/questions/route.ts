import { readJson, runRoute } from "@/lib/http";
import { createQuestion, respond } from "@/lib/writes";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return runRoute(async () => {
    const { id } = await context.params;
    return respond(await createQuestion(id, await readJson(request)));
  });
}
