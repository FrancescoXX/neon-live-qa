"use client";

import { createRealtimeClient } from "@neon/realtime/client";
import { RealtimeProvider } from "@neon/realtime-react";
import { type ReactNode, useState } from "react";

// Creating the client opens no socket, so this is safe during server render.
// The socket opens on the first subscribe and closes after the last one ends.
// Default parsers decode timestamptz to Date and int4 to number. No Drizzle parsers.

export function RealtimeRoot({ url, children }: { url: string; children: ReactNode }) {
  const [client] = useState(() => createRealtimeClient({ url }));
  return <RealtimeProvider client={client}>{children}</RealtimeProvider>;
}
