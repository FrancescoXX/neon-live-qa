import { isUuid } from "./validate";

const VOTER_KEY = "neon-qa-voter-id";
const BALLOT_EVENT = "neon-qa-ballot";

export type Ballot = {
  questions: string[];
  polls: Record<string, string>;
};

export function ballotKey(sessionId: string): string {
  return `neon-qa-ballot:${sessionId}`;
}

export function getVoterId(): string {
  const existing = localStorage.getItem(VOTER_KEY);
  if (existing && isUuid(existing)) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(VOTER_KEY, id);
  return id;
}

export function parseBallot(raw: string): Ballot {
  if (!raw) return emptyBallot();
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return emptyBallot();
    const record = value as { questions?: unknown; polls?: unknown };
    const questions = Array.isArray(record.questions)
      ? record.questions.filter((id): id is string => isUuid(id))
      : [];
    const polls: Record<string, string> = {};
    if (typeof record.polls === "object" && record.polls !== null) {
      for (const [pollId, optionId] of Object.entries(record.polls)) {
        if (isUuid(pollId) && isUuid(optionId)) polls[pollId] = optionId;
      }
    }
    return { questions, polls };
  } catch {
    return emptyBallot();
  }
}

export function writeBallot(sessionId: string, ballot: Ballot): void {
  localStorage.setItem(ballotKey(sessionId), JSON.stringify(ballot));
  window.dispatchEvent(new Event(BALLOT_EVENT));
}

export function subscribeBallot(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(BALLOT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(BALLOT_EVENT, onStoreChange);
  };
}

function emptyBallot(): Ballot {
  return { questions: [], polls: {} };
}
