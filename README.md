<<<<<<< HEAD
# ActionTakingSystemAgainstFraudPayments
=======
# Sentinel Support: Full-Stack Fintech Case Resolution

A production-minded full-stack system for internal support agents to ingest transactions, generate AI insights, and auto-resolve cases via a multi-agent pipeline.

## Quick Start (≤3 commands)

```bash
# 1. Install dependencies
npm run install:all

# 2. Start infrastructure & seed database
docker-compose up -d && npm run db:seed

# 3. Start development servers
npm run dev:api & npm run dev:web
```

Access the application at `http://localhost:3000`

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   React + TS    │─────▶│  Express API     │─────▶│   PostgreSQL    │
│   (Port 3000)   │      │  (Port 3001)     │      │   (Port 5432)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        │                         │                          │
        │                         ▼                          │
        │                 ┌──────────────┐                  │
        └─────────────────│    Redis     │──────────────────┘
                          │  (Port 6379) │
                          └──────────────┘
```

### Component Flow

1. **Frontend (React)** - User interface with routes for dashboard, alerts, customer details, and evaluations
2. **Backend API (Express)** - RESTful API with SSE streaming for real-time updates
3. **Multi-Agent System** - Orchestrates fraud detection, KB lookup, compliance checks
4. **PostgreSQL** - Stores customers, transactions, cases, triage runs, and traces
5. **Redis** - Rate limiting (token bucket) and idempotency caching

## Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, React Query, React Router
- **Backend**: Node.js 18, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL 15 (1M+ transactions)
- **Cache/Queue**: Redis 7
- **Observability**: Prometheus metrics, Winston structured logs
- **Infra**: Docker Compose

## Key Features

### 1. Transaction Ingestion
- CSV/JSON upload with deduplication
- Idempotency keys for replay protection
- 200k+ seed data, generator for 1M+

### 2. Customer Insights
- Real-time analytics (categories, merchants, anomalies)
- Z-score anomaly detection
- Keyset pagination (p95 ≤ 100ms on 1M rows)

### 3. Multi-Agent Triage
- **Orchestrator**: Executes 6-step plan with 5s budget
- **Tools**: Profile, Transactions, Fraud Detection, KB, Compliance, Decision
- **Guardrails**: 1s timeouts, 2 retries, circuit breakers, schema validation
- **Fallbacks**: Deterministic fallback when tools fail

### 4. Actions
- **Freeze Card**: OTP verification for basic KYC
- **Open Dispute**: Reason codes (10.4, 12.1, 13.1)
- **Contact Customer**: Create follow-up case
- **Mark False Positive**: Close alert

### 5. Security & Compliance
- PAN redaction (13-19 digits → ****REDACTED****)
- RBAC (agent/lead roles)
- Audit trail for all actions
- CSP headers (no unsafe-inline)

## Database Schema

```sql
-- Core entities
customers(id, name, email_masked, kyc_level)
cards(id, customer_id, last4, network, status)
transactions(id, customer_id, card_id, mcc, merchant, amount_cents, ts)
  -- Indexes: (customer_id, ts DESC), (merchant), (mcc)

-- Alerting & Cases
alerts(id, customer_id, suspect_txn_id, risk, status)
cases(id, customer_id, txn_id, type, status, reason_code)
case_events(id, case_id, ts, actor, action, payload_json)

-- Triage & Tracing
triage_runs(id, alert_id, started_at, risk, reasons, fallback_used, latency_ms)
agent_traces(run_id, seq, step, ok, duration_ms, detail_json)

-- Knowledge Base
kb_docs(id, title, anchor, content_text)
policies(id, code, title, content_text)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest/transactions` | Ingest CSV/JSON transactions |
| GET | `/api/customer/:id/transactions` | Keyset-paginated transactions |
| GET | `/api/insights/:id/summary` | Customer analytics |
| POST | `/api/triage` | Start triage run |
| GET | `/api/triage/:runId/stream` | SSE stream for triage events |
| POST | `/api/action/freeze-card` | Freeze card (requires OTP) |
| POST | `/api/action/open-dispute` | Open dispute case |
| GET | `/api/kb/search?q=` | Search knowledge base |
| GET | `/metrics` | Prometheus metrics |
| GET | `/health` | Health check |

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://sentinel:sentinel123@localhost:5432/sentinel_support

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3001
API_KEY=sentinel-api-key-12345

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_SECOND=5

# Agent Configuration
AGENT_TIMEOUT_MS=1000
AGENT_FLOW_BUDGET_MS=5000
AGENT_MAX_RETRIES=2
```

## Acceptance Scenarios

All 7 acceptance scenarios are implemented:

1. **Freeze w/ OTP** - OTP 123456 required for basic KYC customers
2. **Dispute Creation** - Reason code 10.4 for unrecognized charges
3. **Duplicate Pending vs Captured** - Explains preauth vs capture
4. **Risk Tool Timeout → Fallback** - Graceful degradation with fallback
5. **429 Behavior** - Rate limit with Retry-After header
6. **PII Redaction** - All PANs masked in UI/logs/traces
7. **Performance** - p95 ≤ 100ms on 1M+ transactions

## Performance Optimization

### Database
- Composite indexes on `(customer_id, ts DESC)` for time-range queries
- Keyset pagination avoids OFFSET slowness
- Connection pooling via Prisma

### API
- Redis token bucket for rate limiting
- Idempotency caching (1 hour TTL)
- Streaming SSE for real-time updates

### Frontend
- React Query for caching & deduplication
- Virtual scrolling for 2k+ row tables
- Memoized components

## Scripts

```bash
# Database
npm run db:generate        # Generate Prisma client
npm run db:push            # Push schema to database
npm run db:seed            # Seed 200k transactions
npm run db:generate-transactions  # Generate 1M+ transactions

# Development
npm run dev:api            # Start API server
npm run dev:web            # Start React dev server

# Production
npm run build:api          # Build API
npm run build:web          # Build React app
npm run docker:up          # Start all services
npm run docker:down        # Stop all services

# Evaluation
npm run eval               # Run evaluation suite
```

## Metrics (Prometheus)

- `api_request_latency_ms` - API endpoint latencies
- `agent_latency_ms` - Agent execution times
- `tool_call_total{tool, ok}` - Tool invocation counts
- `agent_fallback_total{tool}` - Fallback triggers
- `rate_limit_block_total` - Rate limit rejections
- `action_blocked_total{policy}` - Policy-blocked actions

## Structured Logs (JSON)

```json
{
  "ts": "2025-01-28T10:00:00Z",
  "level": "info",
  "requestId": "req_abc123",
  "runId": "run_xyz789",
  "customerId_masked": "cust_***4567",
  "event": "decision_finalized",
  "masked": true
}
```

## Trade-Offs & Design Decisions

See [ADR.md](./ADR.md) for detailed architectural decision records.

## Project Structure

```
sentinel-support/
├── docker-compose.yml          # Infrastructure orchestration
├── packages/
│   ├── api/                    # Backend Express API
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   ├── fixtures/           # Seed data (JSON)
│   │   └── src/
│   │       ├── agents/         # Multi-agent system
│   │       ├── lib/            # Prisma & Redis clients
│   │       ├── middleware/     # Rate limiter, auth, logging
│   │       ├── routes/         # API endpoints
│   │       ├── scripts/        # Seed & eval scripts
│   │       └── utils/          # Metrics, logger, redactor
│   └── web/                    # React frontend
│       └── src/
│           ├── components/     # React components
│           ├── pages/          # Route pages
│           ├── lib/            # API client
│           └── hooks/          # Custom hooks
├── README.md                   # This file
└── ADR.md                      # Architecture decisions
```

## Development Workflow

1. Make code changes
2. Backend auto-reloads via `tsx watch`
3. Frontend hot-reloads via Vite HMR
4. Test endpoints via `/metrics` and `/health`
5. Check logs in console (structured JSON)

## Testing

```bash
# Run evaluation suite
npm run eval

# Output includes:
# - Task success rate
# - Fallback rate by tool
# - Agent latency p50/p95
# - Risk confusion matrix
# - Top policy denials
```

## License

Proprietary - Internal Use Only

## Authors

Built for fintech case resolution with production-grade observability and safety.
>>>>>>> 54bae97 (Initial project.)
