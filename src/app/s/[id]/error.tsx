"use client";

export default function RoomError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-4">
      <h1 className="font-serif text-4xl">This room could not be loaded</h1>
      <p className="text-muted">
        Check that the Neon environment variables are set and that the database schema has been applied.
      </p>
      <button
        type="button"
        onClick={reset}
        className="w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
      >
        Try again
      </button>
    </main>
  );
}
