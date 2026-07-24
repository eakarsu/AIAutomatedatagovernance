import React, { useState } from 'react';
import { Sparkles, Brain, Shield, GitBranch, CheckSquare, FileText, Loader, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import { aiAPI } from '../services/api';

const AIInsights = () => {
  const [activeTab, setActiveTab] = useState('classifier');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Form states for each tab
  const [classifierForm, setClassifierForm] = useState({
    table_name: '', column_name: '', sample_data: '', data_type: 'string'
  });
  const [anomalyForm, setAnomalyForm] = useState({
    table_name: '', column_name: '', statistics: '', recent_values: ''
  });
  const [policyForm, setPolicyForm] = useState({
    policy_type: 'retention', scope: '', industry_context: 'airline industry', compliance_requirements: ''
  });
  const [impactForm, setImpactForm] = useState({
    change_type: 'schema_change', target_table: '', target_column: '', proposed_change: ''
  });
  const [qualityForm, setQualityForm] = useState({
    table_name: '', columns: '', sample_data: ''
  });
  const [descForm, setDescForm] = useState({
    table_name: '', column_name: '', data_type: '', sample_values: ''
  });

  const tabs = [
    { key: 'classifier', label: 'Data Classifier', icon: <Brain size={16} /> },
    { key: 'anomaly', label: 'Anomaly Detection', icon: <AlertTriangle size={16} /> },
    { key: 'policy', label: 'Policy Generator', icon: <Shield size={16} /> },
    { key: 'impact', label: 'Impact Analysis', icon: <GitBranch size={16} /> },
    { key: 'quality', label: 'Quality Rules', icon: <CheckSquare size={16} /> },
    { key: 'description', label: 'Description Generator', icon: <FileText size={16} /> }
  ];

  const handleTabChange = (key) => {
    setActiveTab(key);
    setResult(null);
  };

  const handleClassify = async () => {
    if (!classifierForm.table_name || !classifierForm.column_name) {
      toast.warning('Please fill in table name and column name');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiAPI.classify(classifierForm);
      setResult(res.data);
      toast.success('Classification complete');
    } catch (err) {
      toast.error('Classification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDetectAnomalies = async () => {
    if (!anomalyForm.table_name || !anomalyForm.column_name) {
      toast.warning('Please fill in table name and column name');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiAPI.detectAnomalies(anomalyForm);
      setResult(res.data);
      toast.success('Anomaly detection complete');
    } catch (err) {
      toast.error('Anomaly detection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePolicy = async () => {
    if (!policyForm.policy_type || !policyForm.scope) {
      toast.warning('Please fill in policy type and scope');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiAPI.generatePolicy(policyForm);
      setResult(res.data);
      toast.success('Policy generated successfully');
    } catch (err) {
      toast.error('Policy generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImpactAnalysis = async () => {
    if (!impactForm.target_table || !impactForm.proposed_change) {
      toast.warning('Please fill in target table and proposed change');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiAPI.impactAnalysis(impactForm);
      setResult(res.data);
      toast.success('Impact analysis complete');
    } catch (err) {
      toast.error('Impact analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestQuality = async () => {
    if (!qualityForm.table_name || !qualityForm.columns) {
      toast.warning('Please fill in table name and columns');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiAPI.suggestQualityRules(qualityForm);
      setResult(res.data);
      toast.success('Quality rules suggested');
    } catch (err) {
      toast.error('Quality rule suggestion failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDesc = async () => {
    if (!descForm.table_name || !descForm.column_name) {
      toast.warning('Please fill in table name and column name');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await aiAPI.generateDescription(descForm);
      setResult(res.data);
      toast.success('Description generated');
    } catch (err) {
      toast.error('Description generation failed');
    } finally {
      setLoading(false);
    }
  };

  const getClassificationColor = (level) => {
    const map = {
      public: '#16a34a', internal: '#2563eb', confidential: '#ea580c',
      restricted: '#dc2626', highly_restricted: '#7c2d12', sensitive: '#7c3aed'
    };
    return map[(level || '').toLowerCase()] || '#6b7280';
  };

  const getSeverityColor = (severity) => {
    const map = { low: '#16a34a', medium: '#eab308', high: '#ea580c', critical: '#dc2626' };
    return map[(severity || '').toLowerCase()] || '#6b7280';
  };

  const getRiskColor = (risk) => {
    const map = { low: '#16a34a', medium: '#eab308', high: '#ea580c', critical: '#dc2626' };
    return map[(risk || '').toLowerCase()] || '#6b7280';
  };

  const ensureArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  // Render forms
  const renderClassifierForm = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Table Name *</label>
        <input className="form-input" value={classifierForm.table_name} onChange={e => setClassifierForm(p => ({ ...p, table_name: e.target.value }))} placeholder="e.g. passenger_records" />
      </div>
      <div className="form-group">
        <label className="form-label">Column Name *</label>
        <input className="form-input" value={classifierForm.column_name} onChange={e => setClassifierForm(p => ({ ...p, column_name: e.target.value }))} placeholder="e.g. email_address" />
      </div>
      <div className="form-group">
        <label className="form-label">Sample Data</label>
        <textarea className="form-textarea" value={classifierForm.sample_data} onChange={e => setClassifierForm(p => ({ ...p, sample_data: e.target.value }))} rows={3} placeholder="Paste sample data values..." />
      </div>
      <div className="form-group">
        <label className="form-label">Data Type</label>
        <select className="form-select" value={classifierForm.data_type} onChange={e => setClassifierForm(p => ({ ...p, data_type: e.target.value }))}>
          <option value="string">String</option>
          <option value="integer">Integer</option>
          <option value="date">Date</option>
          <option value="boolean">Boolean</option>
          <option value="decimal">Decimal</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="ssn">SSN</option>
          <option value="credit_card">Credit Card</option>
        </select>
      </div>
      <button className="btn btn-primary" onClick={handleClassify} disabled={loading} style={{ marginTop: '1rem' }}>
        <Sparkles size={16} /> Classify
      </button>
    </div>
  );

  const renderClassifierResult = () => {
    if (!result) return null;
    const confidence = result.confidence || result.confidence_score || 0;
    const confidencePct = typeof confidence === 'number' && confidence <= 1 ? confidence * 100 : confidence;
    return (
      <div className="ai-output">
        <div className="ai-output-card">
          <div className="ai-output-header">Classification Results</div>
          <div className="ai-output-body">
            <div className="ai-output-section" style={{ textAlign: 'center', padding: '1rem 0' }}>
              <span style={{
                background: getClassificationColor(result.classification_level),
                color: '#fff', padding: '8px 24px', borderRadius: '8px',
                fontSize: '1.2rem', fontWeight: 700, display: 'inline-block'
              }}>
                {result.classification_level || 'Unknown'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {[
                { label: 'PII', value: result.is_pii || result.pii },
                { label: 'PHI', value: result.is_phi || result.phi },
                { label: 'PCI', value: result.is_pci || result.pci }
              ].map(flag => (
                <div key={flag.label} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px',
                  borderRadius: '8px', border: '1px solid var(--border-primary)',
                  background: flag.value ? '#dcfce7' : 'var(--bg-tertiary)'
                }}>
                  {flag.value ? <CheckCircle size={16} color="#16a34a" /> : <Info size={16} color="var(--text-muted)" />}
                  <span style={{ fontWeight: 600, color: flag.value ? '#166534' : 'var(--text-muted)' }}>{flag.label}</span>
                </div>
              ))}
            </div>

            <div className="ai-output-section">
              <div className="ai-section-title">Confidence</div>
              <div style={{ background: 'var(--border-primary)', borderRadius: '8px', height: '24px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  background: confidencePct >= 80 ? '#16a34a' : confidencePct >= 50 ? '#eab308' : '#dc2626',
                  height: '100%', width: `${Math.min(confidencePct, 100)}%`,
                  borderRadius: '8px', transition: 'width 0.5s ease'
                }} />
                <span style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)'
                }}>{confidencePct.toFixed(1)}%</span>
              </div>
            </div>

            {result.reasoning && (
              <div className="ai-output-section">
                <div className="ai-section-title">Reasoning</div>
                <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{result.reasoning}</p>
              </div>
            )}

            {result.recommendations && (
              <div className="ai-output-section">
                <div className="ai-section-title">Recommendations</div>
                <ul className="ai-recommendation-list">
                  {ensureArray(result.recommendations).map((rec, i) => (
                    <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--bg-tertiary)' }}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAnomalyForm = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Table Name *</label>
        <input className="form-input" value={anomalyForm.table_name} onChange={e => setAnomalyForm(p => ({ ...p, table_name: e.target.value }))} placeholder="e.g. flight_bookings" />
      </div>
      <div className="form-group">
        <label className="form-label">Column Name *</label>
        <input className="form-input" value={anomalyForm.column_name} onChange={e => setAnomalyForm(p => ({ ...p, column_name: e.target.value }))} placeholder="e.g. ticket_price" />
      </div>
      <div className="form-group">
        <label className="form-label">Statistics</label>
        <textarea className="form-textarea" value={anomalyForm.statistics} onChange={e => setAnomalyForm(p => ({ ...p, statistics: e.target.value }))} rows={3} placeholder="Describe statistics: mean, median, std dev, min, max..." />
      </div>
      <div className="form-group">
        <label className="form-label">Recent Values</label>
        <textarea className="form-textarea" value={anomalyForm.recent_values} onChange={e => setAnomalyForm(p => ({ ...p, recent_values: e.target.value }))} rows={3} placeholder="Paste recent values or describe patterns..." />
      </div>
      <button className="btn btn-primary" onClick={handleDetectAnomalies} disabled={loading} style={{ marginTop: '1rem' }}>
        <AlertTriangle size={16} /> Detect Anomalies
      </button>
    </div>
  );

  const renderAnomalyResult = () => {
    if (!result) return null;
    const anomalies = ensureArray(result.anomalies || result.detected_anomalies || [result]);
    return (
      <div className="ai-output">
        <div className="ai-output-card">
          <div className="ai-output-header">Anomaly Detection Results</div>
          <div className="ai-output-body">
            {anomalies.map((anomaly, i) => (
              <div key={i} style={{
                border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '1rem',
                marginBottom: '1rem', borderLeft: `4px solid ${getSeverityColor(anomaly.severity)}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1rem' }}>{anomaly.type || anomaly.anomaly_type || `Anomaly ${i + 1}`}</strong>
                  {anomaly.severity && (
                    <span style={{
                      background: getSeverityColor(anomaly.severity), color: '#fff',
                      padding: '2px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                    }}>{anomaly.severity}</span>
                  )}
                </div>
                {anomaly.affected_records && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: '4px 0' }}>
                    Affected Records: <strong>{anomaly.affected_records}</strong>
                  </p>
                )}
                {(anomaly.pattern || anomaly.description) && (
                  <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)', margin: '8px 0' }}>{anomaly.pattern || anomaly.description}</p>
                )}
                {anomaly.recommendations && (
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>Recommendations:</strong>
                    <ul style={{ margin: '4px 0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {ensureArray(anomaly.recommendations).map((rec, j) => (
                        <li key={j} style={{ padding: '2px 0' }}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {result.pattern_description && (
              <div className="ai-output-section">
                <div className="ai-section-title">Pattern Description</div>
                <p style={{ lineHeight: 1.7 }}>{result.pattern_description}</p>
              </div>
            )}
            {result.recommendations && !anomalies[0]?.recommendations && (
              <div className="ai-output-section">
                <div className="ai-section-title">Recommendations</div>
                <ul className="ai-recommendation-list">
                  {ensureArray(result.recommendations).map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPolicyForm = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Policy Type *</label>
        <select className="form-select" value={policyForm.policy_type} onChange={e => setPolicyForm(p => ({ ...p, policy_type: e.target.value }))}>
          <option value="retention">Retention</option>
          <option value="privacy">Privacy</option>
          <option value="access">Access</option>
          <option value="quality">Quality</option>
          <option value="security">Security</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Scope *</label>
        <input className="form-input" value={policyForm.scope} onChange={e => setPolicyForm(p => ({ ...p, scope: e.target.value }))} placeholder="e.g. All passenger personal data" />
      </div>
      <div className="form-group">
        <label className="form-label">Industry Context</label>
        <input className="form-input" value={policyForm.industry_context} onChange={e => setPolicyForm(p => ({ ...p, industry_context: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Compliance Requirements</label>
        <textarea className="form-textarea" value={policyForm.compliance_requirements} onChange={e => setPolicyForm(p => ({ ...p, compliance_requirements: e.target.value }))} rows={3} placeholder="e.g. GDPR, CCPA, IATA Resolution 830d..." />
      </div>
      <button className="btn btn-primary" onClick={handleGeneratePolicy} disabled={loading} style={{ marginTop: '1rem' }}>
        <Shield size={16} /> Generate Policy
      </button>
    </div>
  );

  const renderPolicyResult = () => {
    if (!result) return null;
    return (
      <div className="ai-output">
        <div className="ai-output-card">
          <div className="ai-output-header">{result.policy_name || result.name || 'Generated Policy'}</div>
          <div className="ai-output-body">
            {(result.description || result.summary) && (
              <div className="ai-output-section">
                <div className="ai-section-title">Description</div>
                <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{result.description || result.summary}</p>
              </div>
            )}

            {result.key_provisions && (
              <div className="ai-output-section">
                <div className="ai-section-title">Key Provisions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {ensureArray(result.key_provisions).map((provision, i) => (
                    <div key={i} style={{
                      border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '12px 16px',
                      display: 'flex', gap: '12px', alignItems: 'flex-start'
                    }}>
                      <span style={{
                        background: '#2563eb', color: '#fff', borderRadius: '50%',
                        width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
                      }}>{i + 1}</span>
                      <span style={{ lineHeight: 1.6 }}>{typeof provision === 'object' ? provision.description || provision.title || JSON.stringify(provision) : provision}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.implementation_steps && (
              <div className="ai-output-section">
                <div className="ai-section-title">Implementation Steps</div>
                <div style={{ borderLeft: '3px solid #2563eb', paddingLeft: '1rem' }}>
                  {ensureArray(result.implementation_steps).map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--bg-tertiary)' }}>
                      <CheckSquare size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ lineHeight: 1.6 }}>{typeof step === 'object' ? step.description || step.step || JSON.stringify(step) : step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderImpactForm = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Change Type *</label>
        <select className="form-select" value={impactForm.change_type} onChange={e => setImpactForm(p => ({ ...p, change_type: e.target.value }))}>
          <option value="schema_change">Schema Change</option>
          <option value="data_migration">Data Migration</option>
          <option value="column_removal">Column Removal</option>
          <option value="table_deprecation">Table Deprecation</option>
          <option value="system_upgrade">System Upgrade</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Target Table *</label>
        <input className="form-input" value={impactForm.target_table} onChange={e => setImpactForm(p => ({ ...p, target_table: e.target.value }))} placeholder="e.g. passenger_records" />
      </div>
      <div className="form-group">
        <label className="form-label">Target Column</label>
        <input className="form-input" value={impactForm.target_column} onChange={e => setImpactForm(p => ({ ...p, target_column: e.target.value }))} placeholder="e.g. passport_number" />
      </div>
      <div className="form-group">
        <label className="form-label">Proposed Change *</label>
        <textarea className="form-textarea" value={impactForm.proposed_change} onChange={e => setImpactForm(p => ({ ...p, proposed_change: e.target.value }))} rows={3} placeholder="Describe the proposed change in detail..." />
      </div>
      <button className="btn btn-primary" onClick={handleImpactAnalysis} disabled={loading} style={{ marginTop: '1rem' }}>
        <GitBranch size={16} /> Analyze Impact
      </button>
    </div>
  );

  const renderImpactResult = () => {
    if (!result) return null;
    const riskLevel = result.risk_level || result.overall_risk || 'unknown';
    return (
      <div className="ai-output">
        <div className="ai-output-card">
          <div className="ai-output-header">Impact Analysis Results</div>
          <div className="ai-output-body">
            <div className="ai-output-section" style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Overall Risk Level</div>
              <span style={{
                background: getRiskColor(riskLevel), color: '#fff',
                padding: '8px 24px', borderRadius: '8px', fontSize: '1.2rem',
                fontWeight: 700, display: 'inline-block', textTransform: 'uppercase'
              }}>{riskLevel}</span>
            </div>

            {result.affected_systems && (
              <div className="ai-output-section">
                <div className="ai-section-title">Affected Systems</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {ensureArray(result.affected_systems).map((sys, i) => (
                    <div key={i} style={{
                      border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)'
                    }}>
                      <GitBranch size={16} color="#2563eb" />
                      <span style={{ fontWeight: 500 }}>{typeof sys === 'object' ? sys.name || JSON.stringify(sys) : sys}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.affected_tables && (
              <div className="ai-output-section">
                <div className="ai-section-title">Affected Tables</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ensureArray(result.affected_tables).map((tbl, i) => (
                    <span key={i} style={{
                      background: '#dbeafe', color: '#1e40af', padding: '4px 12px',
                      borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, fontFamily: 'monospace'
                    }}>{typeof tbl === 'object' ? tbl.name || JSON.stringify(tbl) : tbl}</span>
                  ))}
                </div>
              </div>
            )}

            {result.mitigation_steps && (
              <div className="ai-output-section">
                <div className="ai-section-title">Mitigation Steps</div>
                <div style={{ borderLeft: '3px solid #ea580c', paddingLeft: '1rem' }}>
                  {ensureArray(result.mitigation_steps).map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--bg-tertiary)' }}>
                      <CheckSquare size={18} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ lineHeight: 1.6 }}>{typeof step === 'object' ? step.description || step.step || JSON.stringify(step) : step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.recommendations && (
              <div className="ai-output-section">
                <div className="ai-section-title">Recommendations</div>
                <ul className="ai-recommendation-list">
                  {ensureArray(result.recommendations).map((rec, i) => (
                    <li key={i} style={{ padding: '6px 0' }}>{typeof rec === 'object' ? rec.description || JSON.stringify(rec) : rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderQualityForm = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Table Name *</label>
        <input className="form-input" value={qualityForm.table_name} onChange={e => setQualityForm(p => ({ ...p, table_name: e.target.value }))} placeholder="e.g. flight_schedules" />
      </div>
      <div className="form-group">
        <label className="form-label">Columns *</label>
        <textarea className="form-textarea" value={qualityForm.columns} onChange={e => setQualityForm(p => ({ ...p, columns: e.target.value }))} rows={3} placeholder="List columns: flight_number, departure_time, arrival_time, status..." />
      </div>
      <div className="form-group">
        <label className="form-label">Sample Data</label>
        <textarea className="form-textarea" value={qualityForm.sample_data} onChange={e => setQualityForm(p => ({ ...p, sample_data: e.target.value }))} rows={3} placeholder="Paste sample data..." />
      </div>
      <button className="btn btn-primary" onClick={handleSuggestQuality} disabled={loading} style={{ marginTop: '1rem' }}>
        <CheckSquare size={16} /> Suggest Rules
      </button>
    </div>
  );

  const renderQualityResult = () => {
    if (!result) return null;
    const rules = ensureArray(result.rules || result.quality_rules || result.suggested_rules || [result]);
    return (
      <div className="ai-output">
        <div className="ai-output-card">
          <div className="ai-output-header">Suggested Quality Rules</div>
          <div className="ai-output-body">
            {rules.map((rule, i) => (
              <div key={i} style={{
                border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '1rem',
                marginBottom: '1rem', background: 'var(--bg-tertiary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1rem' }}>{rule.rule_name || rule.name || `Rule ${i + 1}`}</strong>
                  {(rule.type || rule.rule_type) && (
                    <span style={{
                      background: '#dbeafe', color: '#1e40af', padding: '2px 10px',
                      borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                    }}>{rule.type || rule.rule_type}</span>
                  )}
                </div>
                {(rule.expression || rule.rule_expression) && (
                  <div style={{
                    background: '#1f2937', color: '#e5e7eb', padding: '10px 14px',
                    borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem',
                    margin: '8px 0', overflowX: 'auto'
                  }}>
                    {rule.expression || rule.rule_expression}
                  </div>
                )}
                {rule.threshold != null && (
                  <div style={{ margin: '8px 0' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Threshold: </span>
                    <span style={{
                      background: '#fef3c7', color: '#92400e', padding: '2px 8px',
                      borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600
                    }}>{typeof rule.threshold === 'number' ? `${(rule.threshold * 100).toFixed(0)}%` : rule.threshold}</span>
                  </div>
                )}
                {(rule.rationale || rule.description) && (
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {rule.rationale || rule.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDescForm = () => (
    <div>
      <div className="form-group">
        <label className="form-label">Table Name *</label>
        <input className="form-input" value={descForm.table_name} onChange={e => setDescForm(p => ({ ...p, table_name: e.target.value }))} placeholder="e.g. loyalty_members" />
      </div>
      <div className="form-group">
        <label className="form-label">Column Name *</label>
        <input className="form-input" value={descForm.column_name} onChange={e => setDescForm(p => ({ ...p, column_name: e.target.value }))} placeholder="e.g. tier_status" />
      </div>
      <div className="form-group">
        <label className="form-label">Data Type</label>
        <input className="form-input" value={descForm.data_type} onChange={e => setDescForm(p => ({ ...p, data_type: e.target.value }))} placeholder="e.g. varchar, integer, date" />
      </div>
      <div className="form-group">
        <label className="form-label">Sample Values</label>
        <textarea className="form-textarea" value={descForm.sample_values} onChange={e => setDescForm(p => ({ ...p, sample_values: e.target.value }))} rows={3} placeholder="Paste sample values..." />
      </div>
      <button className="btn btn-primary" onClick={handleGenerateDesc} disabled={loading} style={{ marginTop: '1rem' }}>
        <FileText size={16} /> Generate
      </button>
    </div>
  );

  const renderDescResult = () => {
    if (!result) return null;
    return (
      <div className="ai-output">
        <div className="ai-output-card">
          <div className="ai-output-header">Generated Description</div>
          <div className="ai-output-body">
            {result.description && (
              <div className="ai-output-section">
                <div className="ai-section-title">Description</div>
                <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{result.description}</p>
              </div>
            )}
            {result.business_definition && (
              <div className="ai-output-section">
                <div className="ai-section-title">Business Definition</div>
                <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{result.business_definition}</p>
              </div>
            )}
            {result.suggested_tags && (
              <div className="ai-output-section">
                <div className="ai-section-title">Suggested Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ensureArray(result.suggested_tags).map((tag, i) => (
                    <span key={i} style={{
                      background: '#e0e7ff', color: '#3730a3', padding: '4px 12px',
                      borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const formRenderers = {
    classifier: renderClassifierForm,
    anomaly: renderAnomalyForm,
    policy: renderPolicyForm,
    impact: renderImpactForm,
    quality: renderQualityForm,
    description: renderDescForm
  };

  const resultRenderers = {
    classifier: renderClassifierResult,
    anomaly: renderAnomalyResult,
    policy: renderPolicyResult,
    impact: renderImpactResult,
    quality: renderQualityResult,
    description: renderDescResult
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Sparkles size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />AI Insights</h1>
          <p className="page-subtitle">AI-powered data governance tools for classification, analysis, and automation</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0', borderBottom: '2px solid var(--border-primary)',
        marginBottom: '1.5rem', overflowX: 'auto'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? '#2563eb' : 'var(--text-tertiary)',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-2px', whiteSpace: 'nowrap', fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Form Side */}
        <div style={{
          border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '1.5rem', background: 'var(--bg-tertiary)'
        }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {tabs.find(t => t.key === activeTab)?.label}
          </h3>
          {formRenderers[activeTab]?.()}
        </div>

        {/* Results Side */}
        <div style={{ minHeight: '300px' }}>
          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '4rem', color: 'var(--text-tertiary)'
            }}>
              <Loader size={40} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem', fontWeight: 500 }}>AI is analyzing your data...</p>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : result ? (
            resultRenderers[activeTab]?.()
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '4rem', color: 'var(--text-muted)',
              border: '2px dashed var(--border-primary)', borderRadius: '12px'
            }}>
              <Sparkles size={48} />
              <p style={{ marginTop: '1rem', fontWeight: 500 }}>Fill in the form and run the AI analysis</p>
              <p style={{ fontSize: '0.85rem' }}>Results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
