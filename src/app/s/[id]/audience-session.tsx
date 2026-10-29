import { connection } from "next/server";

import { MissingRoom } from "@/components/missing-room";
import { SessionBoard } from "@/components/session-board";
import { loadRoom } from "@/lib/queries";

import { RealtimeRoot } from "../../realtime-root";

// connection() waits for a request. During `next build` it never resolves, so
// this component does not query Neon or seal anything at build time.
// A missing room is rendered here, not via notFound(), because notFound() inside
// this suspended subtree surfaces as a render error instead of the 404 page.

export async function AudienceSession({ id }: { id: string }) {
  await connection();
  const room = await loadRoom(id);
  if (!room.ok) return <MissingRoom />;

  return (
    <RealtimeRoot url={room.realtimeUrl}>
      <SessionBoard
        key={`${room.questionsSealed.queryFingerprint}:${room.pollSealed.queryFingerprint}`}
        mode="audience"
        session={room.session}
        initialQuestions={room.questions}
        questionsSealed={room.questionsSealed}
        initialPoll={room.pollOptions}
        pollSealed={room.pollSealed}
      />
    </RealtimeRoot>
  );
}
