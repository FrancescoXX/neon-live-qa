"use client";

import type { SealedLiveQuery } from "@neon/realtime/client";
import { useLiveQuery } from "@neon/realtime-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore, startTransition, useOptimistic } from "react";

import { ballotKey, getVoterId, parseBallot, subscribeBallot, writeBallot } from "@/lib/ballot";
import { postWrite, refreshSealed } from "@/lib/client-api";
import { coercePollOption, coerceQuestion, comparePollOptions, compareQuestions } from "@/lib/rows";
import type { PollOptionRow, QuestionRow, SessionSummary, WriteResult } from "@/lib/types";

import { CopyField } from "./copy-field";
import { LiveStatus, worstStatus } from "./live-status";
import { PollPanel } from "./poll-panel";
import { QuestionPanel, type VisibleQuestion } from "./question-panel";

const SYNC_TIMEOUT_MS = 10_000;

function subscribeNothing() {
  return () => {};
}

function readOrigin() {
  return window.location.origin;
}

function emptyOrigin() {
  return "";
}

type Notice = { tone: "error" | "info"; text: string };
type QuestionAction = { type: "add"; question: QuestionRow } | { type: "answer"; id: string };
type PollAction = { type: "open"; options: PollOptionRow[] } | { type: "close"; pollId: string };

type BoardProps = {
  session: SessionSummary;
  initialQuestions: QuestionRow[];
  questionsSealed: SealedLiveQuery<QuestionRow>;
  initialPoll: PollOptionRow[];
  pollSealed: SealedLiveQuery<PollOptionRow>;
} & ({ mode: "audience" } | { mode: "host"; hostToken: string });

export function SessionBoard(props: BoardProps) {
  const { session, mode } = props;
  const hostToken = props.mode === "host" ? props.hostToken : null;
  const [questionsQuery] = useState(props.questionsSealed);
  const [pollQuery] = useState(props.pollSealed);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pollFormKey, setPollFormKey] = useState(0);

  const refreshQuestions = useCallback(
    () => refreshSealed<QuestionRow>(`/api/sessions/${session.id}/live/questions`),
    [session.id],
  );
  const refreshPoll = useCallback(
    () => refreshSealed<PollOptionRow>(`/api/sessions/${session.id}/live/poll`),
    [session.id],
  );

  const questionsLive = useLiveQuery(questionsQuery, {
    initialData: props.initialQuestions,
    refreshQuery: refreshQuestions,
  });
  const pollLive = useLiveQuery(pollQuery, {
    initialData: props.initialPoll,
    refreshQuery: refreshPoll,
  });

  const liveQuestions = useMemo(
    () => (questionsLive.data ?? props.initialQuestions).map(coerceQuestion),
    [questionsLive.data, props.initialQuestions],
  );
  const livePoll = useMemo(
    () => (pollLive.data ?? props.initialPoll).map(coercePollOption).sort(comparePollOptions),
    [pollLive.data, props.initialPoll],
  );

  const [optimisticQuestions, applyQuestion] = useOptimistic<readonly VisibleQuestion[], QuestionAction>(
    liveQuestions,
    applyQuestionAction,
  );
  const [optimisticPoll, applyPoll] = useOptimistic<readonly PollOptionRow[], PollAction>(
    livePoll,
    applyPollAction,
  );

  const questions = useMemo(
    () => [...optimisticQuestions].sort(compareQuestions),
    [optimisticQuestions],
  );
  const pollOptions = useMemo(
    () => [...optimisticPoll].sort(comparePollOptions),
    [optimisticPoll],
  );

  const ballotRaw = useSyncExternalStore(
    subscribeBallot,
    () => localStorage.getItem(ballotKey(session.id)) ?? "",
    () => "",
  );
  const ballot = useMemo(() => parseBallot(ballotRaw), [ballotRaw]);
  const votedIds = useMemo(() => new Set(ballot.questions), [ballot.questions]);
  const openPollId = pollOptions[0]?.poll_id ?? null;
  const selectedOptionId = openPollId ? (ballot.polls[openPollId] ?? null) : null;
  const status = worstStatus(questionsLive.status, pollLive.status);
  const liveError =
    questionsLive.status === "error"
      ? questionsLive.error.message
      : pollLive.status === "error"
        ? pollLive.error.message
        : null;

  async function settle(
    result: WriteResult,
    utils: { awaitTxId: (txid: string, timeout?: number) => Promise<void> },
    failure: string,
  ) {
    if (result.kind === "rejected") {
      setNotice({ tone: "error", text: result.reason || failure });
      return false;
    }
    if (result.kind === "unchanged") return true;
    try {
      await utils.awaitTxId(result.txid, SYNC_TIMEOUT_MS);
    } catch {
      setNotice({ tone: "info", text: "Saved. It will show up when live updates reconnect." });
    }
    return true;
  }

  function ask(body: string) {
    const question: QuestionRow = {
      id: crypto.randomUUID(),
      body: body.replace(/\s+/g, " ").trim(),
      answered: false,
      created_at: new Date(),
      votes: 0,
    };
    if (!question.body) return;
    setNotice(null);
    startTransition(async () => {
      applyQuestion({ type: "add", question });
      const result = await postWrite(`/api/sessions/${session.id}/questions`, {
        id: question.id,
        body: question.body,
      });
      await settle(result, questionsLive.utils, "Could not save that question.");
    });
  }

  function vote(questionId: string) {
    if (votedIds.has(questionId)) return;
    const previous = readBallot();
    writeBallot(session.id, {
      questions: [...new Set([...previous.questions, questionId])],
      polls: previous.polls,
    });
    setNotice(null);
    startTransition(async () => {
      const result = await postWrite(`/api/sessions/${session.id}/questions/${questionId}/vote`, {
        voterId: getVoterId(),
      });
      if (result.kind === "rejected") writeBallot(session.id, previous);
      await settle(result, questionsLive.utils, "Could not save that vote.");
    });
  }

  function answer(questionId: string) {
    if (!hostToken) return;
    setNotice(null);
    startTransition(async () => {
      applyQuestion({ type: "answer", id: questionId });
      const result = await postWrite(`/api/sessions/${session.id}/questions/${questionId}/answer`, {
        token: hostToken,
      });
      await settle(result, questionsLive.utils, "Could not mark that question answered.");
    });
  }

  function createPoll(question: string, labels: string[]) {
    if (!hostToken) return;
    const pollId = crypto.randomUUID();
    const options = labels.map((label, index) => ({
      poll_id: pollId,
      question: question.replace(/\s+/g, " ").trim(),
      is_open: true,
      option_id: crypto.randomUUID(),
      label,
      position: index + 1,
      votes: 0,
    }));
    setNotice(null);
    startTransition(async () => {
      applyPoll({ type: "open", options });
      const result = await postWrite(`/api/sessions/${session.id}/polls`, {
        token: hostToken,
        pollId,
        question: options[0]?.question ?? question,
        options: options.map((option) => ({ id: option.option_id, label: option.label })),
      });
      const saved = await settle(result, pollLive.utils, "Could not open the poll.");
      if (saved && result.kind === "committed") setPollFormKey((key) => key + 1);
    });
  }

  function closePoll(pollId: string) {
    if (!hostToken) return;
    setNotice(null);
    startTransition(async () => {
      applyPoll({ type: "close", pollId });
      const result = await postWrite(`/api/sessions/${session.id}/polls/${pollId}/close`, {
        token: hostToken,
      });
      await settle(result, pollLive.utils, "Could not close the poll.");
    });
  }

  function votePoll(pollId: string, optionId: string) {
    const previous = readBallot();
    writeBallot(session.id, {
      questions: previous.questions,
      polls: { ...previous.polls, [pollId]: optionId },
    });
    setNotice(null);
    startTransition(async () => {
      const result = await postWrite(`/api/sessions/${session.id}/polls/${pollId}/vote`, {
        voterId: getVoterId(),
        optionId,
      });
      if (result.kind === "rejected") writeBallot(session.id, previous);
      await settle(result, pollLive.utils, "Could not save that vote.");
    });
  }

  const audiencePath = `/s/${session.id}`;
  const origin = useSyncExternalStore(subscribeNothing, readOrigin, emptyOrigin);
  const audienceUrl = origin ? `${origin}${audiencePath}` : audiencePath;

  function readBallot() {
    return parseBallot(localStorage.getItem(ballotKey(session.id)) ?? "");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold tracking-wide uppercase text-muted">
            Live Q&A
          </Link>
          <LiveStatus status={status} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide uppercase text-accent">
            {mode === "host" ? "Host" : "Audience"}
          </p>
          <h1 className="font-serif text-4xl leading-tight break-words">{session.title}</h1>
        </div>
        {mode === "host" ? <CopyField label="Audience link" value={audienceUrl} /> : null}
      </header>

      {notice ? (
        <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "text-accent" : "text-warn"}>
          {notice.text}
        </p>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border border-accent/30 bg-card p-4" role="alert">
          <p>Live updates stopped. Reload the page to subscribe again.</p>
          {process.env.NODE_ENV === "development" && liveError ? (
            <p className="mt-2 text-sm text-muted">{liveError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
          >
            Reload
          </button>
        </div>
      ) : null}

      <PollPanel
        options={pollOptions}
        selectedOptionId={selectedOptionId}
        mode={mode}
        onVote={votePoll}
        onCreate={createPoll}
        onClose={closePoll}
        formKey={pollFormKey}
      />
      <QuestionPanel
        questions={questions}
        votedIds={votedIds}
        mode={mode}
        onAsk={ask}
        onVote={vote}
        onAnswer={answer}
      />
    </main>
  );
}

function applyQuestionAction(rows: readonly VisibleQuestion[], action: QuestionAction): readonly VisibleQuestion[] {
  if (action.type === "add") {
    return rows.some((row) => row.id === action.question.id)
      ? rows
      : [...rows, { ...action.question, pending: true }];
  }
  return rows.map((row) =>
    row.id === action.id && !row.answered ? { ...row, answered: true, pending: true } : row,
  );
}

function applyPollAction(rows: readonly PollOptionRow[], action: PollAction): readonly PollOptionRow[] {
  if (action.type === "close") return rows.filter((row) => row.poll_id !== action.pollId);
  if (rows.some((row) => row.poll_id === action.options[0]?.poll_id)) return rows;
  return action.options;
}
