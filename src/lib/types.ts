// Shared row shapes. Live queries and the server read both produce these keys.
// Dates survive the server-to-client flight as Date objects. The Realtime
// client also decodes timestamptz columns to Date.

export type SessionSummary = {
  id: string;
  title: string;
};

export type QuestionRow = {
  id: string;
  body: string;
  answered: boolean;
  created_at: Date;
  votes: number;
};

export type PollOptionRow = {
  poll_id: string;
  question: string;
  is_open: boolean;
  option_id: string;
  label: string;
  position: number;
  votes: number;
};

/** What a write route returns after the database responds. */
export type WriteResult =
  | { kind: "committed"; txid: string }
  | { kind: "unchanged" }
  | { kind: "rejected"; reason: string };
