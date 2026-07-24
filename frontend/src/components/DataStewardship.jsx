import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, Users, Building2, Globe, Table, UserCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { stewardshipAPI } from '../services/api';

const DataStewardship = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [tableInput, setTableInput] = useState('');

  const emptyForm = {
    steward_name: '', email: '', department: '', domain: '',
    responsibility_area: '', tables_managed: [], status: 'active',
    assigned_date: '', last_review: ''
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await stewardshipAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load stewardship data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setFormData({ ...emptyForm }); setTableInput(''); setEditMode(false); setShowForm(true); };

  const handleEdit = (item) => { setFormData({ ...item }); setTableInput(''); setEditMode(true); setShowForm(true); setSelectedItem(null); };

  const handleDelete = async (item) => {
    if (!window.confirm(`Remove steward "${item.steward_name}"?`)) return;
    try {
      await stewardshipAPI.delete(item.id);
      toast.success('Steward removed successfully');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to remove steward');
    }
  };

  const handleSave = async () => {
    if (!formData.steward_name || !formData.email || !formData.department) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await stewardshipAPI.update(formData.id, formData);
        toast.success('Steward updated');
      } else {
        await stewardshipAPI.create(formData);
        toast.success('Steward added');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update' : 'Failed to create');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addTable = () => {
    if (tableInput.trim() && !(formData.tables_managed || []).includes(tableInput.trim())) {
      setFormData(prev => ({ ...prev, tables_managed: [...(prev.tables_managed || []), tableInput.trim()] }));
      setTableInput('');
    }
  };

  const removeTable = (table) => {
    setFormData(prev => ({ ...prev, tables_managed: (prev.tables_managed || []).filter(t => t !== table) }));
  };

  const handleTableKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTable(); }
  };

  const filtered = items.filter(item =>
    [item.steward_name, item.email, item.department, item.domain, item.status]
      .some(f => (f || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allTables = items.flatMap(i => i.tables_managed || []);
  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    departments: new Set(items.map(i => i.department).filter(Boolean)).size,
    tablesCovered: new Set(allTables).size
  };

  const getStatusClass = (status) => {
    const map = { active: 'active', inactive: '', on_leave: 'warning' };
    return map[status] || '';
  };

  const TablePill = ({ name, onRemove }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#dbeafe', color: '#2563eb', fontSize: '0.75rem', fontWeight: 500 }}>
      {name}
      {onRemove && <X size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onRemove(name); }} />}
    </span>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Stewardship</h1>
          <p className="page-subtitle">Manage data stewards and their responsibilities</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><Users size={14} /> Total Stewards</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label"><UserCheck size={14} /> Active</div></div>
        <div className="stat-card"><div className="stat-value">{stats.departments}</div><div className="stat-label"><Building2 size={14} /> Departments</div></div>
        <div className="stat-card"><div className="stat-value">{stats.tablesCovered}</div><div className="stat-label"><Table size={14} /> Tables Covered</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search stewards..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Department</th><th>Domain</th><th>Status</th><th>Tables Managed</th><th>Assigned Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.steward_name}</strong></td>
                <td>{item.email}</td>
                <td>{item.department}</td>
                <td>{item.domain}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{(item.status || '').replace(/_/g, ' ')}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {(item.tables_managed || []).slice(0, 2).map((t, i) => <TablePill key={i} name={t} />)}
                    {(item.tables_managed || []).length > 2 && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>+{item.tables_managed.length - 2}</span>}
                  </div>
                </td>
                <td>{item.assigned_date ? new Date(item.assigned_date).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No stewards found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.steward_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{selectedItem.steward_name}</span></div>
              <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{selectedItem.email}</span></div>
              <div className="detail-row"><span className="detail-label">Department</span><span className="detail-value">{selectedItem.department}</span></div>
              <div className="detail-row"><span className="detail-label">Domain</span><span className="detail-value">{selectedItem.domain}</span></div>
              <div className="detail-row"><span className="detail-label">Responsibility Area</span><span className="detail-value">{selectedItem.responsibility_area || 'N/A'}</span></div>
              <div className="detail-row">
                <span className="detail-label">Tables Managed</span>
                <span className="detail-value">
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {(selectedItem.tables_managed || []).map((t, i) => <TablePill key={i} name={t} />)}
                    {(selectedItem.tables_managed || []).length === 0 && <span style={{ color: '#9ca3af' }}>None assigned</span>}
                  </div>
                </span>
              </div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{(selectedItem.status || '').replace(/_/g, ' ')}</span></span></div>
              <div className="detail-row"><span className="detail-label">Assigned Date</span><span className="detail-value">{selectedItem.assigned_date ? new Date(selectedItem.assigned_date).toLocaleDateString() : 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Last Review</span><span className="detail-value">{selectedItem.last_review ? new Date(selectedItem.last_review).toLocaleDateString() : 'N/A'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Steward' : 'Add Steward'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Steward Name *</label>
                <input className="form-input" name="steward_name" value={formData.steward_name || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" name="email" type="email" value={formData.email || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Department *</label>
                <input className="form-input" name="department" value={formData.department || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Domain</label>
                <input className="form-input" name="domain" value={formData.domain || ''} onChange={handleChange} placeholder="e.g. Customer Data, Financial Data" />
              </div>
              <div className="form-group">
                <label className="form-label">Responsibility Area</label>
                <textarea className="form-textarea" name="responsibility_area" value={formData.responsibility_area || ''} onChange={handleChange} rows={3} placeholder="Describe the steward's responsibilities..." />
              </div>
              <div className="form-group">
                <label className="form-label">Tables Managed</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input className="form-input" value={tableInput} onChange={e => setTableInput(e.target.value)} onKeyDown={handleTableKeyDown} placeholder="Type table name and press Enter" style={{ flex: 1 }} />
                  <button className="btn btn-sm btn-secondary" type="button" onClick={addTable}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {(formData.tables_managed || []).map((t, i) => <TablePill key={i} name={t} onRemove={removeTable} />)}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'active'} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Date</label>
                <input className="form-input" name="assigned_date" type="date" value={formData.assigned_date || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Review</label>
                <input className="form-input" name="last_review" type="date" value={formData.last_review || ''} onChange={handleChange} />
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

export default DataStewardship;
