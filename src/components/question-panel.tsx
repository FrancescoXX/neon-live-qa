import { QUESTION_MAX } from "@/lib/validate";
import type { QuestionRow } from "@/lib/types";
import { formatStamp } from "@/lib/rows";

export type VisibleQuestion = QuestionRow & { pending?: boolean };

export function QuestionPanel({
  questions,
  votedIds,
  mode,
  onAsk,
  onVote,
  onAnswer,
}: {
  questions: readonly VisibleQuestion[];
  votedIds: ReadonlySet<string>;
  mode: "audience" | "host";
  onAsk: (body: string) => void;
  onVote: (questionId: string) => void;
  onAnswer: (questionId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl">Questions</h2>
        <p className="text-sm text-muted">{questions.length}</p>
      </div>
      <form
        className="space-y-3 rounded-2xl border border-line bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const body = String(new FormData(form).get("body") ?? "").replace(/\s+/g, " ").trim();
          if (!body || body.length > QUESTION_MAX) return;
          form.reset();
          onAsk(body);
        }}
      >
        <label htmlFor="question-body" className="block text-sm font-semibold">
          Ask the host
        </label>
        <textarea
          id="question-body"
          name="body"
          required
          maxLength={QUESTION_MAX}
          rows={3}
          placeholder="What should we talk about?"
          className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Up to {QUESTION_MAX} characters. One upvote per device.</p>
          <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Ask
          </button>
        </div>
      </form>
      {questions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No questions yet. Ask the first one.
        </p>
      ) : (
        <ol className="space-y-3">
          {questions.map((question) => {
            const voted = votedIds.has(question.id);
            return (
              <li
                key={question.id}
                className={`rounded-2xl border border-line bg-card p-4 ${question.answered ? "opacity-70" : ""} ${question.pending ? "opacity-80" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-base leading-snug break-words">{question.body}</p>
                  <p className="shrink-0 text-right">
                    <span className="block font-serif text-2xl leading-none">{question.votes}</span>
                    <span className="text-xs text-muted">{question.votes === 1 ? "vote" : "votes"}</span>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={voted}
                    aria-pressed={voted}
                    onClick={() => onVote(question.id)}
                    className="rounded-full border border-ink px-3 py-1 text-sm font-semibold disabled:opacity-60"
                  >
                    {voted ? "Upvoted" : "Upvote"}
                  </button>
                  {mode === "host" && !question.answered ? (
                    <button
                      type="button"
                      onClick={() => onAnswer(question.id)}
                      className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-paper"
                    >
                      Mark answered
                    </button>
                  ) : null}
                  {question.answered ? (
                    <span className="rounded-full bg-line px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                      Answered
                    </span>
                  ) : null}
                  <time dateTime={question.created_at.toISOString()} className="text-xs text-muted">
                    {formatStamp(question.created_at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
