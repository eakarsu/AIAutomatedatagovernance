import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, Shield, ShieldAlert, ShieldCheck, Eye, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { classificationAPI, aiAPI } from '../services/api';

const DataClassification = () => {
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
    table_name: '', column_name: '', classification_level: 'internal', data_type: '',
    pii_flag: false, phi_flag: false, pci_flag: false, classified_by: '',
    classification_method: 'manual', confidence_score: 0
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await classificationAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load classification data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setFormData({ ...emptyForm }); setEditMode(false); setShowForm(true); };

  const handleEdit = (item) => { setFormData({ ...item }); setEditMode(true); setShowForm(true); setSelectedItem(null); };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete classification for "${item.table_name}.${item.column_name}"?`)) return;
    try {
      await classificationAPI.delete(item.id);
      toast.success('Classification deleted successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete classification');
    }
  };

  const handleSave = async () => {
    if (!formData.table_name || !formData.column_name || !formData.classification_level) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await classificationAPI.update(formData.id, formData);
        toast.success('Classification updated successfully');
      } else {
        await classificationAPI.create(formData);
        toast.success('Classification created successfully');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update' : 'Failed to create');
    }
  };

  const handleAIClassify = async (item) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiAPI.classify({ table_name: item.table_name, column_name: item.column_name, data_type: item.data_type });
      setAiResult(res.data);
      toast.success('AI classification completed');
    } catch (err) {
      toast.error('AI classification failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const filtered = items.filter(item =>
    [item.table_name, item.column_name, item.classification_level, item.data_type]
      .some(f => (f || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    restricted: items.filter(i => i.classification_level === 'restricted').length,
    confidential: items.filter(i => i.classification_level === 'confidential').length,
    piiCount: items.filter(i => i.pii_flag).length
  };

  const classificationColor = (level) => {
    const map = { public: 'active', internal: 'info', confidential: 'warning', restricted: 'critical' };
    return map[level] || '';
  };

  const flagBadge = (val) => val
    ? <span className="status-badge critical" style={{ fontSize: '0.7rem' }}>YES</span>
    : <span className="status-badge" style={{ fontSize: '0.7rem', opacity: 0.5 }}>NO</span>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Classification</h1>
          <p className="page-subtitle">Classify and label sensitive data across your systems</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><Shield size={14} /> Total Classifications</div></div>
        <div className="stat-card"><div className="stat-value">{stats.restricted}</div><div className="stat-label"><ShieldAlert size={14} /> Restricted</div></div>
        <div className="stat-card"><div className="stat-value">{stats.confidential}</div><div className="stat-label"><ShieldCheck size={14} /> Confidential</div></div>
        <div className="stat-card"><div className="stat-value">{stats.piiCount}</div><div className="stat-label"><Eye size={14} /> PII Detected</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search classifications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th><th>Column</th><th>Classification</th><th>Data Type</th><th>PII</th><th>PHI</th><th>PCI</th><th>Method</th><th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.table_name}</strong></td>
                <td>{item.column_name}</td>
                <td><span className={`status-badge ${classificationColor(item.classification_level)}`}>{item.classification_level}</span></td>
                <td>{item.data_type}</td>
                <td>{flagBadge(item.pii_flag)}</td>
                <td>{flagBadge(item.phi_flag)}</td>
                <td>{flagBadge(item.pci_flag)}</td>
                <td>{item.classification_method}</td>
                <td>{item.confidence_score ? `${(item.confidence_score * 100).toFixed(0)}%` : 'N/A'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No classifications found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => { setSelectedItem(null); setAiResult(null); }}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.table_name}.{selectedItem.column_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedItem(null); setAiResult(null); }}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Table Name</span><span className="detail-value">{selectedItem.table_name}</span></div>
              <div className="detail-row"><span className="detail-label">Column Name</span><span className="detail-value">{selectedItem.column_name}</span></div>
              <div className="detail-row"><span className="detail-label">Classification</span><span className="detail-value"><span className={`status-badge ${classificationColor(selectedItem.classification_level)}`}>{selectedItem.classification_level}</span></span></div>
              <div className="detail-row"><span className="detail-label">Data Type</span><span className="detail-value">{selectedItem.data_type}</span></div>
              <div className="detail-row"><span className="detail-label">PII Flag</span><span className="detail-value">{flagBadge(selectedItem.pii_flag)}</span></div>
              <div className="detail-row"><span className="detail-label">PHI Flag</span><span className="detail-value">{flagBadge(selectedItem.phi_flag)}</span></div>
              <div className="detail-row"><span className="detail-label">PCI Flag</span><span className="detail-value">{flagBadge(selectedItem.pci_flag)}</span></div>
              <div className="detail-row"><span className="detail-label">Classified By</span><span className="detail-value">{selectedItem.classified_by}</span></div>
              <div className="detail-row"><span className="detail-label">Method</span><span className="detail-value">{selectedItem.classification_method}</span></div>
              <div className="detail-row"><span className="detail-label">Confidence</span><span className="detail-value">{selectedItem.confidence_score ? `${(selectedItem.confidence_score * 100).toFixed(0)}%` : 'N/A'}</span></div>

              <div style={{ marginTop: '1.5rem' }}>
                <button className="btn btn-primary" onClick={() => handleAIClassify(selectedItem)} disabled={aiLoading}>
                  <Sparkles size={16} /> {aiLoading ? 'Classifying...' : 'AI Classify'}
                </button>
              </div>

              {aiResult && (
                <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', border: '2px solid transparent', backgroundClip: 'padding-box', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' }}>
                  <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} /> AI Classification Result</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Classification</div>
                      <span className={`status-badge ${classificationColor(aiResult.classification_level)}`}>{aiResult.classification_level || 'N/A'}</span>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Confidence</div>
                      <strong>{aiResult.confidence ? `${(aiResult.confidence * 100).toFixed(0)}%` : 'N/A'}</strong>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>Flags</div>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {aiResult.pii_flag && <span className="status-badge critical">PII</span>}
                        {aiResult.phi_flag && <span className="status-badge warning">PHI</span>}
                        {aiResult.pci_flag && <span className="status-badge warning">PCI</span>}
                        {!aiResult.pii_flag && !aiResult.phi_flag && !aiResult.pci_flag && <span style={{ color: 'var(--text-muted)' }}>None</span>}
                      </div>
                    </div>
                  </div>

                  {aiResult.reasoning && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Reasoning</div>
                      <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{aiResult.reasoning}</p>
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
              <h2>{editMode ? 'Edit Classification' : 'Add Classification'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Table Name *</label>
                <input className="form-input" name="table_name" value={formData.table_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Column Name *</label>
                <input className="form-input" name="column_name" value={formData.column_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Classification Level *</label>
                <select className="form-select" name="classification_level" value={formData.classification_level || 'internal'} onChange={handleChange}>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Data Type</label>
                <input className="form-input" name="data_type" value={formData.data_type || ''} onChange={handleChange} placeholder="e.g. VARCHAR, INTEGER" />
              </div>
              <div style={{ display: 'flex', gap: '2rem', margin: '0.75rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" name="pii_flag" checked={formData.pii_flag || false} onChange={handleChange} /> PII
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" name="phi_flag" checked={formData.phi_flag || false} onChange={handleChange} /> PHI
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" name="pci_flag" checked={formData.pci_flag || false} onChange={handleChange} /> PCI
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Classified By</label>
                <input className="form-input" name="classified_by" value={formData.classified_by || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Classification Method</label>
                <select className="form-select" name="classification_method" value={formData.classification_method || 'manual'} onChange={handleChange}>
                  <option value="manual">Manual</option>
                  <option value="automated">Automated</option>
                  <option value="ai">AI-Assisted</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Confidence Score (0-1)</label>
                <input className="form-input" name="confidence_score" type="number" step="0.01" min="0" max="1" value={formData.confidence_score || 0} onChange={handleChange} />
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

export default DataClassification;
