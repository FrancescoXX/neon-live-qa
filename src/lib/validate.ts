export const TITLE_MAX = 120;
export const QUESTION_MAX = 280;
export const OPTION_MAX = 80;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 6;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 32 random bytes, base64url, no padding.
const HOST_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isHostToken(value: unknown): value is string {
  return typeof value === "string" && HOST_TOKEN.test(value);
}

export function parseTitle(value: unknown): Parsed<string> {
  return parseText(value, "Title", 1, TITLE_MAX);
}

export function parseQuestionBody(value: unknown): Parsed<string> {
  return parseText(value, "Question", 1, QUESTION_MAX);
}

export function parsePollQuestion(value: unknown): Parsed<string> {
  return parseText(value, "Poll question", 1, QUESTION_MAX);
}

export function parseOptionLabel(value: unknown): Parsed<string> {
  return parseText(value, "Option", 1, OPTION_MAX);
}

export type PollOptionDraft = { id: string; label: string };

export function parsePollOptions(value: unknown): Parsed<PollOptionDraft[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: `Add ${OPTIONS_MIN} to ${OPTIONS_MAX} options.` };
  }
  if (value.length < OPTIONS_MIN || value.length > OPTIONS_MAX) {
    return { ok: false, error: `A poll needs ${OPTIONS_MIN} to ${OPTIONS_MAX} options.` };
  }

  const options: PollOptionDraft[] = [];
  const ids = new Set<string>();
  const labels = new Set<string>();

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: "Each option needs an id and a label." };
    }
    const record = item as Record<string, unknown>;
    if (!isUuid(record.id)) {
      return { ok: false, error: "Each option id must be a UUID." };
    }
    const label = parseOptionLabel(record.label);
    if (!label.ok) return label;
    const fold = label.value.toLocaleLowerCase();
    if (ids.has(record.id) || labels.has(fold)) {
      return { ok: false, error: "Options must be unique." };
    }
    ids.add(record.id);
    labels.add(fold);
    options.push({ id: record.id, label: label.value });
  }

  return { ok: true, value: options };
}

function parseText(value: unknown, name: string, min: number, max: number): Parsed<string> {
  if (value == null) return { ok: false, error: `${name} is required.` };
  if (typeof value !== "string") return { ok: false, error: `${name} must be text.` };
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < min) return { ok: false, error: `${name} is required.` };
  if (text.length > max) return { ok: false, error: `${name} must be ${max} characters or fewer.` };
  return { ok: true, value: text };
}
