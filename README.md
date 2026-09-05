# LedgerLens

> **AI Finance Controller** — Deterministic reconciliation first. AI investigation second.

---

## What is LedgerLens?

Finance teams receive records from multiple sources — payments, settlements, and bank transactions — that don't always line up due to processing fees, taxes, timing differences, missing transactions, duplicates, and mismatches.

**LedgerLens automatically reconciles these records**, investigates exceptions using AI, and determines whether each exception can be:

- ✅ **AUTO RESOLVED** — high-confidence AI decision within safe amount threshold
- 👁 **HUMAN REVIEW** — AI confident but risk too high to auto-resolve
- ❌ **UNRESOLVED** — insufficient evidence; AI refuses to fabricate

---

## Architecture

```
React Frontend
     │ REST
     ▼
Node / Express API
     │
     ├─── Deterministic Matching Engine  ←── No AI, pure arithmetic
     ├─── AI Investigation Service       ←── Only for exceptions
     └─── Risk-Adjusted Policy Engine    ←── Confidence × Amount → Decision
     │
     ▼
Supabase PostgreSQL
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| State | TanStack Query + Zustand |
| Charts | Recharts |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase PostgreSQL |
| Validation | Zod |
| CSV Parsing | csv-parse |
| AI | Anthropic Claude (one provider only) |
| Auth | Supabase Auth |

---

## Quick Start

```bash
# Clone and install
git clone <repo>
cd ledgerlens
npm install

# Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit both .env files with your credentials

# Start development servers
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
# API health: http://localhost:3001/api/health
```

---

## Generate Synthetic Dataset

```bash
npm run generate-data
```

Generates `data/generated/`:
- `payments.csv` — 1,000 payment records
- `settlements.csv` — settlement records with fees and taxes
- `bank_transactions.csv` — bank transaction records
- `ground_truth.json` — intended match relationships and exception categories

---

## Run Reconciliation

```bash
# Via API (after data import)
curl -X POST http://localhost:3001/api/reconciliation/run

# Via CLI evaluation
npm run evaluate
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✓ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Service role key (backend only) |
| `ANTHROPIC_API_KEY` | ✓ | AI investigation provider |
| `CORS_ORIGIN` | ✓ | Frontend URL for CORS |
| `PORT` | — | API port (default: 3001) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✓ | Supabase URL (public) |
| `VITE_SUPABASE_ANON_KEY` | ✓ | Anon key (public, safe) |
| `VITE_API_URL` | — | Backend URL (empty = Vite proxy) |

> **Security**: Never put `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or `RAZORPAY_KEY_SECRET` in the frontend `.env`.

---

## Implementation Phases

| Phase | Description | Status |
|---|---|---|
| 1 | Project Foundation | ✅ |
| 2 | Supabase Database Schema & Constraints | ✅ |
| 3 | Synthetic Dataset Generator (1,000 Records) | ✅ |
| 4 | CSV Parse, Validate & Batch Import Pipeline | ✅ |
| 5 | Deterministic Reconciliation Engine (Rules 1-4) | ✅ |
| 6 | Exception Detection & Risk Classification Engine | ✅ |
| 7 | AI Investigation Service (Claude & Guardrails) | ✅ |
| 8 | Risk-Adjusted Governance Policy Engine | ✅ |
| 9 | Reconciliation Orchestrator & Execution Pipeline | ✅ |
| 10 | Immutable Audit Trail Service | ✅ |
| 11 | Financial Reporting & Analytics APIs | ✅ |
| 12 | Frontend Layout & Navigation | ✅ |
| 13 | Live Interactive Operations Dashboard | ✅ |
| 14 | Exceptions Queue & Investigation Modal | ✅ |
| 15 | Evaluation & High-Throughput Benchmarks | ✅ |

---

## Key Design Principle

> The AI should never be responsible for basic arithmetic or exact matching.
> If evidence is missing, LedgerLens returns UNRESOLVED — it never hallucinates a resolution.

---

*LedgerLens — Built for reliability, not just accuracy.*
