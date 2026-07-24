const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'airline_data_governance';

const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

function requireDemoPassword() {
  const password = process.env.DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD || process.env.DEMO_SEED_PASSWORD || '';
  if (password.length < 12 || password.length > 1024) throw new Error('DEMO_PASSWORD must contain 12-1024 characters');
  return password;
}

async function createDatabase() {
  const pool = new Pool({ ...baseConfig, database: 'postgres' });
  try {
    const res = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );
    if (res.rowCount === 0) {
      await pool.query(`CREATE DATABASE ${DB_NAME}`);
      console.log(`Database "${DB_NAME}" created.`);
    } else {
      console.log(`Database "${DB_NAME}" already exists.`);
    }
  } finally {
    await pool.end();
  }
}

async function seed() {
  await createDatabase();

  const pool = new Pool({ ...baseConfig, database: DB_NAME });

  try {
    // ── Create Tables ─────────────────────────────────────────────────

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_catalog (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        schema_name VARCHAR(100) DEFAULT 'public',
        database_name VARCHAR(100),
        source_system VARCHAR(255),
        description TEXT,
        owner VARCHAR(255),
        row_count BIGINT DEFAULT 0,
        column_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS data_classification (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        column_name VARCHAR(255) NOT NULL,
        classification_level VARCHAR(20) NOT NULL,
        data_type VARCHAR(50),
        pii_flag BOOLEAN DEFAULT false,
        phi_flag BOOLEAN DEFAULT false,
        pci_flag BOOLEAN DEFAULT false,
        classified_by VARCHAR(255),
        classification_method VARCHAR(50),
        confidence_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_quality_rules (
        id SERIAL PRIMARY KEY,
        rule_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255),
        column_name VARCHAR(255),
        rule_type VARCHAR(50) NOT NULL,
        rule_expression TEXT,
        threshold DECIMAL(5,2),
        current_score DECIMAL(5,2),
        status VARCHAR(20) DEFAULT 'active',
        last_checked TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_lineage (
        id SERIAL PRIMARY KEY,
        source_system VARCHAR(255) NOT NULL,
        source_table VARCHAR(255) NOT NULL,
        target_system VARCHAR(255) NOT NULL,
        target_table VARCHAR(255) NOT NULL,
        transformation_type VARCHAR(100),
        transformation_logic TEXT,
        data_flow_direction VARCHAR(50),
        refresh_frequency VARCHAR(50),
        last_sync TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS metadata_repository (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        column_name VARCHAR(255),
        data_type VARCHAR(100),
        description TEXT,
        business_definition TEXT,
        technical_owner VARCHAR(255),
        business_owner VARCHAR(255),
        last_updated TIMESTAMP DEFAULT NOW(),
        tags TEXT[],
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_policies (
        id SERIAL PRIMARY KEY,
        policy_name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        scope VARCHAR(255),
        enforcement_level VARCHAR(20) DEFAULT 'mandatory',
        status VARCHAR(20) DEFAULT 'active',
        effective_date DATE,
        review_date DATE,
        owner VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_stewards (
        id SERIAL PRIMARY KEY,
        steward_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        department VARCHAR(100),
        domain VARCHAR(100),
        responsibility_area TEXT,
        tables_managed TEXT[],
        status VARCHAR(20) DEFAULT 'active',
        assigned_date DATE,
        last_review DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS compliance_records (
        id SERIAL PRIMARY KEY,
        regulation VARCHAR(50) NOT NULL,
        requirement TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'in_progress',
        evidence TEXT,
        risk_level VARCHAR(20),
        responsible_party VARCHAR(255),
        due_date DATE,
        last_assessed DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS access_control (
        id SERIAL PRIMARY KEY,
        resource_name VARCHAR(255) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        role_name VARCHAR(100),
        permission_level VARCHAR(20) NOT NULL,
        granted_by VARCHAR(255),
        granted_to VARCHAR(255),
        department VARCHAR(100),
        justification TEXT,
        expiry_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS data_glossary (
        id SERIAL PRIMARY KEY,
        term VARCHAR(255) NOT NULL,
        definition TEXT NOT NULL,
        category VARCHAR(100),
        synonyms TEXT[],
        related_terms TEXT[],
        domain VARCHAR(100),
        owner VARCHAR(255),
        status VARCHAR(20) DEFAULT 'approved',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INT,
        entity_name VARCHAR(255),
        performed_by VARCHAR(255),
        details TEXT,
        ip_address VARCHAR(45),
        status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Full-text search index for data_catalog
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_data_catalog_search
      ON data_catalog USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')))
    `).catch(() => {
      // data_catalog uses table_name not name — use correct column
    });
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_data_catalog_search
      ON data_catalog USING gin(to_tsvector('english', table_name || ' ' || COALESCE(description, '')))
    `).catch((e) => console.warn('GIN index creation skipped:', e.message));

    // AI results JSONB persistence table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(120) NOT NULL,
        input_data JSONB NOT NULL,
        result_data JSONB NOT NULL,
        user_id INTEGER,
        model_used VARCHAR(255),
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_endpoint ON ai_results(endpoint)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_user ON ai_results(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_results_created ON ai_results(created_at DESC)`);

    // Webhooks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        url TEXT NOT NULL,
        events JSONB NOT NULL DEFAULT '[]',
        secret VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Retention columns on data_policies
    await pool.query(`
      ALTER TABLE data_policies
      ADD COLUMN IF NOT EXISTS retention_date DATE,
      ADD COLUMN IF NOT EXISTS expired_status BOOLEAN DEFAULT false
    `).catch((e) => console.warn('Retention columns already exist:', e.message));

    console.log('All tables created.');

    // ── Seed Users ────────────────────────────────────────────────────

    const adminHash = await bcrypt.hash(requireDemoPassword(), 10);
    await pool.query(`DELETE FROM users`);
    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, department) VALUES
        ('admin@skylineairways.com', $1, 'Sarah Mitchell', 'admin', 'Data Governance'),
        ('j.chen@skylineairways.com', $1, 'James Chen', 'data_steward', 'Flight Operations'),
        ('m.rodriguez@skylineairways.com', $1, 'Maria Rodriguez', 'analyst', 'Revenue Management'),
        ('d.patel@skylineairways.com', $1, 'Deepak Patel', 'engineer', 'IT Infrastructure'),
        ('l.johnson@skylineairways.com', $1, 'Lisa Johnson', 'viewer', 'Compliance')
    `, [adminHash]);
    console.log('Users seeded.');

    // ── Seed Data Catalog ─────────────────────────────────────────────

    await pool.query(`DELETE FROM data_catalog`);
    await pool.query(`
      INSERT INTO data_catalog (table_name, schema_name, database_name, source_system, description, owner, row_count, column_count, status) VALUES
        ('flight_operations', 'ops', 'airline_ops_db', 'ACARS', 'Real-time and historical flight operations data including departure, arrival, delays, and diversions', 'James Chen', 28500000, 42, 'active'),
        ('passenger_manifests', 'pax', 'airline_pax_db', 'Departure Control System', 'Passenger manifest records for all flights including check-in and boarding status', 'Maria Lopez', 95000000, 35, 'active'),
        ('booking_transactions', 'revenue', 'airline_rev_db', 'Amadeus', 'All booking and reservation transactions across direct and indirect channels', 'Robert Kim', 320000000, 58, 'active'),
        ('loyalty_members', 'crm', 'airline_crm_db', 'Navitaire', 'Frequent flyer loyalty program member profiles, tiers, and point balances', 'Angela Wu', 12000000, 28, 'active'),
        ('crew_schedules', 'ops', 'airline_ops_db', 'AIMS', 'Crew scheduling, assignments, duty times, and rest period compliance records', 'Tom Bradley', 4500000, 31, 'active'),
        ('aircraft_maintenance', 'maint', 'airline_maint_db', 'AMOS', 'Aircraft maintenance records, service bulletins, MEL items, and airworthiness directives', 'Karen Singh', 18000000, 47, 'active'),
        ('baggage_tracking', 'ops', 'airline_ops_db', 'BagLink', 'End-to-end baggage tracking from check-in through delivery including mishandled bags', 'David Okafor', 150000000, 22, 'active'),
        ('revenue_management', 'revenue', 'airline_rev_db', 'Sabre', 'Revenue optimization data including fare classes, yield, and load factors', 'Maria Rodriguez', 85000000, 39, 'active'),
        ('customer_feedback', 'crm', 'airline_crm_db', 'Medallia', 'Customer surveys, NPS scores, complaints, and compliments across all touchpoints', 'Lisa Park', 6200000, 19, 'active'),
        ('weather_data', 'ops', 'airline_ops_db', 'NOAA/WSI', 'Aviation weather data including METARs, TAFs, SIGMETs for route planning', 'James Chen', 500000000, 15, 'active'),
        ('fuel_consumption', 'ops', 'airline_ops_db', 'ACARS', 'Flight-level fuel burn data for consumption analysis and carbon reporting', 'Tom Bradley', 35000000, 24, 'active'),
        ('catering_orders', 'inflight', 'airline_svc_db', 'LSG CaterLink', 'In-flight catering orders, meal preferences, and special dietary requirements', 'Nina Patel', 22000000, 18, 'active'),
        ('gate_assignments', 'ops', 'airline_ops_db', 'AODB', 'Airport gate assignment records including stand allocations and ground handling', 'David Okafor', 8500000, 16, 'active'),
        ('ticket_pricing', 'revenue', 'airline_rev_db', 'ATPCO', 'Published fare data, pricing rules, and tariff information across all markets', 'Robert Kim', 250000000, 52, 'active'),
        ('safety_incidents', 'safety', 'airline_safety_db', 'ASAP/ASRS', 'Safety incident reports, hazard analyses, and corrective action tracking', 'Karen Singh', 450000, 33, 'active'),
        ('cargo_manifests', 'cargo', 'airline_cargo_db', 'CHAMP Cargospot', 'Air cargo shipment manifests, AWBs, and dangerous goods declarations', 'Brian Hoffman', 42000000, 37, 'active'),
        ('ancillary_services', 'revenue', 'airline_rev_db', 'Datalex', 'Ancillary revenue data: seat upgrades, extra baggage, lounge access, Wi-Fi', 'Maria Rodriguez', 78000000, 21, 'active')
    `);
    console.log('Data catalog seeded.');

    // ── Seed Data Classification ──────────────────────────────────────

    await pool.query(`DELETE FROM data_classification`);
    await pool.query(`
      INSERT INTO data_classification (table_name, column_name, classification_level, data_type, pii_flag, phi_flag, pci_flag, classified_by, classification_method, confidence_score) VALUES
        ('passenger_manifests', 'passenger_name', 'Restricted', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 98.5),
        ('passenger_manifests', 'passport_number', 'Restricted', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 99.2),
        ('passenger_manifests', 'date_of_birth', 'Confidential', 'DATE', true, false, false, 'AI Classifier', 'automated', 97.8),
        ('booking_transactions', 'credit_card_number', 'Restricted', 'VARCHAR', false, false, true, 'AI Classifier', 'automated', 99.9),
        ('booking_transactions', 'billing_address', 'Confidential', 'VARCHAR', true, false, false, 'Data Steward', 'manual', 95.0),
        ('booking_transactions', 'booking_amount', 'Internal', 'DECIMAL', false, false, false, 'AI Classifier', 'automated', 92.3),
        ('loyalty_members', 'email_address', 'Confidential', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 98.1),
        ('loyalty_members', 'phone_number', 'Confidential', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 97.6),
        ('loyalty_members', 'mileage_balance', 'Internal', 'BIGINT', false, false, false, 'Data Steward', 'manual', 90.0),
        ('crew_schedules', 'crew_member_name', 'Confidential', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 96.4),
        ('crew_schedules', 'employee_id', 'Internal', 'VARCHAR', true, false, false, 'Data Steward', 'manual', 88.0),
        ('customer_feedback', 'customer_email', 'Confidential', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 97.9),
        ('customer_feedback', 'feedback_text', 'Internal', 'TEXT', false, false, false, 'AI Classifier', 'automated', 85.2),
        ('safety_incidents', 'incident_description', 'Confidential', 'TEXT', false, false, false, 'Data Steward', 'manual', 91.0),
        ('safety_incidents', 'reporter_name', 'Restricted', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 96.7),
        ('flight_operations', 'flight_number', 'Public', 'VARCHAR', false, false, false, 'AI Classifier', 'automated', 99.5),
        ('flight_operations', 'departure_time', 'Public', 'TIMESTAMP', false, false, false, 'AI Classifier', 'automated', 99.1),
        ('aircraft_maintenance', 'maintenance_notes', 'Internal', 'TEXT', false, false, false, 'Data Steward', 'manual', 87.5),
        ('cargo_manifests', 'shipper_name', 'Confidential', 'VARCHAR', true, false, false, 'AI Classifier', 'automated', 94.3),
        ('passenger_manifests', 'medical_info', 'Restricted', 'TEXT', true, true, false, 'AI Classifier', 'automated', 99.7)
    `);
    console.log('Data classification seeded.');

    // ── Seed Data Quality Rules ───────────────────────────────────────

    await pool.query(`DELETE FROM data_quality_rules`);
    await pool.query(`
      INSERT INTO data_quality_rules (rule_name, table_name, column_name, rule_type, rule_expression, threshold, current_score, status, last_checked) VALUES
        ('Flight Number Format', 'flight_operations', 'flight_number', 'validity', 'REGEXP_MATCH(flight_number, ''^[A-Z]{2}[0-9]{1,4}$'')', 99.00, 99.72, 'active', NOW() - INTERVAL '2 hours'),
        ('Passenger Name Completeness', 'passenger_manifests', 'passenger_name', 'completeness', 'passenger_name IS NOT NULL AND LENGTH(passenger_name) > 1', 99.50, 99.89, 'active', NOW() - INTERVAL '1 hour'),
        ('Booking Amount Accuracy', 'booking_transactions', 'booking_amount', 'accuracy', 'booking_amount > 0 AND booking_amount < 50000', 98.00, 97.45, 'warning', NOW() - INTERVAL '30 minutes'),
        ('Email Format Validation', 'loyalty_members', 'email_address', 'validity', 'email_address ~ ''^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z]{2,}$''', 97.00, 96.12, 'warning', NOW() - INTERVAL '4 hours'),
        ('Departure-Arrival Time Consistency', 'flight_operations', 'arrival_time', 'consistency', 'arrival_time > departure_time', 99.90, 99.95, 'active', NOW() - INTERVAL '1 hour'),
        ('Credit Card Masking Check', 'booking_transactions', 'credit_card_number', 'validity', 'credit_card_number ~ ''^\\*{12}[0-9]{4}$''', 100.00, 99.98, 'active', NOW() - INTERVAL '15 minutes'),
        ('Crew Duty Hours Limit', 'crew_schedules', 'duty_hours', 'accuracy', 'duty_hours <= 14 AND duty_hours >= 0', 100.00, 99.80, 'active', NOW() - INTERVAL '3 hours'),
        ('Baggage Weight Reasonableness', 'baggage_tracking', 'weight_kg', 'accuracy', 'weight_kg > 0 AND weight_kg <= 50', 95.00, 94.20, 'warning', NOW() - INTERVAL '6 hours'),
        ('Fuel Consumption Non-Negative', 'fuel_consumption', 'fuel_burned_kg', 'validity', 'fuel_burned_kg >= 0', 99.99, 100.00, 'active', NOW() - INTERVAL '2 hours'),
        ('Gate Assignment Uniqueness', 'gate_assignments', 'gate_number', 'uniqueness', 'UNIQUE(gate_number, airport_code, assignment_time)', 99.00, 98.50, 'active', NOW() - INTERVAL '1 hour'),
        ('Ticket Price Timeliness', 'ticket_pricing', 'effective_date', 'timeliness', 'effective_date >= CURRENT_DATE - INTERVAL ''365 days''', 95.00, 88.30, 'critical', NOW() - INTERVAL '24 hours'),
        ('Safety Incident Completeness', 'safety_incidents', 'incident_description', 'completeness', 'incident_description IS NOT NULL AND LENGTH(incident_description) > 20', 100.00, 97.60, 'warning', NOW() - INTERVAL '12 hours'),
        ('Passport Number Format', 'passenger_manifests', 'passport_number', 'validity', 'LENGTH(passport_number) BETWEEN 6 AND 12', 98.00, 98.92, 'active', NOW() - INTERVAL '5 hours'),
        ('Cargo Weight Consistency', 'cargo_manifests', 'total_weight_kg', 'consistency', 'total_weight_kg = SUM(piece_weights)', 99.00, 96.70, 'warning', NOW() - INTERVAL '8 hours'),
        ('NPS Score Range', 'customer_feedback', 'nps_score', 'validity', 'nps_score BETWEEN 0 AND 10', 100.00, 100.00, 'active', NOW() - INTERVAL '1 hour'),
        ('Maintenance Record Completeness', 'aircraft_maintenance', 'work_order_id', 'completeness', 'work_order_id IS NOT NULL', 100.00, 99.99, 'active', NOW() - INTERVAL '4 hours'),
        ('Loyalty Tier Validity', 'loyalty_members', 'tier_status', 'validity', 'tier_status IN (''Blue'', ''Silver'', ''Gold'', ''Platinum'', ''Diamond'')', 100.00, 99.85, 'active', NOW() - INTERVAL '6 hours')
    `);
    console.log('Data quality rules seeded.');

    // ── Seed Data Lineage ─────────────────────────────────────────────

    await pool.query(`DELETE FROM data_lineage`);
    await pool.query(`
      INSERT INTO data_lineage (source_system, source_table, target_system, target_table, transformation_type, transformation_logic, data_flow_direction, refresh_frequency, last_sync, status) VALUES
        ('Amadeus', 'reservations', 'Data Warehouse', 'booking_transactions', 'ETL', 'Extract PNR data, normalize fare components, convert currencies to USD, enrich with route info', 'inbound', 'every 15 minutes', NOW() - INTERVAL '10 minutes', 'active'),
        ('Departure Control System', 'checkin_events', 'Data Warehouse', 'passenger_manifests', 'ETL', 'Merge check-in, boarding, and gate data into unified passenger manifest view', 'inbound', 'real-time', NOW() - INTERVAL '2 minutes', 'active'),
        ('ACARS', 'flight_telemetry', 'Data Warehouse', 'flight_operations', 'Streaming', 'Ingest ACARS OOOI messages, parse timestamps, calculate block/flight times', 'inbound', 'real-time', NOW() - INTERVAL '1 minute', 'active'),
        ('ACARS', 'fuel_reports', 'Data Warehouse', 'fuel_consumption', 'ETL', 'Aggregate fuel uplift, burn, and remaining fuel per flight leg', 'inbound', 'every 30 minutes', NOW() - INTERVAL '25 minutes', 'active'),
        ('AIMS', 'crew_roster', 'Data Warehouse', 'crew_schedules', 'ETL', 'Import crew pairings, calculate duty/rest periods, flag FTL violations', 'inbound', 'daily', NOW() - INTERVAL '8 hours', 'active'),
        ('Navitaire', 'loyalty_accounts', 'Data Warehouse', 'loyalty_members', 'ETL', 'Sync member profiles, recalculate tier status, aggregate mileage earn/burn', 'inbound', 'every 6 hours', NOW() - INTERVAL '3 hours', 'active'),
        ('AMOS', 'work_orders', 'Data Warehouse', 'aircraft_maintenance', 'ETL', 'Extract maintenance tasks, map to ATA chapters, calculate MTBF/MTTR', 'inbound', 'every 4 hours', NOW() - INTERVAL '2 hours', 'active'),
        ('BagLink', 'bag_events', 'Data Warehouse', 'baggage_tracking', 'Streaming', 'Process BSM/BPM messages, build bag journey timeline, flag mishandled bags', 'inbound', 'real-time', NOW() - INTERVAL '30 seconds', 'active'),
        ('Sabre', 'availability_snapshots', 'Data Warehouse', 'revenue_management', 'ETL', 'Capture fare class availability, calculate RASKs and load factors by route', 'inbound', 'hourly', NOW() - INTERVAL '45 minutes', 'active'),
        ('Medallia', 'survey_responses', 'Data Warehouse', 'customer_feedback', 'ETL', 'Ingest NPS/CSAT surveys, run sentiment analysis, link to flight/booking', 'inbound', 'daily', NOW() - INTERVAL '14 hours', 'active'),
        ('Data Warehouse', 'booking_transactions', 'BI Platform', 'revenue_dashboard', 'Aggregation', 'Aggregate bookings by route, channel, fare class for revenue reporting', 'outbound', 'hourly', NOW() - INTERVAL '30 minutes', 'active'),
        ('Data Warehouse', 'flight_operations', 'BI Platform', 'otp_dashboard', 'Aggregation', 'Calculate OTP metrics: D0, D15, A14 by route, hub, aircraft type', 'outbound', 'every 30 minutes', NOW() - INTERVAL '20 minutes', 'active'),
        ('NOAA/WSI', 'weather_feeds', 'Data Warehouse', 'weather_data', 'Streaming', 'Parse METAR/TAF/SIGMET, geocode stations, join with route network', 'inbound', 'every 5 minutes', NOW() - INTERVAL '3 minutes', 'active'),
        ('AODB', 'flight_info_display', 'Data Warehouse', 'gate_assignments', 'ETL', 'Extract gate/stand assignments, calculate turnaround times', 'inbound', 'every 10 minutes', NOW() - INTERVAL '7 minutes', 'active'),
        ('ATPCO', 'fare_filings', 'Data Warehouse', 'ticket_pricing', 'ETL', 'Load published fares, rules, and footnotes; apply market-specific logic', 'inbound', 'twice daily', NOW() - INTERVAL '10 hours', 'active'),
        ('ASAP', 'safety_reports', 'Data Warehouse', 'safety_incidents', 'ETL', 'De-identify reporter info, classify by taxonomy, assign risk severity', 'inbound', 'daily', NOW() - INTERVAL '20 hours', 'active'),
        ('CHAMP Cargospot', 'awb_records', 'Data Warehouse', 'cargo_manifests', 'ETL', 'Parse AWBs, validate DGR compliance, calculate volumetric weights', 'inbound', 'every 2 hours', NOW() - INTERVAL '1 hour', 'active')
    `);
    console.log('Data lineage seeded.');

    // ── Seed Metadata Repository ──────────────────────────────────────

    await pool.query(`DELETE FROM metadata_repository`);
    await pool.query(`
      INSERT INTO metadata_repository (table_name, column_name, data_type, description, business_definition, technical_owner, business_owner, tags) VALUES
        ('flight_operations', 'flight_number', 'VARCHAR(10)', 'IATA flight designator', 'The unique identifier for a scheduled flight consisting of the airline code and numeric suffix (e.g., SA1234)', 'James Chen', 'VP Flight Operations', ARRAY['flight', 'identifier', 'operations']),
        ('flight_operations', 'departure_time', 'TIMESTAMP', 'Scheduled departure time in UTC', 'The planned gate departure time as published in the schedule. Actual times stored separately.', 'James Chen', 'VP Flight Operations', ARRAY['flight', 'schedule', 'time']),
        ('passenger_manifests', 'pnr_locator', 'VARCHAR(6)', 'Passenger Name Record locator', 'Six-character alphanumeric record locator uniquely identifying a booking in the reservation system', 'Maria Lopez', 'VP Customer Experience', ARRAY['booking', 'passenger', 'identifier']),
        ('booking_transactions', 'total_fare', 'DECIMAL(12,2)', 'Total fare amount in USD', 'The complete ticket price including base fare, taxes, surcharges, and ancillary fees in US dollars', 'Robert Kim', 'VP Revenue Management', ARRAY['revenue', 'pricing', 'financial']),
        ('booking_transactions', 'booking_channel', 'VARCHAR(50)', 'Sales distribution channel', 'The channel through which the booking was made: Website, Mobile App, GDS, Travel Agent, Call Center', 'Robert Kim', 'VP Revenue Management', ARRAY['revenue', 'distribution', 'channel']),
        ('loyalty_members', 'tier_status', 'VARCHAR(20)', 'Loyalty program tier', 'Current membership tier in the SkyMiles program based on qualifying miles and segments in the calendar year', 'Angela Wu', 'VP Loyalty Programs', ARRAY['loyalty', 'customer', 'tier']),
        ('crew_schedules', 'duty_hours', 'DECIMAL(4,1)', 'Total duty period hours', 'Cumulative duty time from report to release, used for FTL compliance monitoring per FAR Part 117', 'Tom Bradley', 'VP Flight Operations', ARRAY['crew', 'safety', 'compliance']),
        ('aircraft_maintenance', 'next_check_date', 'DATE', 'Next scheduled maintenance check', 'The date of the next required maintenance check (A/B/C/D) based on flight hours, cycles, or calendar interval', 'Karen Singh', 'VP Engineering', ARRAY['maintenance', 'safety', 'schedule']),
        ('baggage_tracking', 'bag_tag_number', 'VARCHAR(10)', '10-digit IATA bag tag', 'Unique 10-digit bag identification number per IATA Resolution 740, printed as barcode on the bag tag', 'David Okafor', 'VP Ground Operations', ARRAY['baggage', 'tracking', 'identifier']),
        ('revenue_management', 'load_factor', 'DECIMAL(5,2)', 'Passenger load factor percentage', 'The ratio of revenue passenger kilometers to available seat kilometers, expressed as a percentage', 'Maria Rodriguez', 'VP Revenue Management', ARRAY['revenue', 'kpi', 'performance']),
        ('customer_feedback', 'nps_score', 'INT', 'Net Promoter Score (0-10)', 'Customer rating on the standard NPS question: How likely are you to recommend Skyline Airways to a friend?', 'Lisa Park', 'VP Customer Experience', ARRAY['customer', 'satisfaction', 'kpi']),
        ('weather_data', 'metar_raw', 'TEXT', 'Raw METAR observation', 'Unprocessed METAR weather observation string from the Automated Surface Observing System (ASOS)', 'James Chen', 'VP Flight Operations', ARRAY['weather', 'operations', 'safety']),
        ('fuel_consumption', 'fuel_burned_kg', 'DECIMAL(10,2)', 'Total fuel burned in kilograms', 'Actual fuel consumption for the flight leg measured from engine start to engine shutdown via ACARS', 'Tom Bradley', 'VP Flight Operations', ARRAY['fuel', 'cost', 'sustainability']),
        ('safety_incidents', 'severity_level', 'VARCHAR(20)', 'Incident severity classification', 'Risk severity rating per SMS taxonomy: Minor, Moderate, Serious, Hazardous, Catastrophic', 'Karen Singh', 'VP Safety', ARRAY['safety', 'risk', 'compliance']),
        ('cargo_manifests', 'awb_number', 'VARCHAR(11)', 'Air Waybill number', '11-digit AWB number per IATA standard: 3-digit airline prefix plus 8-digit serial number', 'Brian Hoffman', 'VP Cargo', ARRAY['cargo', 'logistics', 'identifier']),
        ('ticket_pricing', 'fare_basis_code', 'VARCHAR(15)', 'Fare basis code', 'ATPCO fare basis code encoding cabin, booking class, restrictions, and validity conditions', 'Robert Kim', 'VP Revenue Management', ARRAY['pricing', 'revenue', 'fare']),
        ('gate_assignments', 'turnaround_minutes', 'INT', 'Aircraft turnaround time', 'Elapsed minutes from arrival on-blocks to departure off-blocks at the assigned gate', 'David Okafor', 'VP Ground Operations', ARRAY['operations', 'performance', 'ground'])
    `);
    console.log('Metadata repository seeded.');

    // ── Seed Data Policies ────────────────────────────────────────────

    await pool.query(`DELETE FROM data_policies`);
    await pool.query(`
      INSERT INTO data_policies (policy_name, category, description, scope, enforcement_level, status, effective_date, review_date, owner) VALUES
        ('PII Data Retention Policy', 'retention', 'Personal Identifiable Information must be retained for no more than 7 years after last customer interaction and purged within 90 days of retention expiry.', 'All PII data across CRM and booking systems', 'mandatory', 'active', '2024-01-01', '2025-01-01', 'Sarah Mitchell'),
        ('Passenger Data Privacy Policy', 'privacy', 'All passenger data including names, travel documents, and itineraries must be encrypted at rest and in transit. Access restricted to need-to-know basis.', 'passenger_manifests, booking_transactions, loyalty_members', 'mandatory', 'active', '2024-01-15', '2025-01-15', 'Sarah Mitchell'),
        ('Credit Card Data Security Policy', 'security', 'Payment card data must comply with PCI-DSS v4.0. Card numbers must be tokenized immediately upon capture. Raw PANs never stored in data warehouse.', 'booking_transactions payment fields', 'mandatory', 'active', '2024-02-01', '2024-08-01', 'Deepak Patel'),
        ('Data Quality SLA Policy', 'quality', 'All Tier-1 data assets must maintain a minimum quality score of 95%. Quality checks must run at least every 6 hours with automated alerting.', 'All Tier-1 classified data assets', 'mandatory', 'active', '2024-03-01', '2025-03-01', 'Sarah Mitchell'),
        ('Cross-Border Data Transfer Policy', 'privacy', 'Passenger data transferred between EU and non-EU regions must comply with GDPR adequacy decisions or Standard Contractual Clauses.', 'All data containing EU passenger information', 'mandatory', 'active', '2024-01-01', '2024-12-01', 'Lisa Johnson'),
        ('Safety Data Access Policy', 'access', 'Safety incident data is restricted to Safety department and authorized investigators. Reporter identity must be protected under ASAP program guidelines.', 'safety_incidents table', 'mandatory', 'active', '2024-04-01', '2025-04-01', 'Karen Singh'),
        ('Data Classification Review Policy', 'security', 'All data assets must be classified within 30 days of creation. Classifications must be reviewed annually or upon significant schema changes.', 'All data assets in the catalog', 'mandatory', 'active', '2024-01-01', '2025-01-01', 'Sarah Mitchell'),
        ('Crew Data Handling Policy', 'privacy', 'Crew personal data including schedules, duty hours, and medical certificates must be handled per employment data protection regulations.', 'crew_schedules, crew_medical_records', 'mandatory', 'active', '2024-05-01', '2025-05-01', 'Tom Bradley'),
        ('Revenue Data Retention Policy', 'retention', 'Revenue and pricing data must be retained for 10 years for DOT compliance and tax audit purposes. Archived data must remain queryable.', 'booking_transactions, ticket_pricing, revenue_management', 'mandatory', 'active', '2024-01-01', '2025-06-01', 'Robert Kim'),
        ('Data Masking Policy', 'security', 'Non-production environments must use masked or synthetic data. PII fields must be irreversibly anonymized in dev/test/staging databases.', 'All non-production database environments', 'mandatory', 'active', '2024-06-01', '2025-06-01', 'Deepak Patel'),
        ('Metadata Management Policy', 'quality', 'All data assets must have complete metadata including business definitions, technical owners, and data lineage documented within 60 days of deployment.', 'All production data assets', 'mandatory', 'active', '2024-02-15', '2025-02-15', 'Sarah Mitchell'),
        ('Third-Party Data Sharing Policy', 'access', 'Sharing data with GDS partners, codeshare airlines, and ground handlers requires DPA agreements and data minimization principles.', 'All data shared externally', 'mandatory', 'active', '2024-03-15', '2025-03-15', 'Lisa Johnson'),
        ('Cargo Dangerous Goods Data Policy', 'security', 'DGR shipment data must be retained for minimum 5 years. Access restricted to certified DG handlers and compliance officers.', 'cargo_manifests DGR records', 'mandatory', 'active', '2024-01-01', '2025-01-01', 'Brian Hoffman'),
        ('Data Archival Policy', 'retention', 'Data older than 3 years must be moved to cold storage tier. Archive must maintain full query capability with max 30-second response time.', 'All data warehouse tables', 'recommended', 'active', '2024-07-01', '2025-07-01', 'Deepak Patel'),
        ('AI Model Governance Policy', 'quality', 'All AI/ML models consuming airline data must be registered, versioned, and audited. Model predictions affecting passengers require human-in-the-loop review.', 'All AI/ML models and training datasets', 'mandatory', 'draft', '2025-01-01', '2025-12-01', 'Sarah Mitchell'),
        ('Incident Data Breach Notification Policy', 'security', 'Any data breach involving passenger PII must be reported to DPA within 72 hours per GDPR. Affected passengers must be notified within 7 days.', 'All PII-containing data assets', 'mandatory', 'active', '2024-01-01', '2024-12-31', 'Lisa Johnson')
    `);
    console.log('Data policies seeded.');

    // ── Seed Data Stewards ────────────────────────────────────────────

    await pool.query(`DELETE FROM data_stewards`);
    await pool.query(`
      INSERT INTO data_stewards (steward_name, email, department, domain, responsibility_area, tables_managed, status, assigned_date, last_review) VALUES
        ('James Chen', 'j.chen@skylineairways.com', 'Flight Operations', 'Operations', 'Flight operations data quality, ACARS data integrity, and operational reporting accuracy', ARRAY['flight_operations', 'weather_data', 'gate_assignments'], 'active', '2023-06-01', '2024-09-15'),
        ('Maria Lopez', 'm.lopez@skylineairways.com', 'Customer Experience', 'Passenger Services', 'Passenger data governance including manifests, check-in data, and special service requests', ARRAY['passenger_manifests'], 'active', '2023-07-15', '2024-10-01'),
        ('Robert Kim', 'r.kim@skylineairways.com', 'Revenue Management', 'Revenue', 'Revenue data accuracy, fare integrity, and booking transaction reconciliation', ARRAY['booking_transactions', 'ticket_pricing'], 'active', '2023-05-01', '2024-08-20'),
        ('Angela Wu', 'a.wu@skylineairways.com', 'Loyalty Programs', 'CRM', 'Loyalty member data quality, tier calculation accuracy, and mileage accrual integrity', ARRAY['loyalty_members'], 'active', '2023-08-01', '2024-11-01'),
        ('Tom Bradley', 't.bradley@skylineairways.com', 'Flight Operations', 'Crew Management', 'Crew data governance, FTL compliance data, and scheduling data accuracy', ARRAY['crew_schedules', 'fuel_consumption'], 'active', '2023-04-15', '2024-07-30'),
        ('Karen Singh', 'k.singh@skylineairways.com', 'Engineering', 'Maintenance & Safety', 'Aircraft maintenance records integrity, airworthiness data, and safety reporting compliance', ARRAY['aircraft_maintenance', 'safety_incidents'], 'active', '2023-03-01', '2024-09-01'),
        ('David Okafor', 'd.okafor@skylineairways.com', 'Ground Operations', 'Airport Operations', 'Baggage tracking data quality, ground handling metrics, and turnaround time reporting', ARRAY['baggage_tracking', 'gate_assignments'], 'active', '2023-09-01', '2024-10-15'),
        ('Maria Rodriguez', 'm.rodriguez@skylineairways.com', 'Revenue Management', 'Revenue Analytics', 'Revenue management data, load factor accuracy, and ancillary revenue data governance', ARRAY['revenue_management', 'ancillary_services'], 'active', '2023-06-15', '2024-11-15'),
        ('Lisa Park', 'l.park@skylineairways.com', 'Customer Experience', 'Voice of Customer', 'Customer feedback data integrity, NPS score accuracy, and complaint resolution tracking', ARRAY['customer_feedback'], 'active', '2023-10-01', '2024-12-01'),
        ('Nina Patel', 'n.patel@skylineairways.com', 'In-Flight Services', 'Catering', 'Catering order data quality, meal preference accuracy, and special dietary requirement compliance', ARRAY['catering_orders'], 'active', '2024-01-15', '2024-08-01'),
        ('Brian Hoffman', 'b.hoffman@skylineairways.com', 'Cargo', 'Cargo Operations', 'Cargo manifest data governance, AWB accuracy, and dangerous goods data compliance', ARRAY['cargo_manifests'], 'active', '2023-11-01', '2024-09-20'),
        ('Sarah Mitchell', 's.mitchell@skylineairways.com', 'Data Governance', 'Enterprise', 'Overall data governance program, policy enforcement, cross-domain data quality oversight', ARRAY['data_catalog', 'data_classification'], 'active', '2023-01-01', '2024-12-15'),
        ('Deepak Patel', 'd.patel@skylineairways.com', 'IT Infrastructure', 'Technology', 'Data platform infrastructure, data pipeline reliability, and technical metadata management', ARRAY['metadata_repository'], 'active', '2023-02-01', '2024-10-30'),
        ('Lisa Johnson', 'l.johnson@skylineairways.com', 'Compliance', 'Regulatory', 'Regulatory compliance monitoring, data privacy assessments, and audit readiness', ARRAY['compliance_records', 'audit_logs'], 'active', '2023-04-01', '2024-11-20'),
        ('Marcus Webb', 'm.webb@skylineairways.com', 'Network Planning', 'Route Analytics', 'Route performance data accuracy, schedule data integrity, and codeshare data governance', ARRAY['flight_operations', 'booking_transactions'], 'active', '2024-03-01', '2024-12-10')
    `);
    console.log('Data stewards seeded.');

    // ── Seed Compliance Records ───────────────────────────────────────

    await pool.query(`DELETE FROM compliance_records`);
    await pool.query(`
      INSERT INTO compliance_records (regulation, requirement, status, evidence, risk_level, responsible_party, due_date, last_assessed, notes) VALUES
        ('GDPR', 'Right to erasure - ability to delete passenger PII upon request within 30 days', 'compliant', 'Automated PII deletion pipeline deployed. 142 erasure requests processed in last quarter with avg 4.2 day turnaround.', 'high', 'Sarah Mitchell', '2025-03-31', '2024-12-01', 'Annual DPA audit passed. Next audit scheduled Q1 2025.'),
        ('GDPR', 'Data Protection Impact Assessment for passenger profiling', 'compliant', 'DPIA completed for loyalty tier scoring and personalized offer engine. Approved by DPO.', 'high', 'Lisa Johnson', '2025-06-30', '2024-11-15', 'DPIA refresh required when new AI recommendation engine launches.'),
        ('GDPR', 'Lawful basis documentation for all PII processing activities', 'in_progress', 'Processing registry 85% complete. Remaining: cargo shipper data and crew medical records.', 'medium', 'Lisa Johnson', '2025-02-28', '2024-12-10', 'Targeting full completion by end of Q1 2025.'),
        ('CCPA', 'Consumer right to know - provide data inventory upon request', 'compliant', 'Self-service data request portal launched. Average response time: 3 business days.', 'medium', 'Sarah Mitchell', '2025-06-30', '2024-10-20', 'Portal handles ~50 requests/month from California residents.'),
        ('CCPA', 'Do Not Sell opt-out mechanism for loyalty member data', 'compliant', 'Opt-out toggle available in loyalty account settings. 2.3% opt-out rate. Data broker feeds exclude opted-out members.', 'medium', 'Angela Wu', '2025-06-30', '2024-11-01', 'Monitoring for proposed CCPA amendment impacts.'),
        ('PCI-DSS', 'Quarterly ASV vulnerability scanning of payment systems', 'compliant', 'Q4 2024 scan completed by Qualys. Zero high/critical findings. Report archived in GRC tool.', 'critical', 'Deepak Patel', '2025-03-31', '2024-12-15', 'Continuous scanning enabled in addition to quarterly requirement.'),
        ('PCI-DSS', 'Annual penetration testing of cardholder data environment', 'compliant', 'Pentest completed Nov 2024 by CrowdStrike. 3 medium findings remediated within 30 days.', 'critical', 'Deepak Patel', '2025-11-30', '2024-11-30', 'Scope included new mobile payment integration.'),
        ('PCI-DSS', 'Tokenization of stored cardholder data', 'compliant', 'All PANs tokenized via CyberSource token vault. No raw card numbers in data warehouse.', 'critical', 'Deepak Patel', '2025-06-30', '2024-09-15', 'Migration to network tokens planned for 2025.'),
        ('SOX', 'Revenue recognition data integrity controls', 'compliant', 'Automated reconciliation between booking system and GL. Daily variance report reviewed by Finance.', 'high', 'Robert Kim', '2025-12-31', '2024-12-01', 'External auditor reviewed and approved controls in annual audit.'),
        ('SOX', 'IT general controls over financial reporting systems', 'in_progress', 'Access review for revenue systems 70% complete. Change management controls documented.', 'high', 'Deepak Patel', '2025-03-31', '2024-11-20', 'Remediation in progress for segregation of duties findings.'),
        ('IATA', 'Resolution 830d - Electronic Miscellaneous Document standards', 'compliant', 'EMD issuance and settlement compliant with BSP/ARC requirements. Monthly reconciliation automated.', 'medium', 'Robert Kim', '2025-06-30', '2024-10-01', 'System upgrade planned for NDC Order standards alignment.'),
        ('IATA', 'Resolution 753 - Baggage tracking at key handover points', 'in_progress', 'Tracking coverage at 87% of required handover points. 4 outstations pending BRS deployment.', 'medium', 'David Okafor', '2025-06-01', '2024-12-05', 'Full compliance expected by May 2025 with Nairobi and Lagos stations.'),
        ('DOT', '14 CFR Part 234 - On-time performance reporting', 'compliant', 'Automated monthly OTP reporting to DOT BTS. Data validated against OOOI messages before submission.', 'high', 'James Chen', '2025-12-31', '2024-12-31', 'Zero restatements required in 2024.'),
        ('DOT', '14 CFR Part 382 - Disability accommodation data reporting', 'compliant', 'SSR data for wheelchair, service animal, and medical oxygen requests tracked and reported per regulation.', 'high', 'Maria Lopez', '2025-12-31', '2024-11-15', 'New CRO incident tracking system deployed in Q3 2024.'),
        ('GDPR', 'Breach notification to supervisory authority within 72 hours', 'compliant', 'Incident response playbook tested quarterly. Tabletop exercise completed Oct 2024. Average detection to notification: 18 hours.', 'critical', 'Lisa Johnson', '2025-12-31', '2024-10-30', 'Zero reportable breaches in 2024.'),
        ('DOT', '14 CFR Part 259 - Tarmac delay contingency plan data', 'compliant', 'Automated tarmac delay monitoring with 2-hour domestic / 4-hour international threshold alerts.', 'high', 'James Chen', '2025-12-31', '2024-12-20', '3 tarmac delays reported in 2024, all within compliance thresholds.')
    `);
    console.log('Compliance records seeded.');

    // ── Seed Access Control ───────────────────────────────────────────

    await pool.query(`DELETE FROM access_control`);
    await pool.query(`
      INSERT INTO access_control (resource_name, resource_type, role_name, permission_level, granted_by, granted_to, department, justification, expiry_date, status) VALUES
        ('passenger_manifests', 'table', 'Data Steward', 'admin', 'Sarah Mitchell', 'Maria Lopez', 'Customer Experience', 'Primary data steward for passenger data domain', '2025-12-31', 'active'),
        ('booking_transactions', 'table', 'Revenue Analyst', 'read', 'Robert Kim', 'Revenue Analytics Team', 'Revenue Management', 'Required for daily revenue reporting and forecasting', '2025-06-30', 'active'),
        ('booking_transactions.credit_card_number', 'column', 'Data Engineer', 'none', 'Deepak Patel', 'All non-PCI roles', 'IT Infrastructure', 'PCI-DSS requirement - PAN access restricted to tokenization service only', NULL, 'active'),
        ('loyalty_members', 'table', 'CRM Analyst', 'read', 'Angela Wu', 'CRM Analytics Team', 'Loyalty Programs', 'Loyalty program analysis and tier migration reporting', '2025-09-30', 'active'),
        ('crew_schedules', 'table', 'Crew Planner', 'write', 'Tom Bradley', 'Crew Planning Team', 'Flight Operations', 'Crew scheduling and FTL compliance management', '2025-12-31', 'active'),
        ('safety_incidents', 'table', 'Safety Investigator', 'admin', 'Karen Singh', 'Safety Investigation Team', 'Safety', 'ASAP program - full access for incident investigation and corrective actions', '2025-12-31', 'active'),
        ('safety_incidents.reporter_name', 'column', 'All Users', 'none', 'Karen Singh', 'All non-Safety roles', 'Safety', 'ASAP confidentiality - reporter identity protected per program MOU', NULL, 'active'),
        ('aircraft_maintenance', 'table', 'Maintenance Engineer', 'write', 'Karen Singh', 'Engineering Team', 'Engineering', 'Maintenance record management and airworthiness compliance', '2025-12-31', 'active'),
        ('revenue_management', 'table', 'RM Analyst', 'write', 'Maria Rodriguez', 'Revenue Management Team', 'Revenue Management', 'Fare class management and inventory optimization', '2025-06-30', 'active'),
        ('customer_feedback', 'table', 'CX Manager', 'read', 'Lisa Park', 'Customer Experience Managers', 'Customer Experience', 'Review customer feedback for service improvement initiatives', '2025-09-30', 'active'),
        ('cargo_manifests', 'table', 'Cargo Agent', 'write', 'Brian Hoffman', 'Cargo Operations Team', 'Cargo', 'Cargo booking, manifest generation, and DGR compliance', '2025-12-31', 'active'),
        ('flight_operations', 'table', 'Network Planner', 'read', 'James Chen', 'Network Planning Team', 'Network Planning', 'OTP analysis and route performance evaluation', '2025-06-30', 'active'),
        ('fuel_consumption', 'table', 'Sustainability Analyst', 'read', 'Tom Bradley', 'Sustainability Team', 'Corporate Affairs', 'Carbon emissions reporting and fuel efficiency analysis', '2025-12-31', 'active'),
        ('ticket_pricing', 'table', 'Pricing Analyst', 'write', 'Robert Kim', 'Pricing Team', 'Revenue Management', 'Fare filing, pricing rule management, and competitive analysis', '2025-09-30', 'active'),
        ('data_governance_reports', 'report', 'Executive', 'read', 'Sarah Mitchell', 'C-Suite', 'Executive Office', 'Executive data governance dashboard and KPI reporting', '2025-12-31', 'active'),
        ('passenger_manifests.passport_number', 'column', 'Check-in Agent', 'read', 'Maria Lopez', 'Airport Check-in Staff', 'Airport Operations', 'Travel document verification during check-in process', '2025-06-30', 'active'),
        ('weather_data', 'table', 'Dispatcher', 'read', 'James Chen', 'Flight Dispatch Team', 'Flight Operations', 'Weather analysis for flight planning and route optimization', '2025-12-31', 'active')
    `);
    console.log('Access control seeded.');

    // ── Seed Data Glossary ────────────────────────────────────────────

    await pool.query(`DELETE FROM data_glossary`);
    await pool.query(`
      INSERT INTO data_glossary (term, definition, category, synonyms, related_terms, domain, owner, status) VALUES
        ('PNR', 'Passenger Name Record - a record in a computer reservation system that contains the itinerary for a passenger or group of passengers traveling together.', 'Reservation', ARRAY['Booking Record', 'Reservation Record'], ARRAY['GDS', 'Booking Transaction', 'Itinerary'], 'Revenue', 'Robert Kim', 'approved'),
        ('OOOI', 'Out-Off-On-In times representing gate departure (Out), wheels off (Off), wheels on (On), and gate arrival (In) for a flight.', 'Operations', ARRAY['Block Times', 'Movement Messages'], ARRAY['Block Time', 'Flight Time', 'ACARS'], 'Operations', 'James Chen', 'approved'),
        ('Load Factor', 'The percentage of available seating capacity that is filled with passengers. Calculated as RPK divided by ASK.', 'Revenue', ARRAY['Seat Factor', 'Occupancy Rate'], ARRAY['RPK', 'ASK', 'Revenue Management'], 'Revenue', 'Maria Rodriguez', 'approved'),
        ('RASK', 'Revenue per Available Seat Kilometer - a key airline financial metric calculated by dividing total operating revenue by available seat kilometers.', 'Finance', ARRAY['Unit Revenue'], ARRAY['CASK', 'Yield', 'ASK'], 'Revenue', 'Robert Kim', 'approved'),
        ('MEL', 'Minimum Equipment List - a document that lists equipment on an aircraft that may be inoperative while maintaining airworthiness for continued flight.', 'Maintenance', ARRAY['Dispatch Deviation Guide', 'DDG'], ARRAY['Airworthiness', 'MMEL', 'Deferred Defect'], 'Engineering', 'Karen Singh', 'approved'),
        ('FTL', 'Flight Time Limitations - regulatory limits on crew flight duty period, flight time, and required rest periods per FAR Part 117 / EU-OPS.', 'Crew', ARRAY['Duty Time Limits', 'Flight Duty Period Rules'], ARRAY['Duty Period', 'Rest Period', 'Crew Scheduling'], 'Operations', 'Tom Bradley', 'approved'),
        ('SSR', 'Special Service Request - a code used in airline reservations to communicate specific passenger needs such as wheelchair assistance, special meals, or medical requirements.', 'Passenger Services', ARRAY['Special Handling Code'], ARRAY['APIS', 'PNR', 'Disability Accommodation'], 'Customer Experience', 'Maria Lopez', 'approved'),
        ('AWB', 'Air Waybill - a document that accompanies goods shipped by air and serves as a receipt and contract of carriage between shipper and carrier.', 'Cargo', ARRAY['Air Consignment Note'], ARRAY['HAWB', 'MAWB', 'Cargo Manifest'], 'Cargo', 'Brian Hoffman', 'approved'),
        ('APIS', 'Advance Passenger Information System - electronic transmission of passenger passport and travel document data to destination country border control authorities.', 'Security', ARRAY['Passenger Data Transmission', 'eAPIS'], ARRAY['Passport', 'Travel Document', 'Border Control'], 'Compliance', 'Lisa Johnson', 'approved'),
        ('DCS', 'Departure Control System - the system used for passenger check-in, seat assignment, boarding pass issuance, and gate management.', 'Operations', ARRAY['Check-in System'], ARRAY['Check-in', 'Boarding', 'Passenger Processing'], 'Operations', 'Maria Lopez', 'approved'),
        ('NPS', 'Net Promoter Score - a customer satisfaction metric ranging from -100 to +100 based on the likelihood of passengers recommending the airline.', 'Customer Experience', ARRAY['Customer Loyalty Score'], ARRAY['CSAT', 'Customer Feedback', 'Voice of Customer'], 'Customer Experience', 'Lisa Park', 'approved'),
        ('ACARS', 'Aircraft Communications Addressing and Reporting System - a digital data link system for transmission of short messages between aircraft and ground stations.', 'Technology', ARRAY['Digital Data Link'], ARRAY['OOOI', 'Flight Telemetry', 'AOC Messages'], 'Operations', 'James Chen', 'approved'),
        ('GDS', 'Global Distribution System - a computerized network that enables travel agencies and booking platforms to search and book airline seats (e.g., Amadeus, Sabre, Travelport).', 'Distribution', ARRAY['Computer Reservation System', 'CRS'], ARRAY['PNR', 'Booking Channel', 'NDC'], 'Revenue', 'Robert Kim', 'approved'),
        ('IRROPS', 'Irregular Operations - any event causing disruption to the published flight schedule including delays, cancellations, diversions, or misconnections.', 'Operations', ARRAY['Disruption', 'Schedule Irregularity'], ARRAY['Delay Code', 'Rebooking', 'Recovery Plan'], 'Operations', 'James Chen', 'approved'),
        ('ASK', 'Available Seat Kilometers - a measure of airline capacity calculated by multiplying the number of available seats by the distance flown in kilometers.', 'Revenue', ARRAY['Available Seat Miles (ASM)'], ARRAY['RPK', 'Load Factor', 'Capacity'], 'Revenue', 'Maria Rodriguez', 'approved'),
        ('DGR', 'Dangerous Goods Regulations - IATA rules governing the transport of hazardous materials by air, based on ICAO Technical Instructions.', 'Cargo', ARRAY['Hazardous Materials', 'HAZMAT'], ARRAY['AWB', 'Cargo Manifest', 'Safety'], 'Cargo', 'Brian Hoffman', 'approved')
    `);
    console.log('Data glossary seeded.');

    // ── Seed Audit Logs ───────────────────────────────────────────────

    await pool.query(`DELETE FROM audit_logs`);
    await pool.query(`
      INSERT INTO audit_logs (action, entity_type, entity_id, entity_name, performed_by, details, ip_address, status, created_at) VALUES
        ('CREATE', 'data_catalog', 1, 'flight_operations', 'admin@skylineairways.com', 'Added flight_operations table to data catalog from ACARS source system', '10.0.1.50', 'success', NOW() - INTERVAL '90 days'),
        ('UPDATE', 'data_classification', 3, 'passenger_manifests.passport_number', 'admin@skylineairways.com', 'Reclassified from Confidential to Restricted after PII audit review', '10.0.1.50', 'success', NOW() - INTERVAL '85 days'),
        ('CREATE', 'data_policy', 1, 'PII Data Retention Policy', 'admin@skylineairways.com', 'New policy created for PII retention requirements across all systems', '10.0.1.50', 'success', NOW() - INTERVAL '80 days'),
        ('UPDATE', 'data_quality_rules', 5, 'Departure-Arrival Time Consistency', 'j.chen@skylineairways.com', 'Updated threshold from 99.5% to 99.9% per new SLA requirements', '10.0.2.15', 'success', NOW() - INTERVAL '75 days'),
        ('DELETE', 'access_control', 22, 'temp_contractor_access', 'admin@skylineairways.com', 'Revoked temporary contractor access to booking_transactions after project completion', '10.0.1.50', 'success', NOW() - INTERVAL '70 days'),
        ('LOGIN', 'user', 1, 'admin@skylineairways.com', 'admin@skylineairways.com', 'Successful login from corporate VPN', '10.0.1.50', 'success', NOW() - INTERVAL '65 days'),
        ('EXPORT', 'data_catalog', NULL, 'Full catalog export', 'm.rodriguez@skylineairways.com', 'Exported complete data catalog to CSV for governance review meeting', '10.0.3.22', 'success', NOW() - INTERVAL '60 days'),
        ('UPDATE', 'compliance_records', 12, 'IATA Res 753 Baggage Tracking', 'd.okafor@skylineairways.com', 'Updated compliance status from non_compliant to in_progress - BRS deployment started', '10.0.4.18', 'success', NOW() - INTERVAL '55 days'),
        ('CREATE', 'data_steward', 15, 'Marcus Webb', 'admin@skylineairways.com', 'Assigned new data steward for Network Planning domain', '10.0.1.50', 'success', NOW() - INTERVAL '50 days'),
        ('UPDATE', 'data_lineage', 8, 'BagLink -> baggage_tracking', 'd.okafor@skylineairways.com', 'Updated transformation logic to include new BPM message format v3.2', '10.0.4.18', 'success', NOW() - INTERVAL '45 days'),
        ('LOGIN', 'user', 1, 'admin@skylineairways.com', 'admin@skylineairways.com', 'Failed login attempt - incorrect password', '192.168.1.100', 'failure', NOW() - INTERVAL '40 days'),
        ('CREATE', 'data_glossary', 14, 'IRROPS', 'j.chen@skylineairways.com', 'Added IRROPS term to glossary after operations team request', '10.0.2.15', 'success', NOW() - INTERVAL '35 days'),
        ('UPDATE', 'data_catalog', 7, 'baggage_tracking', 'd.okafor@skylineairways.com', 'Updated row_count from 120M to 150M after annual archive reconciliation', '10.0.4.18', 'success', NOW() - INTERVAL '30 days'),
        ('CLASSIFY', 'data_classification', NULL, 'AI batch classification', 'system@skylineairways.com', 'AI classifier processed 245 new columns. 238 auto-classified, 7 flagged for manual review.', '10.0.10.1', 'success', NOW() - INTERVAL '25 days'),
        ('UPDATE', 'data_policy', 15, 'AI Model Governance Policy', 'admin@skylineairways.com', 'Policy status changed from draft to active after board approval', '10.0.1.50', 'success', NOW() - INTERVAL '20 days'),
        ('CREATE', 'access_control', 17, 'weather_data read access', 'j.chen@skylineairways.com', 'Granted read access to weather_data table for Flight Dispatch Team', '10.0.2.15', 'success', NOW() - INTERVAL '15 days'),
        ('REVIEW', 'data_steward', 1, 'James Chen', 'admin@skylineairways.com', 'Quarterly stewardship review completed. All KPIs met. Renewed for next quarter.', '10.0.1.50', 'success', NOW() - INTERVAL '10 days')
    `);
    console.log('Audit logs seeded.');

    console.log('\nSeeding complete! All tables created and populated.');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
