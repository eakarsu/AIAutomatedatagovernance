import FormattedAIReport from "./FormattedAIReport";
import AIHistory from './AIHistory';
import React, { useState } from 'react';
import { Search, Shield, Clock, GitBranch, AlertTriangle, BookOpen, FileBarChart, Users, Loader, Database, Layers } from 'lucide-react';
import { toast } from 'react-toastify';
import { aiAPI } from '../services/api';

/**
 * Advanced AI Features panel — implements 8 audit-driven features:
 * 1. Sensitive data discovery scanner (regex)
 * 2. Privacy Impact Assessment (PIA) generator
 * 3. Data retention recommendation
 * 4. Lineage graph builder
 * 5. Access anomaly detector
 * 6. Glossary term suggester
 * 7. Compliance report generator
 * 8. Steward workload balancer
 */
const AIAdvancedFeatures = () => {
  const [activeTab, setActiveTab] = useState('discover');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Per-tab form state
  const [discoverForm, setDiscoverForm] = useState({ json: '[\n  { "table": "users", "column": "ssn", "sample": "123-45-6789" },\n  { "table": "users", "column": "email", "sample": "alice@example.com" }\n]' });
  const [piaForm, setPiaForm] = useState({ initiative_name: '', description: '', data_categories: '', processing_purpose: '', jurisdictions: 'US,EU' });
  const [retentionForm, setRetentionForm] = useState({ data_category: 'PII', frameworks: 'GDPR,SOX', legal_hold: false });
  const [lineageForm, setLineageForm] = useState({ table_name: '', depth: 2 });
  const [accessForm, setAccessForm] = useState({ json: '[]' });
  const [glossaryForm, setGlossaryForm] = useState({ json: '[\n  { "table_name": "ops.flights", "column_name": "dep_dt_utc", "data_type": "timestamptz" }\n]' });
  const [reportForm, setReportForm] = useState({ framework: 'SOC2', period_start: '', period_end: '', scope: '' });
  const [stewardForm, setStewardForm] = useState({ json: '[]' });
  const [schemaForm, setSchemaForm] = useState({
    table_name: 'passengers',
    current_schema_json: '{\n  "id": "int",\n  "email": "varchar(255)",\n  "first_name": "varchar(100)"\n}',
    proposed_changes_json: '[\n  { "type": "add_column", "name": "loyalty_tier", "data_type": "varchar(20)" }\n]',
    downstream_consumers_json: '[\n  "ops.flight_bookings",\n  "marketing.email_campaigns"\n]',
    business_context: ''
  });
  const [mdmForm, setMdmForm] = useState({
    entity_type: 'customer',
    records_json: '[]',
    match_threshold: 0.85
  });
  const [presetNotice, setPresetNotice] = useState('');
  const scenarios = [
    { name: 'Passenger operations', table: 'passenger_manifest', category: 'PII', framework: 'GDPR', scope: 'Passenger operations', purpose: 'Coordinate boarding and customer support', date: '2026-10-01' },
    { name: 'Flight operations', table: 'flight_schedule', category: 'Financial', framework: 'SOC2', scope: 'Flight operations', purpose: 'Monitor schedule changes and downstream use', date: '2026-09-01' },
    { name: 'Loyalty program', table: 'loyalty_members', category: 'PII', framework: 'SOX', scope: 'Loyalty program', purpose: 'Review member data processing and retention', date: '2026-08-01' },
  ];
  const fillScenario = (index) => {
    const s = scenarios[index];
    const columns = JSON.stringify([{ table: s.table, column: 'email', sample: 'sample@example.com' }, { table: s.table, column: 'status', sample: 'active' }], null, 2);
    const glossary = JSON.stringify([{ table_name: s.table, column_name: 'status', data_type: 'varchar' }], null, 2);
    const keepReferences = (json, update) => {
      try {
        const records = JSON.parse(json);
        return Array.isArray(records) ? JSON.stringify(records.map(update), null, 2) : json;
      } catch (_) { return json; }
    };
    const setters = {
      discover: () => setDiscoverForm({ json: columns }),
      pia: () => setPiaForm({ initiative_name: s.name, description: `Assess ${s.scope.toLowerCase()} data processing, access, retention and data subject impact.`, data_categories: s.category + ', operational data', processing_purpose: s.purpose, jurisdictions: index === 1 ? 'US' : 'US,EU' }),
      retention: () => setRetentionForm({ data_category: s.category, frameworks: s.framework, legal_hold: index === 1 }),
      lineage: () => setLineageForm({ table_name: s.table, depth: index + 2 }),
      access: () => setAccessForm(current => ({ json: keepReferences(current.json, record => ({ ...record, timestamp: `${s.date}T09:30:00Z`, resource: s.table })) })),
      glossary: () => setGlossaryForm({ json: glossary }),
      report: () => setReportForm({ framework: s.framework, period_start: s.date, period_end: '2026-10-10', scope: s.scope }),
      steward: () => setStewardForm(current => ({ json: keepReferences(current.json, record => ({ ...record, name: s.table, domain: s.scope })) })),
      schema: () => setSchemaForm({ table_name: s.table, current_schema_json: JSON.stringify({ email: 'varchar(255)', status: 'varchar(32)' }, null, 2), proposed_changes_json: JSON.stringify([{ type: 'add_column', name: 'review_status', data_type: 'varchar(32)' }], null, 2), downstream_consumers_json: JSON.stringify([`${s.table}_report`], null, 2), business_context: s.purpose }),
      mdm: () => setMdmForm(current => ({ ...current, entity_type: s.name.toLowerCase(), match_threshold: [0.8, 0.85, 0.9][index], records_json: keepReferences(current.records_json, (record, position) => ({ ...record, name: `${s.name} record ${position + 1}`, email: `sample${position + 1}@example.com` })) })),
    };
    setters[activeTab]?.();
    setPresetNotice(['access', 'steward', 'mdm'].includes(activeTab)
      ? 'Scenario fields filled. Add genuine source records and identifiers before running this feature; the preset cannot supply them.'
      : 'Scenario fields filled. Review the example before running this feature.');
  };

  const tabs = [
    { key: 'discover',  label: 'Sensitive Data Scanner', icon: <Search size={16} /> },
    { key: 'pia',       label: 'PIA Generator',          icon: <Shield size={16} /> },
    { key: 'retention', label: 'Retention Calculator',   icon: <Clock size={16} /> },
    { key: 'lineage',   label: 'Lineage Graph',          icon: <GitBranch size={16} /> },
    { key: 'access',    label: 'Access Anomalies',       icon: <AlertTriangle size={16} /> },
    { key: 'glossary',  label: 'Glossary Suggester',     icon: <BookOpen size={16} /> },
    { key: 'report',    label: 'Compliance Report',      icon: <FileBarChart size={16} /> },
    { key: 'steward',   label: 'Steward Balancer',       icon: <Users size={16} /> },
    { key: 'schema',    label: 'Schema Evolution',       icon: <Layers size={16} /> },
    { key: 'mdm',       label: 'Master Data Match',      icon: <Database size={16} /> },
  ];

  const onTab = (key) => { setActiveTab(key); setResult(null); };

  const safeParseArray = (jsonStr, label) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`);
      return parsed;
    } catch (e) {
      toast.error(`Invalid JSON for ${label}: ${e.message}`);
      return null;
    }
  };

  const wrapCall = async (fn) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fn();
      setResult(res.data);
      toast[res.data?.status === 'unavailable' ? 'info' : 'success'](res.data?.status === 'unavailable' ? res.data.message : 'AI request complete');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = () => {
    const cols = safeParseArray(discoverForm.json, 'columns');
    if (!cols) return;
    wrapCall(() => aiAPI.discoverSensitive({ columns: cols }));
  };

  const handlePIA = () => {
    if (!piaForm.initiative_name || !piaForm.description) {
      toast.warning('initiative_name and description are required');
      return;
    }
    wrapCall(() => aiAPI.generatePIA({
      initiative_name: piaForm.initiative_name,
      description: piaForm.description,
      data_categories: piaForm.data_categories.split(',').map(s => s.trim()).filter(Boolean),
      processing_purpose: piaForm.processing_purpose,
      jurisdictions: piaForm.jurisdictions.split(',').map(s => s.trim()).filter(Boolean),
    }));
  };

  const handleRetention = () => {
    wrapCall(() => aiAPI.retentionRecommendation({
      data_category: retentionForm.data_category,
      frameworks: retentionForm.frameworks.split(',').map(s => s.trim()).filter(Boolean),
      legal_hold: retentionForm.legal_hold,
    }));
  };

  const handleLineage = () => {
    if (!lineageForm.table_name) {
      toast.warning('Table name is required');
      return;
    }
    wrapCall(() => aiAPI.lineageGraph(lineageForm.table_name, parseInt(lineageForm.depth) || 2));
  };

  const handleAccess = () => {
    const logs = safeParseArray(accessForm.json, 'access_logs');
    if (!logs) return;
    wrapCall(() => aiAPI.detectAccessAnomalies({ access_logs: logs }));
  };

  const handleGlossary = () => {
    const cols = safeParseArray(glossaryForm.json, 'columns');
    if (!cols) return;
    wrapCall(() => aiAPI.suggestGlossary({ columns: cols }));
  };

  const handleReport = () => {
    if (!reportForm.framework) {
      toast.warning('framework is required');
      return;
    }
    wrapCall(() => aiAPI.generateComplianceReport(reportForm));
  };

  const handleSteward = () => {
    const assets = safeParseArray(stewardForm.json, 'unassigned_assets');
    if (!assets) return;
    wrapCall(() => aiAPI.balanceStewards({ unassigned_assets: assets }));
  };

  const safeParseObject = (jsonStr, label) => {
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      toast.error(`Invalid JSON for ${label}: ${e.message}`);
      return null;
    }
  };

  const handleSchemaEvolution = () => {
    if (!schemaForm.table_name) {
      toast.warning('table_name is required');
      return;
    }
    const current_schema = safeParseObject(schemaForm.current_schema_json, 'current_schema');
    if (!current_schema) return;
    const proposed_changes = safeParseObject(schemaForm.proposed_changes_json || '[]', 'proposed_changes');
    if (proposed_changes === null) return;
    const downstream_consumers = safeParseObject(schemaForm.downstream_consumers_json || '[]', 'downstream_consumers');
    if (downstream_consumers === null) return;
    wrapCall(() => aiAPI.schemaEvolution({
      table_name: schemaForm.table_name,
      current_schema,
      proposed_changes,
      downstream_consumers,
      business_context: schemaForm.business_context,
    }));
  };

  const handleMDM = () => {
    const records = safeParseArray(mdmForm.records_json, 'records');
    if (!records) return;
    if (records.length < 2) { toast.warning('Provide at least 2 records'); return; }
    wrapCall(() => aiAPI.masterDataMatch({
      entity_type: mdmForm.entity_type,
      records,
      match_threshold: parseFloat(mdmForm.match_threshold) || 0.85,
    }));
  };

  return (
    <div style={{ padding: 24 }}>
      <section aria-label="AI example presets" style={{ marginBottom: 16 }}>
        <strong>Fill a complete scenario</strong>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {scenarios.map((scenario, index) => <button key={scenario.name} type="button" disabled={loading} onClick={() => fillScenario(index)}>{scenario.name}</button>)}
        </div>
        {presetNotice && <p role="status">{presetNotice}</p>}
      </section>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} /> Advanced AI Governance Features
        </h2>
        <p style={{ color: '#888' }}>Eight production features added per audit recommendations.</p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTab(t.key)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: activeTab === t.key ? '#1f2937' : '#fff',
              color: activeTab === t.key ? '#fff' : '#1f2937',
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          {activeTab === 'discover' && (
            <>
              <h3>Sensitive Data Scanner</h3>
              <p>Provide a JSON array of <code>{`{table, column, sample}`}</code>. Regex matches SSN, Email, Phone, CC, IP, IBAN, DOB, MRN.</p>
              <textarea rows={10} style={{ width: '100%' }} value={discoverForm.json}
                onChange={e => setDiscoverForm({ json: e.target.value })} />
              <button onClick={handleDiscover} disabled={loading} style={btn}>Scan</button>
            </>
          )}

          {activeTab === 'pia' && (
            <>
              <h3>Privacy Impact Assessment Generator</h3>
              <input placeholder="Initiative name" value={piaForm.initiative_name}
                onChange={e => setPiaForm({ ...piaForm, initiative_name: e.target.value })} style={inp} />
              <textarea placeholder="Description" rows={3} value={piaForm.description}
                onChange={e => setPiaForm({ ...piaForm, description: e.target.value })} style={inp} />
              <input placeholder="Data categories (comma-separated)" value={piaForm.data_categories}
                onChange={e => setPiaForm({ ...piaForm, data_categories: e.target.value })} style={inp} />
              <input placeholder="Processing purpose" value={piaForm.processing_purpose}
                onChange={e => setPiaForm({ ...piaForm, processing_purpose: e.target.value })} style={inp} />
              <input placeholder="Jurisdictions (comma-separated)" value={piaForm.jurisdictions}
                onChange={e => setPiaForm({ ...piaForm, jurisdictions: e.target.value })} style={inp} />
              <button onClick={handlePIA} disabled={loading} style={btn}>Generate PIA</button>
            </>
          )}

          {activeTab === 'retention' && (
            <>
              <h3>Retention Calculator</h3>
              <select value={retentionForm.data_category}
                onChange={e => setRetentionForm({ ...retentionForm, data_category: e.target.value })} style={inp}>
                <option value="PII">PII</option>
                <option value="PHI">PHI</option>
                <option value="Financial">Financial</option>
              </select>
              <input placeholder="Frameworks (e.g. GDPR,SOX)" value={retentionForm.frameworks}
                onChange={e => setRetentionForm({ ...retentionForm, frameworks: e.target.value })} style={inp} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={retentionForm.legal_hold}
                  onChange={e => setRetentionForm({ ...retentionForm, legal_hold: e.target.checked })} />
                Legal hold applied
              </label>
              <button onClick={handleRetention} disabled={loading} style={btn}>Recommend Retention</button>
            </>
          )}

          {activeTab === 'lineage' && (
            <>
              <h3>Lineage Graph Builder</h3>
              <input placeholder="Table name (e.g. flight_operations)" value={lineageForm.table_name}
                onChange={e => setLineageForm({ ...lineageForm, table_name: e.target.value })} style={inp} />
              <input type="number" min="1" max="5" value={lineageForm.depth}
                onChange={e => setLineageForm({ ...lineageForm, depth: e.target.value })} style={inp} />
              <button onClick={handleLineage} disabled={loading} style={btn}>Build Graph</button>
            </>
          )}

          {activeTab === 'access' && (
            <>
              <h3>Access Anomaly Detector</h3>
              <p>Provide actual access logs with real user references as a JSON array <code>{`{user_id, timestamp, resource}`}</code>. Presets cannot supply these records.</p>
              <textarea rows={10} style={{ width: '100%' }} value={accessForm.json}
                onChange={e => setAccessForm({ json: e.target.value })} />
              <button onClick={handleAccess} disabled={loading} style={btn}>Detect Anomalies</button>
            </>
          )}

          {activeTab === 'glossary' && (
            <>
              <h3>Glossary Suggester</h3>
              <p>Provide JSON array of columns <code>{`{table_name, column_name, data_type}`}</code>.</p>
              <textarea rows={10} style={{ width: '100%' }} value={glossaryForm.json}
                onChange={e => setGlossaryForm({ json: e.target.value })} />
              <button onClick={handleGlossary} disabled={loading} style={btn}>Suggest Terms</button>
            </>
          )}

          {activeTab === 'report' && (
            <>
              <h3>Compliance Report Generator</h3>
              <select value={reportForm.framework}
                onChange={e => setReportForm({ ...reportForm, framework: e.target.value })} style={inp}>
                <option value="SOC2">SOC2</option>
                <option value="HIPAA">HIPAA</option>
                <option value="GDPR">GDPR</option>
                <option value="SOX">SOX</option>
                <option value="PCI-DSS">PCI-DSS</option>
              </select>
              <input type="date" value={reportForm.period_start}
                onChange={e => setReportForm({ ...reportForm, period_start: e.target.value })} style={inp} />
              <input type="date" value={reportForm.period_end}
                onChange={e => setReportForm({ ...reportForm, period_end: e.target.value })} style={inp} />
              <input placeholder="Scope (e.g. enterprise, division)" value={reportForm.scope}
                onChange={e => setReportForm({ ...reportForm, scope: e.target.value })} style={inp} />
              <button onClick={handleReport} disabled={loading} style={btn}>Generate Report</button>
            </>
          )}

          {activeTab === 'steward' && (
            <>
              <h3>Steward Workload Balancer</h3>
              <p>Provide actual unassigned assets with real record IDs as a JSON array <code>{`{id, name, domain}`}</code>. Presets cannot supply these records.</p>
              <textarea rows={10} style={{ width: '100%' }} value={stewardForm.json}
                onChange={e => setStewardForm({ json: e.target.value })} />
              <button onClick={handleSteward} disabled={loading} style={btn}>Balance</button>
            </>
          )}

          {activeTab === 'schema' && (
            <>
              <h3>Schema Evolution Recommendations</h3>
              <input placeholder="Table name" value={schemaForm.table_name}
                onChange={e => setSchemaForm({ ...schemaForm, table_name: e.target.value })} style={inp} />
              <label style={{ fontSize: 12, color: '#666' }}>Current schema (JSON object)</label>
              <textarea rows={5} style={{ width: '100%' }} value={schemaForm.current_schema_json}
                onChange={e => setSchemaForm({ ...schemaForm, current_schema_json: e.target.value })} />
              <label style={{ fontSize: 12, color: '#666' }}>Proposed changes (JSON array)</label>
              <textarea rows={5} style={{ width: '100%' }} value={schemaForm.proposed_changes_json}
                onChange={e => setSchemaForm({ ...schemaForm, proposed_changes_json: e.target.value })} />
              <label style={{ fontSize: 12, color: '#666' }}>Downstream consumers (JSON array)</label>
              <textarea rows={4} style={{ width: '100%' }} value={schemaForm.downstream_consumers_json}
                onChange={e => setSchemaForm({ ...schemaForm, downstream_consumers_json: e.target.value })} />
              <input placeholder="Business context (optional)" value={schemaForm.business_context}
                onChange={e => setSchemaForm({ ...schemaForm, business_context: e.target.value })} style={inp} />
              <button onClick={handleSchemaEvolution} disabled={loading} style={btn}>Analyze Schema Change</button>
            </>
          )}

          {activeTab === 'mdm' && (
            <>
              <h3>Master Data Match (Dedup)</h3>
              <input placeholder="Entity type (e.g. customer)" value={mdmForm.entity_type}
                onChange={e => setMdmForm({ ...mdmForm, entity_type: e.target.value })} style={inp} />
              <input type="number" min="0" max="1" step="0.05" placeholder="Match threshold (0-1)"
                value={mdmForm.match_threshold}
                onChange={e => setMdmForm({ ...mdmForm, match_threshold: e.target.value })} style={inp} />
              <label style={{ fontSize: 12, color: '#666' }}>Actual source records with real IDs (JSON array, at least 2; presets cannot supply these records)</label>
              <textarea rows={10} style={{ width: '100%' }} value={mdmForm.records_json}
                onChange={e => setMdmForm({ ...mdmForm, records_json: e.target.value })} />
              <button onClick={handleMDM} disabled={loading} style={btn}>Detect Duplicates</button>
            </>
          )}

          {loading && <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Loader size={14} className="spin" /> Working...</p>}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
          <h3>Result</h3>
          {!result && <p style={{ color: '#888' }}>Run a feature to see the response.</p>}
          {result && (
            <FormattedAIReport response={result} />
          )}
        </div>
      </div>
      <AIHistory />
    </div>
  );
};

const inp = { display: 'block', width: '100%', padding: 8, marginBottom: 8, border: '1px solid #ccc', borderRadius: 4 };
const btn = { padding: '8px 14px', background: '#1f2937', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' };

export default AIAdvancedFeatures;
