# Architecture Decision Records (ADR)

## 1. Keyset Pagination over OFFSET/LIMIT

**Decision**: Use keyset (cursor-based) pagination for transaction listings.

**Rationale**:
- OFFSET becomes slower with large datasets (1M+ rows)
- Keyset uses indexed columns (ts, id) for O(log n) performance
- Achieves p95 ≤ 100ms requirement on 1M+ transactions
- Prevents page drift when new data is inserted

**Implementation**: Cursor format `{timestamp}_{id}` encoded in base64.

---

## 2. Server-Sent Events (SSE) for Triage Streaming

**Decision**: Use SSE instead of WebSockets for real-time triage updates.

**Rationale**:
- Unidirectional: Server → Client (matches our use case)
- Simpler than WebSockets (no handshake, uses HTTP)
- Auto-reconnect built into EventSource API
- Works with standard HTTP infrastructure (load balancers, proxies)
- Lower overhead for read-only streams

**Trade-off**: Cannot push data from client during stream (acceptable for triage use case).

---

## 3. Token Bucket Rate Limiting in Redis

**Decision**: Implement rate limiting using token bucket algorithm in Redis.

**Rationale**:
- Allows burst traffic while maintaining average rate
- Distributed: Works across multiple API instances
- Fast: Redis in-memory operations
- Configurable: 5 req/s with refill every 200ms
- Returns proper 429 status with Retry-After header

**Alternative Rejected**: Sliding window (more complex, similar results).

---

## 4. Prisma ORM over Raw SQL

**Decision**: Use Prisma for database access.

**Rationale**:
- Type-safe queries (compile-time validation)
- Automatic migrations from schema
- Connection pooling built-in
- Query builder prevents SQL injection
- Good DX with IDE autocomplete

**Trade-off**: Slight performance overhead vs raw SQL (acceptable for our SLOs).

---

## 5. Composite Indexes on (customer_id, ts DESC)

**Decision**: Create composite index on transactions table.

**Rationale**:
- Most queries filter by customerId AND order by timestamp
- Single composite index serves both conditions
- Enables index-only scans for pagination
- Critical for meeting 100ms p95 latency

**Schema**: `@@index([customerId, ts(sort: Desc)])`

---

## 6. Circuit Breaker Pattern for Agent Tools

**Decision**: Implement circuit breaker with 3-failure threshold and 30s cooldown.

**Rationale**:
- Prevents cascading failures in multi-agent system
- Fails fast when tool is down (no wasted timeouts)
- Auto-recovery after cooldown period
- Critical for 5s flow budget constraint

**Parameters**: 3 consecutive failures → open for 30s.

---

## 7. Idempotency Keys with Redis Cache

**Decision**: Support Idempotency-Key header for mutations, cache responses in Redis.

**Rationale**:
- Prevents duplicate transactions on network retries
- 1-hour TTL balances memory usage vs replay window
- Returns same response for duplicate requests
- Required for financial operations (freeze card, disputes)

**Implementation**: Key format `idempotency:{key}`, stores JSON response.

---

## 8. PII Redaction at Multiple Layers

**Decision**: Redact PAN-like sequences at log level, API level, and UI level.

**Rationale**:
- Defense in depth: Multiple checkpoints
- Regex pattern: 13-19 consecutive digits → ****REDACTED****
- Applied to: Structured logs, API responses, UI display
- Prevents accidental PII leaks in traces/metrics

**Pattern**: `/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{3,7}\b/g`

---

## 9. Monorepo with Workspaces

**Decision**: Use npm workspaces for packages/api and packages/web.

**Rationale**:
- Single repo simplifies CI/CD
- Shared tooling (TypeScript, ESLint)
- Easy cross-package imports
- Atomic commits across frontend/backend

**Trade-off**: Slightly larger repo size (acceptable for team collaboration).

---

## 10. Zod for Runtime Schema Validation

**Decision**: Use Zod for API input validation and agent tool I/O.

**Rationale**:
- Runtime type checking (TypeScript only validates at compile time)
- Detailed error messages for debugging
- Composable schemas for reuse
- Prevents malformed data from reaching database

**Example**: Transaction schema validates CSV imports before insertion.

---

## 11. Prometheus Metrics over Custom Solution

**Decision**: Expose /metrics endpoint in Prometheus format.

**Rationale**:
- Industry standard for observability
- Rich ecosystem (Grafana, AlertManager)
- Pull-based model (no agent required)
- Histogram for latency, Counter for events
- Enables SLO monitoring (p95, p99)

**Metrics**: Request latency, tool calls, fallbacks, rate limits, policy blocks.

---

## 12. React Query for Data Fetching

**Decision**: Use @tanstack/react-query for API state management.

**Rationale**:
- Automatic caching and deduplication
- Background refetching
- Optimistic updates
- Error handling built-in
- Better DX than raw fetch/axios

**Configuration**: 5s stale time, 1 retry, no refetch on window focus.

---

## Summary

These decisions prioritize **performance** (keyset pagination, indexes), **reliability** (circuit breakers, fallbacks), **security** (PII redaction, RBAC), and **observability** (metrics, structured logs) while maintaining good developer experience.
