import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, Shield, Key, Users, Lock, Database, FileText, Server } from 'lucide-react';
import { toast } from 'react-toastify';
import { accessControlAPI } from '../services/api';

const AccessControl = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);

  const emptyForm = {
    resource_name: '', resource_type: 'table', role_name: '', permission_level: 'read',
    granted_by: '', granted_to: '', department: '', justification: '', expiry_date: '', status: 'active'
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await accessControlAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load access control data');
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
    if (!window.confirm(`Delete access control entry for "${item.resource_name}"? This action cannot be undone.`)) return;
    try {
      await accessControlAPI.delete(item.id);
      toast.success('Access control entry deleted successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete entry');
    }
  };

  const handleSave = async () => {
    if (!formData.resource_name || !formData.role_name || !formData.granted_to) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await accessControlAPI.update(formData.id, formData);
        toast.success('Access control entry updated successfully');
      } else {
        await accessControlAPI.create(formData);
        toast.success('Access control entry created successfully');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update entry' : 'Failed to create entry');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filtered = items.filter(item =>
    [item.resource_name, item.resource_type, item.role_name, item.permission_level, item.granted_to, item.department, item.status]
      .some(field => (field || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    expired: items.filter(i => i.status === 'expired').length,
    pendingReview: items.filter(i => i.status === 'pending_review').length
  };

  const getPermissionClass = (level) => {
    const map = { read: 'active', write: 'info', admin: 'purple', none: 'inactive' };
    return map[level] || '';
  };

  const getPermissionStyle = (level) => {
    const map = {
      read: { background: '#dcfce7', color: '#166534' },
      write: { background: '#dbeafe', color: '#1e40af' },
      admin: { background: '#f3e8ff', color: '#6b21a8' },
      none: { background: '#f3f4f6', color: '#6b7280' }
    };
    return map[level] || { background: '#f3f4f6', color: '#6b7280' };
  };

  const getStatusClass = (status) => {
    const map = { active: 'active', expired: 'critical', pending_review: 'warning', revoked: 'inactive' };
    return map[status] || '';
  };

  const getResourceIcon = (type) => {
    const map = {
      table: <Database size={14} />,
      database: <Server size={14} />,
      schema: <FileText size={14} />,
      column: <Key size={14} />,
      report: <FileText size={14} />,
      api: <Lock size={14} />
    };
    return map[type] || <FileText size={14} />;
  };

  const getResourceTypeStyle = (type) => {
    const map = {
      table: { background: '#dbeafe', color: '#1e40af' },
      database: { background: '#f3e8ff', color: '#6b21a8' },
      schema: { background: '#fef3c7', color: '#92400e' },
      column: { background: '#dcfce7', color: '#166534' },
      report: { background: '#fce7f3', color: '#9d174d' },
      api: { background: '#e0e7ff', color: '#3730a3' }
    };
    return map[type] || { background: '#f3f4f6', color: '#6b7280' };
  };

  const formatStatus = (status) => (status || '').replace(/_/g, ' ');

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Access Control</h1>
          <p className="page-subtitle">Manage data access permissions and role-based controls</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><Shield size={14} /> Total Entries</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label"><Key size={14} /> Active</div></div>
        <div className="stat-card"><div className="stat-value">{stats.expired}</div><div className="stat-label"><Lock size={14} /> Expired</div></div>
        <div className="stat-card"><div className="stat-value">{stats.pendingReview}</div><div className="stat-label"><Users size={14} /> Pending Review</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search resources, roles, permissions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Resource</th><th>Type</th><th>Role</th><th>Permission</th><th>Granted To</th><th>Department</th><th>Expiry</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.resource_name}</strong></td>
                <td>
                  <span style={{ ...getResourceTypeStyle(item.resource_type), padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {getResourceIcon(item.resource_type)} {item.resource_type}
                  </span>
                </td>
                <td>{item.role_name}</td>
                <td>
                  <span style={{ ...getPermissionStyle(item.permission_level), padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {item.permission_level}
                  </span>
                </td>
                <td>{item.granted_to}</td>
                <td>{item.department}</td>
                <td>{item.expiry_date || 'No Expiry'}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{formatStatus(item.status)}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No access control entries found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.resource_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Resource Name</span><span className="detail-value">{selectedItem.resource_name}</span></div>
              <div className="detail-row">
                <span className="detail-label">Resource Type</span>
                <span className="detail-value">
                  <span style={{ ...getResourceTypeStyle(selectedItem.resource_type), padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {getResourceIcon(selectedItem.resource_type)} {selectedItem.resource_type}
                  </span>
                </span>
              </div>
              <div className="detail-row"><span className="detail-label">Role Name</span><span className="detail-value">{selectedItem.role_name}</span></div>
              <div className="detail-row">
                <span className="detail-label">Permission Level</span>
                <span className="detail-value">
                  <span style={{ ...getPermissionStyle(selectedItem.permission_level), padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {selectedItem.permission_level}
                  </span>
                </span>
              </div>
              <div className="detail-row"><span className="detail-label">Granted By</span><span className="detail-value">{selectedItem.granted_by || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Granted To</span><span className="detail-value">{selectedItem.granted_to}</span></div>
              <div className="detail-row"><span className="detail-label">Department</span><span className="detail-value">{selectedItem.department || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Justification</span><span className="detail-value">{selectedItem.justification || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Expiry Date</span><span className="detail-value">{selectedItem.expiry_date || 'No Expiry'}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{formatStatus(selectedItem.status)}</span></span></div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Access Control' : 'Add Access Control'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Resource Name *</label>
                <input className="form-input" name="resource_name" value={formData.resource_name || ''} onChange={handleChange} placeholder="e.g. passenger_bookings" />
              </div>
              <div className="form-group">
                <label className="form-label">Resource Type</label>
                <select className="form-select" name="resource_type" value={formData.resource_type || 'table'} onChange={handleChange}>
                  <option value="table">Table</option>
                  <option value="database">Database</option>
                  <option value="schema">Schema</option>
                  <option value="column">Column</option>
                  <option value="report">Report</option>
                  <option value="api">API</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Role Name *</label>
                <input className="form-input" name="role_name" value={formData.role_name || ''} onChange={handleChange} placeholder="e.g. Data Analyst" />
              </div>
              <div className="form-group">
                <label className="form-label">Permission Level</label>
                <select className="form-select" name="permission_level" value={formData.permission_level || 'read'} onChange={handleChange}>
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                  <option value="admin">Admin</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Granted By</label>
                <input className="form-input" name="granted_by" value={formData.granted_by || ''} onChange={handleChange} placeholder="e.g. admin@airline.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Granted To *</label>
                <input className="form-input" name="granted_to" value={formData.granted_to || ''} onChange={handleChange} placeholder="e.g. john.doe@airline.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-input" name="department" value={formData.department || ''} onChange={handleChange} placeholder="e.g. Revenue Management" />
              </div>
              <div className="form-group">
                <label className="form-label">Justification</label>
                <textarea className="form-textarea" name="justification" value={formData.justification || ''} onChange={handleChange} rows={3} placeholder="Reason for access..." />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input className="form-input" name="expiry_date" type="date" value={formData.expiry_date || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'active'} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="revoked">Revoked</option>
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

export default AccessControl;
