import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { getSql } from "./db";
import { requireHost } from "./host";
import { isRecord, json, safeError } from "./http";
import type { WriteResult } from "./types";
import {
  isUuid,
  parsePollOptions,
  parsePollQuestion,
  parseQuestionBody,
  parseTitle,
} from "./validate";

export type WriteOutcome =
  | { ok: true; result: WriteResult }
  | { ok: false; status: number; error: string };

export function respond(outcome: WriteOutcome): Response {
  if (!outcome.ok) return json({ error: outcome.error }, outcome.status);
  return json(outcome.result);
}

export type CreatedSession = {
  id: string;
  title: string;
  hostToken: string;
};

export async function createSession(input: unknown): Promise<
  { ok: true; session: CreatedSession } | { ok: false; status: number; error: string }
> {
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  const title = parseTitle(input.title);
  if (!title.ok) return invalid(title.error);

  const id = randomUUID();
  const hostToken = randomBytes(32).toString("base64url");
  try {
    await getSql().query(
      "INSERT INTO sessions (id, title, host_token) VALUES ($1::uuid, $2, $3)",
      [id, title.value, hostToken],
    );
  } catch (error) {
    return dbFailure(error, "Could not create the session.");
  }
  return { ok: true, session: { id, title: title.value, hostToken } };
}

export async function createQuestion(sessionId: string, input: unknown): Promise<WriteOutcome> {
  if (!isUuid(sessionId)) return missing("Session not found.");
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  if (!isUuid(input.id)) return invalid("Question id must be a UUID.");
  const body = parseQuestionBody(input.body);
  if (!body.ok) return invalid(body.error);

  try {
    const row = await one(
      `
      WITH session_ok AS (
        SELECT id FROM sessions WHERE id = $2::uuid
      ),
      inserted AS (
        INSERT INTO questions (id, session_id, body)
        SELECT $1::uuid, session_ok.id, $3
        FROM session_ok
        ON CONFLICT (id) DO NOTHING
        RETURNING pg_current_xact_id()::text AS txid
      )
      SELECT
        (SELECT COUNT(*)::int FROM session_ok) AS found,
        (SELECT txid FROM inserted) AS txid
      `,
      [input.id, sessionId, body.value],
    );
    if (count(row, "found") === 0) return missing("Session not found.");
    return committedOrUnchanged(row);
  } catch (error) {
    return dbFailure(error, "Could not save that question.");
  }
}

export async function voteQuestion(
  sessionId: string,
  questionId: string,
  input: unknown,
): Promise<WriteOutcome> {
  if (!isUuid(sessionId)) return missing("Session not found.");
  if (!isUuid(questionId)) return missing("Question not found.");
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  if (!isUuid(input.voterId)) return invalid("voterId must be a UUID.");

  try {
    const row = await one(
      `
      WITH target AS (
        SELECT id FROM questions WHERE id = $1::uuid AND session_id = $2::uuid
      ),
      inserted AS (
        INSERT INTO question_votes (question_id, voter_id)
        SELECT target.id, $3 FROM target
        ON CONFLICT DO NOTHING
        RETURNING pg_current_xact_id()::text AS txid
      )
      SELECT
        (SELECT COUNT(*)::int FROM target) AS found,
        (SELECT txid FROM inserted) AS txid
      `,
      [questionId, sessionId, input.voterId],
    );
    if (count(row, "found") === 0) return missing("Question not found.");
    return committedOrUnchanged(row);
  } catch (error) {
    return dbFailure(error, "Could not save that vote.");
  }
}

export async function answerQuestion(
  sessionId: string,
  questionId: string,
  input: unknown,
): Promise<WriteOutcome> {
  if (!isUuid(questionId)) return missing("Question not found.");
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  const host = await requireHost(sessionId, input.token);
  if (!host.ok) return host;

  try {
    const row = await one(
      `
      WITH target AS (
        SELECT id, answered
        FROM questions
        WHERE id = $1::uuid AND session_id = $2::uuid
      ),
      updated AS (
        UPDATE questions
        SET answered = true
        FROM target
        WHERE questions.id = target.id AND NOT target.answered
        RETURNING pg_current_xact_id()::text AS txid
      )
      SELECT
        (SELECT COUNT(*)::int FROM target) AS found,
        (SELECT txid FROM updated) AS txid
      `,
      [questionId, sessionId],
    );
    if (count(row, "found") === 0) return missing("Question not found.");
    return committedOrUnchanged(row);
  } catch (error) {
    return dbFailure(error, "Could not update that question.");
  }
}

export async function createPoll(sessionId: string, input: unknown): Promise<WriteOutcome> {
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  const host = await requireHost(sessionId, input.token);
  if (!host.ok) return host;
  if (!isUuid(input.pollId)) return invalid("Poll id must be a UUID.");
  const question = parsePollQuestion(input.question);
  if (!question.ok) return invalid(question.error);
  const options = parsePollOptions(input.options);
  if (!options.ok) return invalid(options.error);

  // Six fixed slots, unused ones null. Scalar placeholders avoid array encoding.
  const params: unknown[] = [sessionId, input.pollId, question.value];
  for (let index = 0; index < 6; index += 1) {
    const option = options.value[index];
    params.push(option?.id ?? null, option?.label ?? null);
  }

  try {
    const row = await oneLocked(
      sessionId,
      `
      WITH session_ok AS (
        SELECT id FROM sessions WHERE id = $1::uuid
      ),
      no_open AS (
        SELECT session_ok.id
        FROM session_ok
        WHERE NOT EXISTS (
          SELECT 1 FROM polls
          WHERE polls.session_id = session_ok.id AND polls.is_open
        )
      ),
      new_poll AS (
        INSERT INTO polls (id, session_id, question)
        SELECT $2::uuid, no_open.id, $3
        FROM no_open
        RETURNING id
      ),
      new_options AS (
        INSERT INTO poll_options (id, poll_id, label, position)
        SELECT option.id, new_poll.id, option.label, option.position
        FROM new_poll
        CROSS JOIN (
          VALUES
            ($4::uuid, $5::text, 1),
            ($6::uuid, $7::text, 2),
            ($8::uuid, $9::text, 3),
            ($10::uuid, $11::text, 4),
            ($12::uuid, $13::text, 5),
            ($14::uuid, $15::text, 6)
        ) AS option(id, label, position)
        WHERE option.id IS NOT NULL AND option.label IS NOT NULL
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*)::int FROM session_ok) AS session_found,
        (SELECT COUNT(*)::int FROM no_open) AS can_open,
        (SELECT COUNT(*)::int FROM new_poll) AS created,
        (SELECT COUNT(*)::int FROM new_options) AS option_count,
        (SELECT pg_current_xact_id()::text FROM new_poll LIMIT 1) AS txid
      `,
      params,
    );
    if (count(row, "session_found") === 0) return missing("Session not found.");
    if (count(row, "can_open") === 0) {
      return invalid("Close the open poll before starting a new one.");
    }
    if (count(row, "created") !== 1 || count(row, "option_count") !== options.value.length) {
      return { ok: false, status: 500, error: "Could not create the poll." };
    }
    return committedOrUnchanged(row);
  } catch (error) {
    return dbFailure(error, "Could not create the poll.");
  }
}

export async function closePoll(
  sessionId: string,
  pollId: string,
  input: unknown,
): Promise<WriteOutcome> {
  if (!isUuid(pollId)) return missing("Poll not found.");
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  const host = await requireHost(sessionId, input.token);
  if (!host.ok) return host;

  try {
    const row = await one(
      `
      WITH target AS (
        SELECT id, is_open
        FROM polls
        WHERE id = $1::uuid AND session_id = $2::uuid
      ),
      closed AS (
        UPDATE polls
        SET is_open = false
        FROM target
        WHERE polls.id = target.id AND target.is_open
        RETURNING pg_current_xact_id()::text AS txid
      )
      SELECT
        (SELECT COUNT(*)::int FROM target) AS found,
        (SELECT txid FROM closed) AS txid
      `,
      [pollId, sessionId],
    );
    if (count(row, "found") === 0) return missing("Poll not found.");
    return committedOrUnchanged(row);
  } catch (error) {
    return dbFailure(error, "Could not close the poll.");
  }
}

export async function votePoll(
  sessionId: string,
  pollId: string,
  input: unknown,
): Promise<WriteOutcome> {
  if (!isUuid(sessionId)) return missing("Session not found.");
  if (!isUuid(pollId)) return missing("Poll not found.");
  if (!isRecord(input)) return invalid("Expected a JSON object.");
  if (!isUuid(input.voterId)) return invalid("voterId must be a UUID.");
  if (!isUuid(input.optionId)) return invalid("optionId must be a UUID.");

  try {
    const row = await one(
      `
      WITH target AS (
        SELECT polls.id AS poll_id, polls.is_open
        FROM polls
        JOIN poll_options
          ON poll_options.poll_id = polls.id
         AND poll_options.id = $3::uuid
        WHERE polls.id = $1::uuid AND polls.session_id = $4::uuid
      ),
      upserted AS (
        INSERT INTO poll_votes (poll_id, voter_id, option_id)
        SELECT target.poll_id, $2, $3::uuid
        FROM target
        WHERE target.is_open
        ON CONFLICT (poll_id, voter_id) DO UPDATE
        SET option_id = EXCLUDED.option_id
        WHERE poll_votes.option_id IS DISTINCT FROM EXCLUDED.option_id
        RETURNING pg_current_xact_id()::text AS txid
      )
      SELECT
        (SELECT COUNT(*)::int FROM target) AS found,
        (SELECT is_open FROM target) AS is_open,
        (SELECT txid FROM upserted) AS txid
      `,
      [pollId, input.voterId, input.optionId, sessionId],
    );
    if (count(row, "found") === 0) return missing("That option is not on this poll.");
    if (!isTrue(row.is_open)) return invalid("This poll is closed.");
    return committedOrUnchanged(row);
  } catch (error) {
    return dbFailure(error, "Could not save that vote.");
  }
}

async function one(sqlText: string, params: readonly unknown[]): Promise<Record<string, unknown>> {
  const rows = (await getSql().query(sqlText, [...params])) as unknown[];
  return firstRow(rows);
}

// Locks the session row first so two hosts cannot open two polls at once.
// The lock is a top-level statement. It is held until the insert commits.
async function oneLocked(
  sessionId: string,
  sqlText: string,
  params: readonly unknown[],
): Promise<Record<string, unknown>> {
  const sql = getSql();
  const [, rows] = await sql.transaction((txn) => [
    txn.query("SELECT id FROM sessions WHERE id = $1::uuid FOR UPDATE", [sessionId]),
    txn.query(sqlText, [...params]),
  ]);
  return firstRow(rows);
}

function firstRow(rows: unknown): Record<string, unknown> {
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!isRecord(row)) throw new Error("Write query returned no row.");
  return row;
}

function committedOrUnchanged(row: Record<string, unknown>): WriteOutcome {
  const txid = txidOf(row.txid);
  if (!txid) return { ok: true, result: { kind: "unchanged" } };
  return { ok: true, result: { kind: "committed", txid } };
}

function count(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
}

function txidOf(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "bigint" && value >= 0n) return value.toString();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

function isTrue(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

function invalid(error: string) {
  return failure(400, error);
}

function missing(error: string) {
  return failure(404, error);
}

function failure(status: number, error: string): { ok: false; status: number; error: string } {
  return { ok: false, status, error };
}

function dbFailure(error: unknown, fallback: string): { ok: false; status: number; error: string } {
  const message = safeError(error);
  if (/is missing|not a valid|must include a database name/.test(message)) {
    console.error(message);
    return failure(500, message);
  }
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "23514") return failure(400, "That text is not allowed.");
  console.error(fallback, message);
  return failure(500, fallback);
}
