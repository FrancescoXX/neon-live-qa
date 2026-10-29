import { Suspense } from "react";

import { MissingRoom } from "@/components/missing-room";
import { isUuid } from "@/lib/validate";

import LoadingRoom from "../loading";
import { HostSession } from "./host-session";

export default async function HostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) return <MissingRoom />;
  return (
    <Suspense fallback={<LoadingRoom />}>
      <HostSession id={id} searchParams={searchParams} />
    </Suspense>
  );
}
