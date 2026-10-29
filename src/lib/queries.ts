import "server-only";

import { rawSql } from "@neon/realtime/server";

import { getSql } from "./db";
import { getEnv } from "./env";
import { getRealtime } from "./realtime";
import { comparePollOptions, compareQuestions, readPollRows, readQuestionRows } from "./rows";
import type { PollOptionRow, QuestionRow, SessionSummary } from "./types";
import { isUuid } from "./validate";

// One statement, read-only, deterministic. Placeholders only — never interpolate.
// COUNT is cast to int so the live client decodes it as a number (bigint would
// arrive as a string). The final id sort makes ties deterministic.
// Live snapshots do not promise SQL ORDER BY, so the client sorts with the
// same comparator as this initial read.

export const QUESTIONS_SQL = `
SELECT
  questions.id,
  questions.body,
  questions.answered,
  questions.created_at,
  COUNT(question_votes.voter_id)::int AS votes
FROM questions
LEFT JOIN question_votes ON question_votes.question_id = questions.id
WHERE questions.session_id = $1::uuid
GROUP BY questions.id, questions.body, questions.answered, questions.created_at
ORDER BY
  questions.answered ASC,
  COUNT(question_votes.voter_id) DESC,
  questions.created_at ASC,
  questions.id ASC
`;

// The oldest open poll only. A single-row lock on create keeps two polls from
// opening together; this LIMIT is the backstop so the result stays one poll.
export const OPEN_POLL_SQL = `
SELECT
  polls.id AS poll_id,
  polls.question,
  polls.is_open,
  poll_options.id AS option_id,
  poll_options.label,
  poll_options.position,
  COUNT(poll_votes.voter_id)::int AS votes
FROM polls
INNER JOIN poll_options ON poll_options.poll_id = polls.id
LEFT JOIN poll_votes
  ON poll_votes.option_id = poll_options.id
 AND poll_votes.poll_id = polls.id
WHERE polls.id = (
  SELECT open_poll.id
  FROM polls AS open_poll
  WHERE open_poll.session_id = $1::uuid
    AND open_poll.is_open
  ORDER BY open_poll.created_at ASC, open_poll.id ASC
  LIMIT 1
)
GROUP BY
  polls.id,
  polls.question,
  polls.is_open,
  poll_options.id,
  poll_options.label,
  poll_options.position
ORDER BY poll_options.position ASC, poll_options.id ASC
`;

export function questionsQuery(sessionId: string) {
  return rawSql<QuestionRow>(QUESTIONS_SQL, [sessionId]);
}

export function openPollQuery(sessionId: string) {
  return rawSql<PollOptionRow>(OPEN_POLL_SQL, [sessionId]);
}

export async function getSession(sessionId: string): Promise<SessionSummary | null> {
  if (!isUuid(sessionId)) return null;
  const rows = (await getSql().query(
    "SELECT id, title FROM sessions WHERE id = $1::uuid",
    [sessionId],
  )) as unknown[];
  const row = rows[0];
  if (typeof row !== "object" || row === null) return null;
  const record = row as { id?: unknown; title?: unknown };
  if (typeof record.id !== "string" || typeof record.title !== "string") return null;
  return { id: record.id, title: record.title };
}

/** Same SQL for the server render and the sealed subscription, so the rows match. */
export async function loadRoom(sessionId: string) {
  if (!isUuid(sessionId)) return { ok: false as const };
  const session = await getSession(sessionId);
  if (!session) return { ok: false as const };

  const questions = questionsQuery(sessionId);
  const poll = openPollQuery(sessionId);
  const sql = getSql();
  const [questionRows, pollRows, questionsSealed, pollSealed] = await Promise.all([
    sql.query(QUESTIONS_SQL, [sessionId]),
    sql.query(OPEN_POLL_SQL, [sessionId]),
    getRealtime().seal({ query: questions }),
    getRealtime().seal({ query: poll }),
  ]);

  return {
    ok: true as const,
    session,
    questions: readQuestionRows(questionRows).sort(compareQuestions),
    questionsSealed,
    pollOptions: readPollRows(pollRows).sort(comparePollOptions),
    pollSealed,
    realtimeUrl: getEnv().realtimeUrl,
  };
}
