import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, FileCheck, ShieldCheck, AlertTriangle, Clock, Sparkles, CheckSquare } from 'lucide-react';
import { toast } from 'react-toastify';
import { policiesAPI, aiAPI } from '../services/api';

const DataPolicies = () => {
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
    policy_name: '', category: 'data_privacy', description: '', scope: '',
    enforcement_level: 'mandatory', status: 'active', effective_date: '', review_date: '', owner: ''
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await policiesAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setFormData({ ...emptyForm }); setEditMode(false); setShowForm(true); };

  const handleEdit = (item) => { setFormData({ ...item }); setEditMode(true); setShowForm(true); setSelectedItem(null); };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete policy "${item.policy_name}"?`)) return;
    try {
      await policiesAPI.delete(item.id);
      toast.success('Policy deleted successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete policy');
    }
  };

  const handleSave = async () => {
    if (!formData.policy_name || !formData.category) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await policiesAPI.update(formData.id, formData);
        toast.success('Policy updated');
      } else {
        await policiesAPI.create(formData);
        toast.success('Policy created');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update' : 'Failed to create');
    }
  };

  const handleAIGenerate = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiAPI.generatePolicy({ existing_policies: items.map(i => i.policy_name) });
      setAiResult(res.data);
      toast.success('AI policy generated');
    } catch (err) {
      toast.error('AI policy generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filtered = items.filter(item =>
    [item.policy_name, item.category, item.scope, item.enforcement_level, item.status, item.owner]
      .some(f => (f || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    mandatory: items.filter(i => i.enforcement_level === 'mandatory').length,
    review: items.filter(i => i.status === 'under_review' || i.status === 'review').length
  };

  const getStatusClass = (status) => {
    const map = { active: 'active', draft: '', under_review: 'warning', review: 'warning', expired: 'critical', archived: '' };
    return map[status] || '';
  };

  const categoryColor = (cat) => {
    const map = { data_privacy: '#6366f1', data_retention: '#0ea5e9', data_access: '#f59e0b', data_quality: '#10b981', compliance: '#ef4444', security: '#ec4899' };
    return map[cat] || '#6b7280';
  };

  const enforcementClass = (level) => {
    const map = { mandatory: 'critical', recommended: 'warning', optional: 'active' };
    return map[level] || '';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Policies</h1>
          <p className="page-subtitle">Define and manage data governance policies</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleAIGenerate} disabled={aiLoading}>
            <Sparkles size={16} /> {aiLoading ? 'Generating...' : 'AI Generate Policy'}
          </button>
          <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><FileCheck size={14} /> Total Policies</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label"><ShieldCheck size={14} /> Active</div></div>
        <div className="stat-card"><div className="stat-value">{stats.mandatory}</div><div className="stat-label"><AlertTriangle size={14} /> Mandatory</div></div>
        <div className="stat-card"><div className="stat-value">{stats.review}</div><div className="stat-label"><Clock size={14} /> Under Review</div></div>
      </div>

      {/* AI Generated Policy */}
      {aiResult && (
        <div style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', border: '2px solid transparent', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} /> AI Generated Policy</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setAiResult(null)}><X size={14} /> Dismiss</button>
          </div>

          {aiResult.policy_name && (
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>{aiResult.policy_name}</h4>
          )}

          {aiResult.description && (
            <p style={{ margin: '0 0 1rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{aiResult.description}</p>
          )}

          {aiResult.key_provisions && aiResult.key_provisions.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Key Provisions</div>
              <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {aiResult.key_provisions.map((p, i) => <li key={i} style={{ marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>{p}</li>)}
              </ol>
            </div>
          )}

          {aiResult.implementation_steps && aiResult.implementation_steps.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Implementation Steps</div>
              {aiResult.implementation_steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <CheckSquare size={16} style={{ color: '#6366f1', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {aiResult.review_schedule && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Review Schedule</div>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{aiResult.review_schedule}</p>
            </div>
          )}
        </div>
      )}

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search policies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Policy Name</th><th>Category</th><th>Scope</th><th>Enforcement</th><th>Status</th><th>Effective Date</th><th>Review Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.policy_name}</strong></td>
                <td><span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${categoryColor(item.category)}15`, color: categoryColor(item.category), fontSize: '0.8rem', fontWeight: 500 }}>{(item.category || '').replace(/_/g, ' ')}</span></td>
                <td>{item.scope}</td>
                <td><span className={`status-badge ${enforcementClass(item.enforcement_level)}`}>{item.enforcement_level}</span></td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{(item.status || '').replace(/_/g, ' ')}</span></td>
                <td>{item.effective_date ? new Date(item.effective_date).toLocaleDateString() : 'N/A'}</td>
                <td>{item.review_date ? new Date(item.review_date).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No policies found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.policy_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Policy Name</span><span className="detail-value">{selectedItem.policy_name}</span></div>
              <div className="detail-row"><span className="detail-label">Category</span><span className="detail-value"><span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${categoryColor(selectedItem.category)}15`, color: categoryColor(selectedItem.category), fontSize: '0.8rem', fontWeight: 500 }}>{(selectedItem.category || '').replace(/_/g, ' ')}</span></span></div>
              <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{selectedItem.description || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Scope</span><span className="detail-value">{selectedItem.scope}</span></div>
              <div className="detail-row"><span className="detail-label">Enforcement Level</span><span className="detail-value"><span className={`status-badge ${enforcementClass(selectedItem.enforcement_level)}`}>{selectedItem.enforcement_level}</span></span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{(selectedItem.status || '').replace(/_/g, ' ')}</span></span></div>
              <div className="detail-row"><span className="detail-label">Effective Date</span><span className="detail-value">{selectedItem.effective_date ? new Date(selectedItem.effective_date).toLocaleDateString() : 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Review Date</span><span className="detail-value">{selectedItem.review_date ? new Date(selectedItem.review_date).toLocaleDateString() : 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Owner</span><span className="detail-value">{selectedItem.owner}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Policy' : 'Add Policy'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Policy Name *</label>
                <input className="form-input" name="policy_name" value={formData.policy_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" name="category" value={formData.category || 'data_privacy'} onChange={handleChange}>
                  <option value="data_privacy">Data Privacy</option>
                  <option value="data_retention">Data Retention</option>
                  <option value="data_access">Data Access</option>
                  <option value="data_quality">Data Quality</option>
                  <option value="compliance">Compliance</option>
                  <option value="security">Security</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" name="description" value={formData.description || ''} onChange={handleChange} rows={3} />
              </div>
              <div className="form-group">
                <label className="form-label">Scope</label>
                <input className="form-input" name="scope" value={formData.scope || ''} onChange={handleChange} placeholder="e.g. Organization-wide, Department-level" />
              </div>
              <div className="form-group">
                <label className="form-label">Enforcement Level</label>
                <select className="form-select" name="enforcement_level" value={formData.enforcement_level || 'mandatory'} onChange={handleChange}>
                  <option value="mandatory">Mandatory</option>
                  <option value="recommended">Recommended</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'active'} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="expired">Expired</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Effective Date</label>
                <input className="form-input" name="effective_date" type="date" value={formData.effective_date || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Review Date</label>
                <input className="form-input" name="review_date" type="date" value={formData.review_date || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Owner</label>
                <input className="form-input" name="owner" value={formData.owner || ''} onChange={handleChange} />
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

export default DataPolicies;
