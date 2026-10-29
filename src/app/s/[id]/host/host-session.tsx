import Link from "next/link";
import { connection } from "next/server";

import { MissingRoom } from "@/components/missing-room";
import { SessionBoard } from "@/components/session-board";
import { requireHost } from "@/lib/host";
import { getSession, loadRoom } from "@/lib/queries";

import { RealtimeRoot } from "../../../realtime-root";

export async function HostSession({
  id,
  searchParams,
}: {
  id: string;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  await connection();
  const { token } = await searchParams;
  const hostToken = Array.isArray(token) ? token[0] : token;

  const session = await getSession(id);
  if (!session) return <MissingRoom />;

  const host = await requireHost(id, hostToken);
  if (!host.ok || !hostToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-4">
        <h1 className="font-serif text-4xl">Host link is not valid</h1>
        <p className="text-muted">
          Open the host link from when the room was created. The audience page stays available.
        </p>
        <Link href={`/s/${id}`} className="text-sm font-semibold underline">
          Audience page
        </Link>
      </main>
    );
  }

  const room = await loadRoom(id);
  if (!room.ok) return <MissingRoom />;

  return (
    <RealtimeRoot url={room.realtimeUrl}>
      <SessionBoard
        key={`${room.questionsSealed.queryFingerprint}:${room.pollSealed.queryFingerprint}`}
        mode="host"
        hostToken={hostToken}
        session={room.session}
        initialQuestions={room.questions}
        questionsSealed={room.questionsSealed}
        initialPoll={room.pollOptions}
        pollSealed={room.pollSealed}
      />
    </RealtimeRoot>
  );
}
