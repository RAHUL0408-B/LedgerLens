-- =============================================================================
-- LedgerLens Database Schema
-- PostgreSQL / Supabase
--
-- Design principles:
--   - NUMERIC(15,2) for all monetary values — never FLOAT or DOUBLE
--   - merchant_id on every table for future multi-tenant support
--   - JSONB metadata for source-specific fields without schema bloat
--   - Status constraints via CHECK to enforce valid state machines
--   - Indexes on all foreign keys, lookup fields, and filter columns
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. PAYMENTS
-- =============================================================================
-- Represents a customer payment captured by the payment gateway.
-- This is the "source of truth" for what the customer paid.
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id     TEXT        NOT NULL DEFAULT 'demo_merchant',
  payment_id      TEXT        NOT NULL,                         -- Gateway payment ID (e.g. pay_xxx)
  customer_id     TEXT,
  amount          NUMERIC(15, 2) NOT NULL,                      -- Gross payment amount
  currency        TEXT        NOT NULL DEFAULT 'INR',
  status          TEXT        NOT NULL DEFAULT 'captured'
                  CHECK (status IN ('created','authorized','captured','failed','refunded')),
  payment_method  TEXT,                                         -- upi, card, netbanking, wallet
  payment_date    TIMESTAMPTZ NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'csv',           -- csv | razorpay_api | webhook
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A payment_id must be unique within a merchant
  CONSTRAINT payments_merchant_payment_id_unique UNIQUE (merchant_id, payment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id     ON payments (merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id      ON payments (payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date    ON payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status          ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at      ON payments (created_at);

-- =============================================================================
-- 2. SETTLEMENTS
-- =============================================================================
-- Represents a settlement batch remitted by the gateway to the merchant.
-- After fees and taxes are deducted from gross payment amounts.
-- =============================================================================
CREATE TABLE IF NOT EXISTS settlements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id      TEXT           NOT NULL DEFAULT 'demo_merchant',
  settlement_id    TEXT           NOT NULL,                     -- Gateway settlement ID
  amount           NUMERIC(15, 2) NOT NULL,                     -- Gross settlement amount
  fees             NUMERIC(15, 2) NOT NULL DEFAULT 0,           -- Processing fees deducted
  tax              NUMERIC(15, 2) NOT NULL DEFAULT 0,           -- GST on fees
  net_amount       NUMERIC(15, 2) NOT NULL,                     -- amount - fees - tax
  utr              TEXT,                                        -- Unique Transaction Reference (bank wire)
  settlement_date  TIMESTAMPTZ    NOT NULL,
  status           TEXT           NOT NULL DEFAULT 'processed'
                   CHECK (status IN ('pending','processed','failed','reversed')),
  source           TEXT           NOT NULL DEFAULT 'csv',
  metadata         JSONB          DEFAULT '{}',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT settlements_merchant_settlement_id_unique UNIQUE (merchant_id, settlement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id    ON settlements (merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_settlement_id  ON settlements (settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlements_utr            ON settlements (utr);
CREATE INDEX IF NOT EXISTS idx_settlements_settlement_date ON settlements (settlement_date);
CREATE INDEX IF NOT EXISTS idx_settlements_status         ON settlements (status);
CREATE INDEX IF NOT EXISTS idx_settlements_created_at     ON settlements (created_at);

-- =============================================================================
-- 3. BANK_TRANSACTIONS
-- =============================================================================
-- Represents actual credits/debits seen in the merchant bank account.
-- This is the "ground truth" from the bank statement.
-- =============================================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id      TEXT           NOT NULL DEFAULT 'demo_merchant',
  bank_reference   TEXT           NOT NULL,                     -- Bank's own reference number
  utr              TEXT,                                        -- UTR if a NEFT/RTGS/IMPS wire
  amount           NUMERIC(15, 2) NOT NULL,
  transaction_type TEXT           NOT NULL DEFAULT 'credit'
                   CHECK (transaction_type IN ('credit','debit')),
  transaction_date TIMESTAMPTZ    NOT NULL,
  description      TEXT,
  source           TEXT           NOT NULL DEFAULT 'csv',
  metadata         JSONB          DEFAULT '{}',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_transactions_merchant_ref_unique UNIQUE (merchant_id, bank_reference)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_merchant_id        ON bank_transactions (merchant_id);
CREATE INDEX IF NOT EXISTS idx_bank_bank_reference     ON bank_transactions (bank_reference);
CREATE INDEX IF NOT EXISTS idx_bank_utr                ON bank_transactions (utr);
CREATE INDEX IF NOT EXISTS idx_bank_transaction_date   ON bank_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transaction_type   ON bank_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_bank_created_at         ON bank_transactions (created_at);

-- =============================================================================
-- 4. RECONCILIATION_RUNS
-- =============================================================================
-- Tracks each complete reconciliation job, its scope, and aggregate metrics.
-- =============================================================================
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id         TEXT           NOT NULL DEFAULT 'demo_merchant',
  started_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  total_records       INTEGER        NOT NULL DEFAULT 0,
  matched_records     INTEGER        NOT NULL DEFAULT 0,
  ai_resolved_records INTEGER        NOT NULL DEFAULT 0,
  review_records      INTEGER        NOT NULL DEFAULT 0,
  unresolved_records  INTEGER        NOT NULL DEFAULT 0,
  match_rate          NUMERIC(5, 4),                            -- 0.0000–1.0000
  resolution_rate     NUMERIC(5, 4),
  processing_time_ms  INTEGER,
  status              TEXT           NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','running','completed','failed','partial')),
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_merchant_id ON reconciliation_runs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_runs_status      ON reconciliation_runs (status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at  ON reconciliation_runs (started_at DESC);

-- =============================================================================
-- 5. RECONCILIATION_RESULTS
-- =============================================================================
-- One row per (payment, settlement, bank_transaction) triple examined.
-- Captures both deterministic matching outcome and AI investigation result.
-- =============================================================================
CREATE TABLE IF NOT EXISTS reconciliation_results (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id              UUID           NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  payment_id          UUID           REFERENCES payments(id) ON DELETE SET NULL,
  settlement_id       UUID           REFERENCES settlements(id) ON DELETE SET NULL,
  bank_transaction_id UUID           REFERENCES bank_transactions(id) ON DELETE SET NULL,
  status              TEXT           NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'matched',
                        'exception',
                        'duplicate',
                        'missing_bank',
                        'missing_settlement',
                        'pending'
                      )),
  confidence_score    NUMERIC(4, 3),                            -- 0.000–1.000
  difference_amount   NUMERIC(15, 2) DEFAULT 0,                 -- Calculated discrepancy
  exception_type      TEXT
                      CHECK (exception_type IN (
                        'FEE_DIFFERENCE',
                        'TAX_DIFFERENCE',
                        'DATE_DIFFERENCE',
                        'MISSING_BANK',
                        'MISSING_SETTLEMENT',
                        'AMOUNT_MISMATCH',
                        'DUPLICATE',
                        'UNKNOWN',
                        NULL
                      )),
  reason              TEXT,                                     -- Human-readable match/mismatch reason
  resolution_method   TEXT
                      CHECK (resolution_method IN (
                        'deterministic',
                        'ai_auto',
                        'human',
                        NULL
                      )),
  final_decision      TEXT
                      CHECK (final_decision IN (
                        'AUTO_RESOLVE',
                        'REVIEW',
                        'UNRESOLVED',
                        NULL
                      )),
  matching_rule       TEXT,                                     -- Which rule matched (RULE_1..RULE_5)
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_results_run_id        ON reconciliation_results (run_id);
CREATE INDEX IF NOT EXISTS idx_results_payment_id    ON reconciliation_results (payment_id);
CREATE INDEX IF NOT EXISTS idx_results_settlement_id ON reconciliation_results (settlement_id);
CREATE INDEX IF NOT EXISTS idx_results_bank_id       ON reconciliation_results (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_results_status        ON reconciliation_results (status);
CREATE INDEX IF NOT EXISTS idx_results_exception_type ON reconciliation_results (exception_type);
CREATE INDEX IF NOT EXISTS idx_results_final_decision ON reconciliation_results (final_decision);
CREATE INDEX IF NOT EXISTS idx_results_created_at    ON reconciliation_results (created_at);

-- =============================================================================
-- 6. EXCEPTIONS
-- =============================================================================
-- Structured exception records derived from reconciliation_results.
-- These are what the AI investigates and humans review.
-- =============================================================================
CREATE TABLE IF NOT EXISTS exceptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reconciliation_result_id UUID          NOT NULL REFERENCES reconciliation_results(id) ON DELETE CASCADE,
  severity                TEXT           NOT NULL DEFAULT 'LOW'
                          CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  priority                INTEGER        NOT NULL DEFAULT 50,   -- 1 (highest) to 100 (lowest)
  amount_at_risk          NUMERIC(15, 2) NOT NULL DEFAULT 0,
  exception_type          TEXT           NOT NULL
                          CHECK (exception_type IN (
                            'FEE_DIFFERENCE',
                            'TAX_DIFFERENCE',
                            'DATE_DIFFERENCE',
                            'MISSING_BANK',
                            'MISSING_SETTLEMENT',
                            'AMOUNT_MISMATCH',
                            'DUPLICATE',
                            'UNKNOWN'
                          )),
  -- AI investigation fields
  ai_explanation          TEXT,                                 -- Concise AI explanation only
  ai_model                TEXT,                                 -- e.g. claude-3-5-haiku-20241022
  ai_confidence           NUMERIC(4, 3),                        -- 0.000–1.000
  ai_decision             TEXT
                          CHECK (ai_decision IN ('AUTO_RESOLVE','REVIEW','UNRESOLVED', NULL)),
  ai_evidence_ids         JSONB          DEFAULT '[]',          -- Array of record IDs AI used
  ai_investigated_at      TIMESTAMPTZ,
  -- Policy engine fields
  policy_rule_applied     TEXT,
  final_decision          TEXT
                          CHECK (final_decision IN ('AUTO_RESOLVE','REVIEW','UNRESOLVED', NULL)),
  -- Workflow fields
  status                  TEXT           NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','auto_resolved','review','resolved','unresolved')),
  assigned_to             TEXT,                                 -- user ID
  resolution_reason       TEXT,                                 -- Human reviewer reason
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  resolved_at             TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exceptions_result_id   ON exceptions (reconciliation_result_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status       ON exceptions (status);
CREATE INDEX IF NOT EXISTS idx_exceptions_severity     ON exceptions (severity);
CREATE INDEX IF NOT EXISTS idx_exceptions_priority     ON exceptions (priority);
CREATE INDEX IF NOT EXISTS idx_exceptions_exception_type ON exceptions (exception_type);
CREATE INDEX IF NOT EXISTS idx_exceptions_amount_at_risk ON exceptions (amount_at_risk DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_final_decision ON exceptions (final_decision);
CREATE INDEX IF NOT EXISTS idx_exceptions_created_at   ON exceptions (created_at);

-- =============================================================================
-- 7. AUDIT_LOGS
-- =============================================================================
-- Immutable record of every significant action in the system.
-- Every financial decision must produce an audit log entry.
-- Chain-of-thought is NEVER stored here — only concise decisions.
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      TEXT,                                            -- Supabase auth user ID (NULL = system)
  action       TEXT        NOT NULL
               CHECK (action IN (
                 'IMPORT_STARTED',
                 'IMPORT_COMPLETED',
                 'IMPORT_FAILED',
                 'RECONCILIATION_STARTED',
                 'RECONCILIATION_COMPLETED',
                 'RECONCILIATION_FAILED',
                 'AI_INVESTIGATION',
                 'AUTO_RESOLUTION',
                 'REVIEW_REQUIRED',
                 'MANUAL_RESOLUTION',
                 'EXCEPTION_CREATED',
                 'EXCEPTION_UPDATED',
                 'SETTINGS_CHANGED'
               )),
  entity_type  TEXT        NOT NULL,                            -- 'exception' | 'run' | 'import' | 'settings'
  entity_id    TEXT        NOT NULL,                            -- UUID of the affected record
  before_state JSONB       DEFAULT '{}',                        -- State snapshot before change
  after_state  JSONB       DEFAULT '{}',                        -- State snapshot after change
  reason       TEXT,                                            -- Human or system explanation
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id   ON audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs (created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- For the hackathon demo we enable RLS but use a permissive policy.
-- In production, these would be scoped to authenticated users + merchant_id.
-- =============================================================================
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- Demo policy: allow all operations for authenticated users
-- The backend uses service_role key which bypasses RLS entirely
CREATE POLICY "allow_all_authenticated" ON payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON settlements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON bank_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON reconciliation_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON reconciliation_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON exceptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON audit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
