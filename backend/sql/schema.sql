-- ===================================================================
-- TikBoost - PostgreSQL schema (raw SQL equivalent of prisma.schema)
-- Use this file if you do NOT want Prisma migrations.
-- Apply:  psql -U postgres -d tikboost -f backend/sql/schema.sql
-- ===================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== USERS =====
CREATE TYPE user_role     AS ENUM ('USER','ADMIN','SUPER_ADMIN','MODERATOR','FINANCE');
CREATE TYPE user_status   AS ENUM ('ACTIVE','FROZEN','BANNED');

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password      TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'USER',
  status        user_status NOT NULL DEFAULT 'ACTIVE',
  freeze_until  TIMESTAMPTZ,
  ban_reason    TEXT,
  avatar_url    TEXT,
  points        BIGINT NOT NULL DEFAULT 0,
  total_earned  BIGINT NOT NULL DEFAULT 0,
  total_spent   BIGINT NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by_id UUID REFERENCES users(id),
  device_id     TEXT UNIQUE,
  last_ip       TEXT,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_role_idx     ON users(role);
CREATE INDEX IF NOT EXISTS users_status_idx   ON users(status);
CREATE INDEX IF NOT EXISTS users_referrer_idx ON users(referred_by_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

-- ===== CAMPAIGNS =====
CREATE TYPE campaign_type   AS ENUM ('FOLLOWERS','LIKES','VIEWS','COMMENTS');
CREATE TYPE campaign_status AS ENUM ('PENDING','ACTIVE','PAUSED','COMPLETED','CANCELLED');

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type campaign_type NOT NULL,
  status campaign_status NOT NULL DEFAULT 'ACTIVE',
  target_url TEXT NOT NULL,
  target_username TEXT NOT NULL,
  quantity INT NOT NULL,
  completed INT NOT NULL DEFAULT 0,
  points_cost BIGINT NOT NULL,
  per_task_reward BIGINT NOT NULL,
  proof_url TEXT,
  description TEXT,
  paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_owner_idx      ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS campaigns_type_status_idx ON campaigns(type, status);

-- ===== TASKS (with DB-level uniqueness: one executor per campaign) =====
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  executor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_points BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VERIFIED',
  verified_at TIMESTAMPTZ,
  ip TEXT,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_unique_per_user_campaign UNIQUE (campaign_id, executor_id)
);
CREATE INDEX IF NOT EXISTS tasks_executor_idx ON tasks(executor_id);

-- ===== PACKAGES & PURCHASES =====
CREATE TABLE IF NOT EXISTS point_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  points BIGINT NOT NULL,
  bonus_points BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE purchase_status AS ENUM ('PENDING','APPROVED','REJECTED','REFUNDED');

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES point_packages(id),
  points_given BIGINT NOT NULL,
  price_cents INT NOT NULL,
  currency TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'manual_transfer',
  reference TEXT,
  status purchase_status NOT NULL DEFAULT 'PENDING',
  approved_by_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_user_idx   ON purchases(user_id);
CREATE INDEX IF NOT EXISTS purchases_status_idx ON purchases(status);

-- ===== POINTS LEDGER =====
CREATE TYPE point_reason AS ENUM
  ('TASK_REWARD','CAMPAIGN_SPEND','PURCHASE','ADMIN_GRANT','ADMIN_DEDUCT','REFERRAL_BONUS','SPIN_REWARD','REFUND','SIGNUP_BONUS');

CREATE TABLE IF NOT EXISTS point_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta BIGINT NOT NULL,
  reason point_reason NOT NULL,
  balance_after BIGINT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS point_logs_user_idx  ON point_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS point_logs_reason_idx ON point_logs(reason);

-- ===== NOTIFICATIONS =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body  TEXT NOT NULL,
  type  TEXT NOT NULL DEFAULT 'info',
  data  JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at);

-- ===== REPORTS =====
CREATE TYPE report_status AS ENUM ('OPEN','REVIEWED','DISMISSED');

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reported_id UUID NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  status report_status NOT NULL DEFAULT 'OPEN',
  resolved_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at DESC);

-- ===== ADMIN LOGS =====
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_logs_actor_idx ON admin_logs(actor_id, created_at DESC);

-- ===== LUCKY WHEEL =====
CREATE TABLE IF NOT EXISTS wheel_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  points BIGINT NOT NULL,
  weight INT NOT NULL DEFAULT 10,
  color TEXT NOT NULL DEFAULT '#ff3b5c',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS spin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prize_id UUID NOT NULL REFERENCES wheel_prizes(id),
  points BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spin_logs_user_idx ON spin_logs(user_id, created_at DESC);

-- ===================================================================
-- Trigger: keep users.updated_at fresh
-- ===================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaigns_updated_at') THEN
    CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;
