# LedgerLens Database Design

## Overview

The LedgerLens schema uses **7 tables** — exactly the minimum needed for the reconciliation pipeline. No invoices, orders, notifications, agent tables, or vector stores.

---

## Why `NUMERIC` for Money

> **Never use `FLOAT` or `DOUBLE` for financial values.**

`FLOAT` uses binary floating point representation. `0.1 + 0.2 ≠ 0.3` in binary floating point. This is catastrophic for financial reconciliation where differences of a single paisa matter.

`NUMERIC(15, 2)` stores values as **exact decimal numbers**:
- 15 digits total, 2 after the decimal point
- Maximum value: `9,999,999,999,999.99` (₹9.9 trillion — sufficient for any real transaction)
- Arithmetic is exact: `9764.00 + 236.00 = 10000.00` always

```sql
-- Good
amount NUMERIC(15, 2)

-- Bad — can cause reconciliation bugs
amount FLOAT
amount DOUBLE PRECISION
```

---

## Tables

### 1. `payments`

Records every customer payment captured by the payment gateway.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `merchant_id` | TEXT | Merchant identifier (future multi-tenant) |
| `payment_id` | TEXT | Gateway payment ID (e.g. `pay_xxx`) — **unique per merchant** |
| `customer_id` | TEXT | Optional customer reference |
| `amount` | NUMERIC(15,2) | **Gross** amount the customer paid |
| `currency` | TEXT | ISO currency code (default: `INR`) |
| `status` | TEXT | `created` / `authorized` / `captured` / `failed` / `refunded` |
| `payment_method` | TEXT | `upi` / `card` / `netbanking` / `wallet` |
| `payment_date` | TIMESTAMPTZ | When the payment occurred |
| `source` | TEXT | `csv` / `razorpay_api` / `webhook` |
| `metadata` | JSONB | Source-specific extra fields |

**Key constraint:** `(merchant_id, payment_id)` is unique — prevents duplicate imports.

---

### 2. `settlements`

Represents a gateway settlement remittance to the merchant bank.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `merchant_id` | TEXT | Merchant identifier |
| `settlement_id` | TEXT | Gateway settlement ID — **unique per merchant** |
| `amount` | NUMERIC(15,2) | Gross settlement amount before deductions |
| `fees` | NUMERIC(15,2) | Processing fees deducted |
| `tax` | NUMERIC(15,2) | GST on fees (18% of fees) |
| `net_amount` | NUMERIC(15,2) | `amount - fees - tax` — what lands in bank |
| `utr` | TEXT | Unique Transaction Reference for the bank wire |
| `settlement_date` | TIMESTAMPTZ | Date of settlement |
| `status` | TEXT | `pending` / `processed` / `failed` / `reversed` |

**Critical:** The reconciliation engine compares `net_amount` against `bank_transactions.amount`.

---

### 3. `bank_transactions`

Actual credits/debits seen in the merchant's bank account statement.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `merchant_id` | TEXT | Merchant identifier |
| `bank_reference` | TEXT | Bank's own reference — **unique per merchant** |
| `utr` | TEXT | UTR if NEFT/RTGS/IMPS wire — links to `settlements.utr` |
| `amount` | NUMERIC(15,2) | Credit or debit amount |
| `transaction_type` | TEXT | `credit` / `debit` |
| `transaction_date` | TIMESTAMPTZ | When the bank recorded it |
| `description` | TEXT | Bank narration |

**Key link:** `utr` is the primary join key to `settlements`. When both records have the same UTR, this is the strongest possible match signal.

---

### 4. `reconciliation_runs`

Tracks each complete reconciliation job.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `merchant_id` | TEXT | Merchant scope |
| `started_at` | TIMESTAMPTZ | Job start time |
| `completed_at` | TIMESTAMPTZ | Job end time (NULL if running) |
| `total_records` | INTEGER | Payments processed |
| `matched_records` | INTEGER | Deterministic matches |
| `ai_resolved_records` | INTEGER | AI auto-resolved |
| `review_records` | INTEGER | Sent to human review |
| `unresolved_records` | INTEGER | No resolution possible |
| `match_rate` | NUMERIC(5,4) | `matched / total` |
| `resolution_rate` | NUMERIC(5,4) | `(matched + ai_resolved) / total` |
| `processing_time_ms` | INTEGER | Wall-clock time |
| `status` | TEXT | `pending` / `running` / `completed` / `failed` / `partial` |

---

### 5. `reconciliation_results`

One row per payment examined — the core output of the reconciliation engine.

| Column | Type | Description |
|---|---|---|
| `run_id` | UUID FK | Which run produced this result |
| `payment_id` | UUID FK | Payment examined (nullable if orphaned) |
| `settlement_id` | UUID FK | Matched settlement (NULL if missing) |
| `bank_transaction_id` | UUID FK | Matched bank transaction (NULL if missing) |
| `status` | TEXT | `matched` / `exception` / `duplicate` / `missing_bank` / `missing_settlement` |
| `confidence_score` | NUMERIC(4,3) | Deterministic evidence score (0–1) |
| `difference_amount` | NUMERIC(15,2) | Calculated discrepancy |
| `exception_type` | TEXT | One of 8 exception categories |
| `reason` | TEXT | Human-readable explanation |
| `resolution_method` | TEXT | `deterministic` / `ai_auto` / `human` |
| `final_decision` | TEXT | `AUTO_RESOLVE` / `REVIEW` / `UNRESOLVED` |
| `matching_rule` | TEXT | Which matching rule fired (RULE_1–RULE_5) |

---

### 6. `exceptions`

Structured exception records for AI investigation and human review.

| Column | Type | Description |
|---|---|---|
| `reconciliation_result_id` | UUID FK | Parent result |
| `severity` | TEXT | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `priority` | INTEGER | 1 (highest) to 100 (lowest) |
| `amount_at_risk` | NUMERIC(15,2) | Financial exposure |
| `exception_type` | TEXT | One of 8 categories |
| `ai_explanation` | TEXT | Concise AI reasoning (no chain-of-thought) |
| `ai_model` | TEXT | Model identifier |
| `ai_confidence` | NUMERIC(4,3) | AI confidence (0–1) |
| `ai_decision` | TEXT | AI's raw recommendation |
| `ai_evidence_ids` | JSONB | Array of record IDs the AI used |
| `policy_rule_applied` | TEXT | Which policy rule determined final decision |
| `final_decision` | TEXT | `AUTO_RESOLVE` / `REVIEW` / `UNRESOLVED` |
| `status` | TEXT | `open` / `auto_resolved` / `review` / `resolved` / `unresolved` |
| `resolution_reason` | TEXT | Human reviewer's reason |

---

### 7. `audit_logs`

Immutable event log. Every financial decision produces an audit entry.

| Column | Type | Description |
|---|---|---|
| `user_id` | TEXT | Supabase auth user ID (NULL = system action) |
| `action` | TEXT | Standardized action enum (13 values) |
| `entity_type` | TEXT | `exception` / `run` / `import` / `settings` |
| `entity_id` | TEXT | UUID of the affected record |
| `before_state` | JSONB | State snapshot before the change |
| `after_state` | JSONB | State snapshot after the change |
| `reason` | TEXT | Explanation |

**Note:** LLM chain-of-thought is **never** stored in audit_logs. Only the concise `ai_explanation` from `exceptions` is preserved.

---

## Relationships

```
payments ──────────────────────┐
settlements ───────────────────┼─── reconciliation_results ──┬── exceptions
bank_transactions ─────────────┘          │                  │
                                          │                  └── audit_logs
                               reconciliation_runs
                                          │
                                       audit_logs
```

- `reconciliation_results.run_id` → `reconciliation_runs.id`
- `reconciliation_results.payment_id` → `payments.id`
- `reconciliation_results.settlement_id` → `settlements.id`
- `reconciliation_results.bank_transaction_id` → `bank_transactions.id`
- `exceptions.reconciliation_result_id` → `reconciliation_results.id`

---

## Key Indexes

| Table | Index | Purpose |
|---|---|---|
| `payments` | `payment_id` | Fast lookup by gateway ID |
| `settlements` | `utr` | Primary join key for bank matching |
| `bank_transactions` | `utr`, `bank_reference` | UTR match + dedup |
| `reconciliation_results` | `run_id`, `status`, `exception_type` | Dashboard filters |
| `exceptions` | `status`, `severity`, `amount_at_risk DESC` | Priority queue |
| `audit_logs` | `entity_id`, `created_at DESC` | Entity history |

---

## Row Level Security

RLS is enabled on all tables. The backend uses the `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. Frontend uses the `SUPABASE_ANON_KEY` which is subject to RLS policies.

For the hackathon demo, a permissive policy allows all authenticated users. In production, policies would scope access to `merchant_id`.
