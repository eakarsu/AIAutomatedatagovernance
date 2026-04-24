import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, ArrowRight, GitBranch, Server, AlertCircle, Activity, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { lineageAPI, aiAPI } from '../services/api';

const DataLineage = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const emptyForm = {
    source_system: '', source_table: '', target_system: '', target_table: '',
    transformation_type: 'ETL', transformation_logic: '', data_flow_direction: 'forward',
    refresh_frequency: 'daily', last_sync: '', status: 'active'
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await lineageAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load lineage data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setFormData({ ...emptyForm }); setEditMode(false); setShowForm(true); };

  const handleEdit = (item) => { setFormData({ ...item }); setEditMode(true); setShowForm(true); setSelectedItem(null); };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete lineage "${item.source_table} -> ${item.target_table}"?`)) return;
    try {
      await lineageAPI.delete(item.id);
      toast.success('Lineage deleted successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete lineage');
    }
  };

  const handleSave = async () => {
    if (!formData.source_system || !formData.source_table || !formData.target_system || !formData.target_table) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await lineageAPI.update(formData.id, formData);
        toast.success('Lineage updated successfully');
      } else {
        await lineageAPI.create(formData);
        toast.success('Lineage created successfully');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update' : 'Failed to create');
    }
  };

  const handleAIImpact = async (item) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiAPI.impactAnalysis({
        source_system: item.source_system, source_table: item.source_table,
        target_system: item.target_system, target_table: item.target_table
      });
      setAiResult(res.data);
      toast.success('Impact analysis completed');
    } catch (err) {
      toast.error('Impact analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filtered = items.filter(item =>
    [item.source_system, item.source_table, item.target_system, item.target_table, item.transformation_type]
      .some(f => (f || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allSystems = items.flatMap(i => [i.source_system, i.target_system]).filter(Boolean);
  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    systems: new Set(allSystems).size,
    failed: items.filter(i => i.status === 'failed').length
  };

  const getStatusClass = (status) => {
    const map = { active: 'active', inactive: '', failed: 'critical', warning: 'warning' };
    return map[status] || '';
  };

  const riskColor = (level) => {
    const map = { high: 'critical', medium: 'warning', low: 'active' };
    return map[(level || '').toLowerCase()] || '';
  };

  const FlowArrow = ({ source, target }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontWeight: 600, color: '#3b82f6' }}>{source}</span>
      <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
      <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{target}</span>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Lineage</h1>
          <p className="page-subtitle">Track data flows and transformations across systems</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><GitBranch size={14} /> Total Flows</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label"><Activity size={14} /> Active</div></div>
        <div className="stat-card"><div className="stat-value">{stats.systems}</div><div className="stat-label"><Server size={14} /> Systems Connected</div></div>
        <div className="stat-card"><div className="stat-value">{stats.failed}</div><div className="stat-label"><AlertCircle size={14} /> Failed</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search lineage..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Source System</th><th>Source Table</th><th>Target System</th><th>Target Table</th><th>Transform Type</th><th>Direction</th><th>Frequency</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td>{item.source_system}</td>
                <td><strong>{item.source_table}</strong></td>
                <td>{item.target_system}</td>
                <td><strong>{item.target_table}</strong></td>
                <td>{item.transformation_type}</td>
                <td>{item.data_flow_direction}</td>
                <td>{item.refresh_frequency}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No lineage records found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => { setSelectedItem(null); setAiResult(null); }}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>Lineage Detail</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedItem(null); setAiResult(null); }}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
                <FlowArrow source={`${selectedItem.source_system}.${selectedItem.source_table}`} target={`${selectedItem.target_system}.${selectedItem.target_table}`} />
              </div>
              <div className="detail-row"><span className="detail-label">Source System</span><span className="detail-value">{selectedItem.source_system}</span></div>
              <div className="detail-row"><span className="detail-label">Source Table</span><span className="detail-value">{selectedItem.source_table}</span></div>
              <div className="detail-row"><span className="detail-label">Target System</span><span className="detail-value">{selectedItem.target_system}</span></div>
              <div className="detail-row"><span className="detail-label">Target Table</span><span className="detail-value">{selectedItem.target_table}</span></div>
              <div className="detail-row"><span className="detail-label">Transform Type</span><span className="detail-value">{selectedItem.transformation_type}</span></div>
              <div className="detail-row"><span className="detail-label">Transform Logic</span><span className="detail-value"><code style={{ fontSize: '0.85rem' }}>{selectedItem.transformation_logic || 'N/A'}</code></span></div>
              <div className="detail-row"><span className="detail-label">Direction</span><span className="detail-value">{selectedItem.data_flow_direction}</span></div>
              <div className="detail-row"><span className="detail-label">Frequency</span><span className="detail-value">{selectedItem.refresh_frequency}</span></div>
              <div className="detail-row"><span className="detail-label">Last Sync</span><span className="detail-value">{selectedItem.last_sync ? new Date(selectedItem.last_sync).toLocaleString() : 'Never'}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></span></div>

              <div style={{ marginTop: '1.5rem' }}>
                <button className="btn btn-primary" onClick={() => handleAIImpact(selectedItem)} disabled={aiLoading}>
                  <Sparkles size={16} /> {aiLoading ? 'Analyzing...' : 'AI Impact Analysis'}
                </button>
              </div>

              {aiResult && (
                <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', border: '2px solid transparent', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' }}>
                  <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} /> Impact Analysis Result</h3>

                  {aiResult.risk_level && (
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>Risk Level:</span>
                      <span className={`status-badge ${riskColor(aiResult.risk_level)}`}>{aiResult.risk_level}</span>
                    </div>
                  )}

                  {aiResult.affected_systems && aiResult.affected_systems.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Affected Systems</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                        {aiResult.affected_systems.map((sys, i) => (
                          <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                            <Server size={14} style={{ marginRight: '0.5rem', color: '#6366f1' }} />
                            <strong>{typeof sys === 'string' ? sys : sys.name || sys.system}</strong>
                            {sys.impact && <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>{sys.impact}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiResult.recommendations && aiResult.recommendations.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Recommendations</div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {aiResult.recommendations.map((rec, i) => <li key={i} style={{ marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>{rec}</li>)}
                      </ul>
                    </div>
                  )}

                  {aiResult.summary && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Summary</div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{aiResult.summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Lineage' : 'Add Lineage'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Source System *</label>
                <input className="form-input" name="source_system" value={formData.source_system || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Source Table *</label>
                <input className="form-input" name="source_table" value={formData.source_table || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Target System *</label>
                <input className="form-input" name="target_system" value={formData.target_system || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Target Table *</label>
                <input className="form-input" name="target_table" value={formData.target_table || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Transformation Type</label>
                <select className="form-select" name="transformation_type" value={formData.transformation_type || 'ETL'} onChange={handleChange}>
                  <option value="ETL">ETL</option>
                  <option value="ELT">ELT</option>
                  <option value="CDC">CDC</option>
                  <option value="streaming">Streaming</option>
                  <option value="batch">Batch</option>
                  <option value="api">API</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transformation Logic</label>
                <textarea className="form-textarea" name="transformation_logic" value={formData.transformation_logic || ''} onChange={handleChange} rows={3} placeholder="Describe the transformation..." />
              </div>
              <div className="form-group">
                <label className="form-label">Data Flow Direction</label>
                <select className="form-select" name="data_flow_direction" value={formData.data_flow_direction || 'forward'} onChange={handleChange}>
                  <option value="forward">Forward</option>
                  <option value="reverse">Reverse</option>
                  <option value="bidirectional">Bidirectional</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Refresh Frequency</label>
                <select className="form-select" name="refresh_frequency" value={formData.refresh_frequency || 'daily'} onChange={handleChange}>
                  <option value="real-time">Real-time</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Last Sync</label>
                <input className="form-input" name="last_sync" type="datetime-local" value={formData.last_sync || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'active'} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="failed">Failed</option>
                  <option value="warning">Warning</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataLineage;
