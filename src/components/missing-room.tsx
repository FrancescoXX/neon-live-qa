import Link from "next/link";

export function MissingRoom() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-4">
      <h1 className="font-serif text-4xl">Room not found</h1>
      <p className="text-muted">That link does not match a session.</p>
      <Link href="/" className="text-sm font-semibold underline">
        Start a session
      </Link>
    </main>
  );
}
