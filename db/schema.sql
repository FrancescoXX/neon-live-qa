-- Approved schema. `npm run db:setup` applies this file with DATABASE_URL from .env.local.
-- gen_random_uuid() is built into Postgres 13+, which Neon provides.

CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, host_token text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, body text NOT NULL CHECK (length(body) BETWEEN 1 AND 280), answered boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE question_votes (question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE, voter_id text NOT NULL, PRIMARY KEY (question_id, voter_id));
CREATE TABLE polls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, question text NOT NULL, is_open boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE poll_options (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE, label text NOT NULL, position int NOT NULL);
CREATE TABLE poll_votes (poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE, voter_id text NOT NULL, option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE, PRIMARY KEY (poll_id, voter_id));
