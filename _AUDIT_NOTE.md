# Audit Apply Note — AIAutomatedatagovernance

## Apply pass 5 (all backlog)

All remaining backlog items implemented additively in `backend/routes/extensions.js` (NEW), mounted at `/api/ext`. No existing routes modified except a one-line mount in `server.js`.

Implemented (7 features, cap 10):
- Snowflake / Redshift / BigQuery (NEEDS-CREDS) — 503 + `missing: <ENV>` for each provider's required vars (`SNOWFLAKE_ACCOUNT,SNOWFLAKE_USER,SNOWFLAKE_PASSWORD`; `REDSHIFT_HOST,REDSHIFT_USER,REDSHIFT_PASSWORD`; `BIGQUERY_PROJECT_ID,BIGQUERY_KEY_FILE`); discovery runs persisted to `dw_integration_runs`.
- Automated data profiling (TOO-RISKY) — in-memory profiler over caller-supplied `rows[]` (no live DB scan). Numeric vs string column heuristics, top-5 frequencies for strings, min/max/avg for numerics. PRODUCT-DECISION documented in code.
- Data quality scorecards (MECHANICAL) — six dimensions (completeness, accuracy, consistency, timeliness, validity, uniqueness) with optional weights; `quality_scorecards` table.
- Data marketplace (NEEDS-PRODUCT-DECISION) — `marketplace_listings` + `marketplace_requests`; default `access_level=request` (consumer requests, owner approves). PRODUCT-DECISION documented.
- Real-time PII streaming (NEEDS-CREDS / TOO-RISKY) — connector status gated on `PII_STREAM_BROKER,PII_STREAM_TOPIC`; additive ingest endpoint with regex PII detection (email, SSN, phone, credit-card) writes to `pii_stream_events`.

Smoke test (port 3801): login=200; snowflake=503 missing 3 vars; profile/run=200 with correct schema; scorecard=200 (overall=89.5); marketplace listing=200; pii-stream/ingest=200 detected `email,ssn`; pii-stream/status=503; unauth=401.

Constraints honored: no `npm install`, no heavy deps, all `CREATE TABLE IF NOT EXISTS`, all env-gated endpoints return `503 + missing: <ENV>`, PRODUCT-DECISION comments inline.

Source: `_AUDIT/reports/batch_00.md` § 29.

## Original audit recommendations

### Missing AI counterparts
- AI schema evolution recommendations
- AI master data matching (deduplication)

### Missing non-AI features
- Integration with data warehouses (Snowflake, Redshift, BigQuery)
- Automated data profiling
- Data quality scorecards

### Custom features
- Automated data profiling
- Master data management (AI dedup)
- Data marketplace
- Real-time PII streaming
- Cloud DW integrations: Snowflake, Redshift, BigQuery

## Implemented in this pass (MECHANICAL)

| # | Item | File | Endpoint |
|---|------|------|----------|
| 1 | AI schema evolution recommendations | `backend/routes/ai.js` | `POST /api/ai/schema-evolution` |
| 2 | AI master data matching | `backend/routes/ai.js` | `POST /api/ai/master-data-match` |

Both follow the existing pattern (`authMiddleware`, `aiRateLimiter`, `callOpenRouter`, `parseAIJson`, `persist`). `node --check` passes.

## Backlog (not implemented)

| Item | Tag | Why deferred |
|------|-----|---------------|
| Snowflake / Redshift / BigQuery integration | NEEDS-CREDS | Cloud DW credentials & SDKs |
| Automated data profiling (live DB scans) | TOO-RISKY | Requires DB connectors / SDK installs |
| Data quality scorecards | TOO-RISKY | Frontend + schema work |
| Data marketplace | NEEDS-PRODUCT-DECISION | New domain area |
| Real-time PII streaming | TOO-RISKY | Stream infra (Kafka/Kinesis) needed |

## Apply pass 4 (mechanical backlog)

- **Decision:** SKIP — every backlog item already tagged NEEDS-CREDS, TOO-RISKY, or NEEDS-PRODUCT-DECISION (cloud DW credentials, DB connectors, marketplace product decision, streaming infra, frontend scorecard work). No mechanical adds available within the spec's caps.
- **Files modified:** none.

## Apply pass 3 (frontend)

- **Stack:** React (CRA) + Express backend.
- **Backend AI endpoints surveyed:** `/api/ai/{classify, anomaly-detection, generate-policy, impact-analysis, suggest-quality-rules, generate-description, discover-sensitive, generate-pia, retention-recommendation, lineage-graph/:t, detect-access-anomalies, suggest-glossary, generate-compliance-report, balance-stewards, schema-evolution, master-data-match, history}`.
- **FE state:** All endpoints (incl. pass-2 additions `schema-evolution` + `master-data-match`) are wired in `frontend/src/services/api.js` and consumed from `components/AIAdvancedFeatures.js` / `components/AIInsights.js`.
- **Action:** LEFT-AS-IS — FE already wired (idempotence rule).
- **Files modified:** none.
