"use client";

import Link from "next/link";
import { useState } from "react";

import { TITLE_MAX } from "@/lib/validate";

import { CopyField } from "./copy-field";

type Created = {
  title: string;
  audienceUrl: string;
  hostUrl: string;
  hostPath: string;
};

export function CreateSession() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ title }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Could not create the session.";
        setError(message);
        return;
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("id" in payload) ||
        typeof payload.id !== "string" ||
        !("title" in payload) ||
        typeof payload.title !== "string" ||
        !("hostToken" in payload) ||
        typeof payload.hostToken !== "string"
      ) {
        setError("Unexpected response from the server.");
        return;
      }
      const origin = window.location.origin;
      const hostPath = `/s/${payload.id}/host?token=${encodeURIComponent(payload.hostToken)}`;
      setCreated({
        title: payload.title,
        audienceUrl: `${origin}/s/${payload.id}`,
        hostUrl: `${origin}${hostPath}`,
        hostPath,
      });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-4 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold tracking-wide uppercase text-accent">On air</p>
        <h1 className="font-serif text-5xl leading-tight">Live Q&A</h1>
        <p className="max-w-xl text-lg text-muted">
          Start a room, share the audience link, and keep the host link. Questions and the open poll
          update live for everyone in the room.
        </p>
      </header>

      {created ? (
        <section className="space-y-5 rounded-3xl border border-line bg-card p-6">
          <h2 className="font-serif text-3xl break-words">{created.title}</h2>
          <CopyField label="Audience link" value={created.audienceUrl} />
          <CopyField label="Host link" value={created.hostUrl} />
          <p className="text-sm text-warn">
            Save the host link now. It is the only copy of the host secret, and it is not shown again.
          </p>
          <Link href={created.hostPath} className="inline-block text-sm font-semibold underline">
            Open the host page
          </Link>
        </section>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-3xl border border-line bg-card p-6">
          <label htmlFor="session-title" className="block space-y-2">
            <span className="text-sm font-semibold">Session title</span>
            <input
              id="session-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TITLE_MAX}
              required
              placeholder="Friday live"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create session"}
          </button>
        </form>
      )}
    </main>
  );
}
