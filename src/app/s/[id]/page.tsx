import { Suspense } from "react";

import { MissingRoom } from "@/components/missing-room";
import { isUuid } from "@/lib/validate";

import { AudienceSession } from "./audience-session";
import LoadingRoom from "./loading";

export const metadata = { title: "Audience · Live Q&A" };

export default async function AudiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Render the message instead of notFound(). In dev, notFound() inside this
  // dynamic page flushes a 200 and then a client render error.
  if (!isUuid(id)) return <MissingRoom />;
  return (
    <Suspense fallback={<LoadingRoom />}>
      <AudienceSession id={id} />
    </Suspense>
  );
}
