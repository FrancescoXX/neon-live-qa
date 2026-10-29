import type { PollOptionRow, QuestionRow } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toQuestionRow(row: Record<string, unknown>): QuestionRow {
  if (typeof row.id !== "string" || typeof row.body !== "string") {
    throw new Error("Question row is missing id or body.");
  }
  return {
    id: row.id,
    body: row.body,
    answered: asBoolean(row.answered),
    created_at: asDate(row.created_at),
    votes: asNumber(row.votes),
  };
}

export function toPollOptionRow(row: Record<string, unknown>): PollOptionRow {
  if (
    typeof row.poll_id !== "string" ||
    typeof row.question !== "string" ||
    typeof row.option_id !== "string" ||
    typeof row.label !== "string"
  ) {
    throw new Error("Poll row is missing an id, question, or label.");
  }
  return {
    poll_id: row.poll_id,
    question: row.question,
    is_open: asBoolean(row.is_open),
    option_id: row.option_id,
    label: row.label,
    position: asNumber(row.position),
    votes: asNumber(row.votes),
  };
}

export function readQuestionRows(rows: unknown): QuestionRow[] {
  if (!Array.isArray(rows)) throw new Error("Question query did not return rows.");
  return rows.map((row) => {
    if (!isRecord(row)) throw new Error("Question row was not an object.");
    return toQuestionRow(row);
  });
}

export function readPollRows(rows: unknown): PollOptionRow[] {
  if (!Array.isArray(rows)) throw new Error("Poll query did not return rows.");
  return rows.map((row) => {
    if (!isRecord(row)) throw new Error("Poll row was not an object.");
    return toPollOptionRow(row);
  });
}

/** Live rows are already this shape. Coerce anyway so a string count cannot break the sort. */
export function coerceQuestion(row: QuestionRow): QuestionRow {
  return toQuestionRow(row as unknown as Record<string, unknown>);
}

export function coercePollOption(row: PollOptionRow): PollOptionRow {
  return toPollOptionRow(row as unknown as Record<string, unknown>);
}

export function compareQuestions(a: QuestionRow, b: QuestionRow): number {
  if (a.answered !== b.answered) return a.answered ? 1 : -1;
  if (a.votes !== b.votes) return b.votes - a.votes;
  const byTime = a.created_at.getTime() - b.created_at.getTime();
  if (byTime !== 0) return byTime;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function comparePollOptions(a: PollOptionRow, b: PollOptionRow): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.option_id === b.option_id) return 0;
  return a.option_id < b.option_id ? -1 : 1;
}

export function formatStamp(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function asDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error("Row timestamp could not be read.");
}
