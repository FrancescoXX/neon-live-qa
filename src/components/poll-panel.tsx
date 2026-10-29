"use client";

import { useState } from "react";

import type { PollOptionRow } from "@/lib/types";
import { OPTION_MAX, OPTIONS_MAX, OPTIONS_MIN, QUESTION_MAX } from "@/lib/validate";

export function PollPanel({
  options,
  selectedOptionId,
  mode,
  onVote,
  onCreate,
  onClose,
  formKey,
}: {
  options: readonly PollOptionRow[];
  selectedOptionId: string | null;
  mode: "audience" | "host";
  onVote: (pollId: string, optionId: string) => void;
  onCreate: (question: string, labels: string[]) => void;
  onClose: (pollId: string) => void;
  formKey: number;
}) {
  const pollId = options[0]?.poll_id;
  const question = options[0]?.question ?? "";
  const visible = pollId ? options.filter((option) => option.poll_id === pollId) : [];
  const total = visible.reduce((sum, option) => sum + option.votes, 0);

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Poll</h2>
      {pollId ? (
        <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
          <p className="text-lg leading-snug break-words">{question}</p>
          <ul className="space-y-3">
            {visible.map((option) => {
              const pct = total === 0 ? 0 : Math.round((option.votes / total) * 100);
              const selected = selectedOptionId === option.option_id;
              return (
                <li key={option.option_id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onVote(option.poll_id, option.option_id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${selected ? "border-accent" : "border-line"}`}
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                      <span className="break-words">{option.label}</span>
                      <span className="shrink-0 text-muted">
                        {option.votes} · {pct}%
                      </span>
                    </span>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-line">
                      <span className="block h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            {total} {total === 1 ? "vote" : "votes"}. You can change your vote while the poll is open.
          </p>
          {mode === "host" ? (
            <button
              type="button"
              onClick={() => onClose(pollId)}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
            >
              Close poll
            </button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No poll is open.
        </p>
      )}
      {mode === "host" ? (
        <div hidden={Boolean(pollId)}>
          <PollForm key={formKey} onCreate={onCreate} />
        </div>
      ) : null}
      {mode === "host" && pollId ? (
        <p className="text-sm text-muted">Close this poll to start another.</p>
      ) : null}
    </section>
  );
}

function PollForm({ onCreate }: { onCreate: (question: string, labels: string[]) => void }) {
  const [question, setQuestion] = useState("");
  const [labels, setLabels] = useState<string[]>(["", ""]);
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = labels.map((label) => label.replace(/\s+/g, " ").trim());
    if (!question.replace(/\s+/g, " ").trim()) {
      setFormError("Poll question is required.");
      return;
    }
    if (cleaned.some((label) => label.length === 0)) {
      setFormError("Fill in every option.");
      return;
    }
    setFormError(null);
    onCreate(question, cleaned);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <h3 className="font-semibold">Open a poll</h3>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Question</span>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={QUESTION_MAX}
          required
          className="w-full rounded-xl border border-line bg-paper px-3 py-2"
        />
      </label>
      <div className="space-y-2">
        {labels.map((label, index) => (
          <label key={index} className="block space-y-1 text-sm">
            <span className="font-semibold">Option {index + 1}</span>
            <span className="flex gap-2">
              <input
                value={label}
                onChange={(event) =>
                  setLabels((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                }
                maxLength={OPTION_MAX}
                required
                className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2"
              />
              {labels.length > OPTIONS_MIN ? (
                <button
                  type="button"
                  onClick={() => setLabels((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="rounded-xl border border-line px-3 text-sm"
                >
                  Remove
                </button>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {labels.length < OPTIONS_MAX ? (
          <button
            type="button"
            onClick={() => setLabels((current) => [...current, ""])}
            className="rounded-full border border-ink px-3 py-1 text-sm font-semibold"
          >
            Add option
          </button>
        ) : null}
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
          Open poll
        </button>
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-accent">
          {formError}
        </p>
      ) : (
        <p className="text-xs text-muted">
          {OPTIONS_MIN} to {OPTIONS_MAX} options.
        </p>
      )}
    </form>
  );
}
