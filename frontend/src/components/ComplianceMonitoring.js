import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { complianceAPI } from '../services/api';

const ComplianceMonitoring = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);

  const emptyForm = {
    regulation: '', requirement: '', status: 'in_progress', evidence: '',
    risk_level: 'medium', responsible_party: '', due_date: '', last_assessed: '', notes: ''
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await complianceAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ ...emptyForm });
    setEditMode(false);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...item });
    setEditMode(true);
    setShowForm(true);
    setSelectedItem(null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete compliance record for "${item.regulation} - ${item.requirement}"? This action cannot be undone.`)) return;
    try {
      await complianceAPI.delete(item.id);
      toast.success(`Compliance record deleted successfully`);
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  const handleSave = async () => {
    if (!formData.regulation || !formData.requirement || !formData.responsible_party) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await complianceAPI.update(formData.id, formData);
        toast.success('Compliance record updated successfully');
      } else {
        await complianceAPI.create(formData);
        toast.success('Compliance record created successfully');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update record' : 'Failed to create record');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filtered = items.filter(item =>
    [item.regulation, item.requirement, item.responsible_party, item.status, item.risk_level, item.notes]
      .some(field => (field || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    compliant: items.filter(i => i.status === 'compliant').length,
    nonCompliant: items.filter(i => i.status === 'non_compliant').length,
    highRisk: items.filter(i => i.risk_level === 'high' || i.risk_level === 'critical').length
  };

  const getRegulationBadge = (reg) => {
    const map = {
      GDPR: { background: '#7c3aed', color: '#fff' },
      CCPA: { background: '#2563eb', color: '#fff' },
      SOX: { background: '#ea580c', color: '#fff' },
      'PCI-DSS': { background: '#dc2626', color: '#fff' },
      IATA: { background: '#0d9488', color: '#fff' },
      DOT: { background: '#16a34a', color: '#fff' }
    };
    const style = map[reg] || { background: '#6b7280', color: '#fff' };
    return <span style={{ ...style, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{reg}</span>;
  };

  const getRiskClass = (level) => {
    const map = { low: 'active', medium: 'warning', high: 'pending', critical: 'critical' };
    return map[level] || '';
  };

  const getStatusClass = (status) => {
    const map = { compliant: 'active', non_compliant: 'critical', in_progress: 'warning', not_applicable: 'inactive' };
    return map[status] || '';
  };

  const formatStatus = (status) => (status || '').replace(/_/g, ' ');

  const truncate = (str, len = 50) => {
    if (!str) return 'N/A';
    return str.length > len ? str.substring(0, len) + '...' : str;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Monitoring</h1>
          <p className="page-subtitle">Track regulatory compliance across your data governance framework</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><Shield size={14} /> Total Records</div></div>
        <div className="stat-card"><div className="stat-value">{stats.compliant}</div><div className="stat-label"><CheckCircle size={14} /> Compliant</div></div>
        <div className="stat-card"><div className="stat-value">{stats.nonCompliant}</div><div className="stat-label"><XCircle size={14} /> Non-Compliant</div></div>
        <div className="stat-card"><div className="stat-value">{stats.highRisk}</div><div className="stat-label"><AlertTriangle size={14} /> High Risk</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search regulations, requirements, parties..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Regulation</th><th>Requirement</th><th>Status</th><th>Risk Level</th><th>Responsible</th><th>Due Date</th><th>Last Assessed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td>{getRegulationBadge(item.regulation)}</td>
                <td>{truncate(item.requirement)}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{formatStatus(item.status)}</span></td>
                <td><span className={`status-badge ${getRiskClass(item.risk_level)}`}>{item.risk_level}</span></td>
                <td>{item.responsible_party}</td>
                <td>{item.due_date || 'N/A'}</td>
                <td>{item.last_assessed || 'N/A'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No compliance records found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.regulation} Compliance</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Regulation</span><span className="detail-value">{getRegulationBadge(selectedItem.regulation)}</span></div>
              <div className="detail-row"><span className="detail-label">Requirement</span><span className="detail-value">{selectedItem.requirement}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{formatStatus(selectedItem.status)}</span></span></div>
              <div className="detail-row"><span className="detail-label">Risk Level</span><span className="detail-value"><span className={`status-badge ${getRiskClass(selectedItem.risk_level)}`}>{selectedItem.risk_level}</span></span></div>
              <div className="detail-row"><span className="detail-label">Evidence</span><span className="detail-value">{selectedItem.evidence || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Responsible Party</span><span className="detail-value">{selectedItem.responsible_party}</span></div>
              <div className="detail-row"><span className="detail-label">Due Date</span><span className="detail-value">{selectedItem.due_date || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Last Assessed</span><span className="detail-value">{selectedItem.last_assessed || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Notes</span><span className="detail-value">{selectedItem.notes || 'N/A'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Compliance Record' : 'Add Compliance Record'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Regulation *</label>
                <select className="form-select" name="regulation" value={formData.regulation || ''} onChange={handleChange}>
                  <option value="">Select Regulation</option>
                  <option value="GDPR">GDPR</option>
                  <option value="CCPA">CCPA</option>
                  <option value="SOX">SOX</option>
                  <option value="PCI-DSS">PCI-DSS</option>
                  <option value="IATA">IATA</option>
                  <option value="DOT">DOT</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Requirement *</label>
                <textarea className="form-textarea" name="requirement" value={formData.requirement || ''} onChange={handleChange} rows={3} placeholder="Describe the compliance requirement..." />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'in_progress'} onChange={handleChange}>
                  <option value="compliant">Compliant</option>
                  <option value="non_compliant">Non-Compliant</option>
                  <option value="in_progress">In Progress</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Risk Level</label>
                <select className="form-select" name="risk_level" value={formData.risk_level || 'medium'} onChange={handleChange}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Evidence</label>
                <textarea className="form-textarea" name="evidence" value={formData.evidence || ''} onChange={handleChange} rows={2} placeholder="Evidence of compliance..." />
              </div>
              <div className="form-group">
                <label className="form-label">Responsible Party *</label>
                <input className="form-input" name="responsible_party" value={formData.responsible_party || ''} onChange={handleChange} placeholder="e.g. Data Privacy Officer" />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" name="due_date" type="date" value={formData.due_date || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Assessed</label>
                <input className="form-input" name="last_assessed" type="date" value={formData.last_assessed || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} placeholder="Additional notes..." />
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

export default ComplianceMonitoring;
