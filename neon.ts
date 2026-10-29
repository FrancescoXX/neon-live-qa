import { defineConfig } from "@neon/config/v1";

// `neon link` binds this directory to a Neon project.
// `neon deploy` applies this file: it enables Realtime and writes
// DATABASE_URL, NEON_REALTIME_URL, and NEON_REALTIME_SECRET to .env.local.
// v1 has no accounts, so Managed Better Auth stays off.
export default defineConfig({
  auth: false,
  preview: {
    realtime: {
      // Browser origins allowed to open the Realtime WebSocket.
      // A missing origin does not throw: the subscription stays on "connecting".
      allowedOrigins: [
        "http://localhost:3000",
        "https://neon-live-qa.vercel.app",
      ],
    },
  },
});
