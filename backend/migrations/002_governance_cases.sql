CREATE TABLE IF NOT EXISTS governance_cases (
 id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, asset_id TEXT NOT NULL, classification TEXT NOT NULL,
 request_type TEXT, legal_hold BOOLEAN NOT NULL DEFAULT FALSE, payload JSONB NOT NULL, coverage JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'discovered' CHECK(status IN('discovered','classified','lineage_mapped','review_pending','approved','rejected','fulfilled')),
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, approved_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(tenant_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS governance_case_events (
 id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, case_id BIGINT NOT NULL REFERENCES governance_cases(id), actor_id TEXT NOT NULL, event_type TEXT NOT NULL,
 from_status TEXT,to_status TEXT,event_data JSONB NOT NULL DEFAULT '{}'::jsonb,occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION reject_governance_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'governance history is append-only'; END $$;
DROP TRIGGER IF EXISTS governance_case_events_immutable ON governance_case_events;
CREATE TRIGGER governance_case_events_immutable BEFORE UPDATE OR DELETE ON governance_case_events FOR EACH ROW EXECUTE FUNCTION reject_governance_event_mutation();
CREATE INDEX IF NOT EXISTS governance_cases_tenant_status_idx ON governance_cases(tenant_id,status,updated_at DESC);

