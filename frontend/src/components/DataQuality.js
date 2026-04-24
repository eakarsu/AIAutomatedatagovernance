import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, CheckCircle, AlertTriangle, XCircle, Activity, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { qualityAPI, aiAPI } from '../services/api';

const DataQuality = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const emptyForm = {
    rule_name: '', table_name: '', column_name: '', rule_type: 'completeness',
    rule_expression: '', threshold: 95, current_score: 0, status: 'active', last_checked: ''
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await qualityAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load quality rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setFormData({ ...emptyForm }); setEditMode(false); setShowForm(true); };

  const handleEdit = (item) => { setFormData({ ...item }); setEditMode(true); setShowForm(true); setSelectedItem(null); };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete rule "${item.rule_name}"?`)) return;
    try {
      await qualityAPI.delete(item.id);
      toast.success('Rule deleted successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  const handleSave = async () => {
    if (!formData.rule_name || !formData.table_name) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await qualityAPI.update(formData.id, formData);
        toast.success('Rule updated successfully');
      } else {
        await qualityAPI.create(formData);
        toast.success('Rule created successfully');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update' : 'Failed to create');
    }
  };

  const handleAISuggest = async () => {
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const res = await aiAPI.suggestQualityRules({ existing_rules: items });
      setAiSuggestions(res.data);
      toast.success('AI suggestions generated');
    } catch (err) {
      toast.error('AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filtered = items.filter(item =>
    [item.rule_name, item.table_name, item.column_name, item.rule_type]
      .some(f => (f || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    critical: items.filter(i => i.status === 'critical').length,
    avgScore: items.length ? (items.reduce((s, i) => s + (Number(i.current_score) || 0), 0) / items.length).toFixed(1) : 0
  };

  const getStatusClass = (status) => {
    const map = { active: 'active', warning: 'warning', critical: 'critical', inactive: '' };
    return map[status] || '';
  };

  const scoreColor = (score) => {
    if (score > 90) return '#10b981';
    if (score > 70) return '#f59e0b';
    return '#ef4444';
  };

  const ScoreBar = ({ score }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: '8px', background: 'var(--border-primary)', borderRadius: '4px', overflow: 'hidden', minWidth: '60px' }}>
        <div style={{ width: `${score}%`, height: '100%', background: scoreColor(score), borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontWeight: 600, color: scoreColor(score), fontSize: '0.85rem', minWidth: '36px' }}>{score}%</span>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Quality</h1>
          <p className="page-subtitle">Monitor and enforce data quality rules across your data assets</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleAISuggest} disabled={aiLoading}>
            <Sparkles size={16} /> {aiLoading ? 'Generating...' : 'AI Suggest Rules'}
          </button>
          <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><CheckCircle size={14} /> Total Rules</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label"><Activity size={14} /> Active</div></div>
        <div className="stat-card"><div className="stat-value">{stats.critical}</div><div className="stat-label"><XCircle size={14} /> Critical</div></div>
        <div className="stat-card"><div className="stat-value">{stats.avgScore}%</div><div className="stat-label"><AlertTriangle size={14} /> Avg Score</div></div>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} /> AI Suggested Rules</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setAiSuggestions(null)}><X size={14} /> Dismiss</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {(aiSuggestions.suggestions || aiSuggestions || []).map((sug, i) => (
              <div key={i} style={{ padding: '1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>{sug.rule_name || sug.name || `Suggested Rule ${i + 1}`}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
                  <strong>Type:</strong> {sug.rule_type || 'N/A'} | <strong>Table:</strong> {sug.table_name || 'N/A'}
                </div>
                {sug.description && <p style={{ fontSize: '0.85rem', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>{sug.description}</p>}
                {sug.rule_expression && <code style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'block', marginTop: '0.5rem' }}>{sug.rule_expression}</code>}
                {sug.threshold && <div style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}><strong>Threshold:</strong> {sug.threshold}%</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search rules..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule Name</th><th>Table</th><th>Column</th><th>Type</th><th>Threshold</th><th>Score</th><th>Status</th><th>Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.rule_name}</strong></td>
                <td>{item.table_name}</td>
                <td>{item.column_name}</td>
                <td>{item.rule_type}</td>
                <td>{item.threshold}%</td>
                <td style={{ minWidth: '120px' }}><ScoreBar score={item.current_score || 0} /></td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span></td>
                <td>{item.last_checked ? new Date(item.last_checked).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No rules found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.rule_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Rule Name</span><span className="detail-value">{selectedItem.rule_name}</span></div>
              <div className="detail-row"><span className="detail-label">Table</span><span className="detail-value">{selectedItem.table_name}</span></div>
              <div className="detail-row"><span className="detail-label">Column</span><span className="detail-value">{selectedItem.column_name}</span></div>
              <div className="detail-row"><span className="detail-label">Rule Type</span><span className="detail-value">{selectedItem.rule_type}</span></div>
              <div className="detail-row"><span className="detail-label">Expression</span><span className="detail-value"><code>{selectedItem.rule_expression || 'N/A'}</code></span></div>
              <div className="detail-row"><span className="detail-label">Threshold</span><span className="detail-value">{selectedItem.threshold}%</span></div>
              <div className="detail-row"><span className="detail-label">Current Score</span><span className="detail-value"><ScoreBar score={selectedItem.current_score || 0} /></span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></span></div>
              <div className="detail-row"><span className="detail-label">Last Checked</span><span className="detail-value">{selectedItem.last_checked ? new Date(selectedItem.last_checked).toLocaleString() : 'Never'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Rule' : 'Add Quality Rule'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Rule Name *</label>
                <input className="form-input" name="rule_name" value={formData.rule_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Table Name *</label>
                <input className="form-input" name="table_name" value={formData.table_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Column Name</label>
                <input className="form-input" name="column_name" value={formData.column_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Rule Type</label>
                <select className="form-select" name="rule_type" value={formData.rule_type || 'completeness'} onChange={handleChange}>
                  <option value="completeness">Completeness</option>
                  <option value="accuracy">Accuracy</option>
                  <option value="consistency">Consistency</option>
                  <option value="timeliness">Timeliness</option>
                  <option value="uniqueness">Uniqueness</option>
                  <option value="validity">Validity</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rule Expression</label>
                <textarea className="form-textarea" name="rule_expression" value={formData.rule_expression || ''} onChange={handleChange} rows={3} placeholder="e.g. column IS NOT NULL" />
              </div>
              <div className="form-group">
                <label className="form-label">Threshold (%)</label>
                <input className="form-input" name="threshold" type="number" min="0" max="100" value={formData.threshold || 95} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Current Score (%)</label>
                <input className="form-input" name="current_score" type="number" min="0" max="100" value={formData.current_score || 0} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'active'} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Last Checked</label>
                <input className="form-input" name="last_checked" type="datetime-local" value={formData.last_checked || ''} onChange={handleChange} />
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

export default DataQuality;
