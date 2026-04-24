import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, Database, Server, Table, BarChart3 } from 'lucide-react';
import { toast } from 'react-toastify';
import { catalogAPI } from '../services/api';

const DataCatalog = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);

  const emptyForm = {
    table_name: '', schema_name: '', database_name: '', source_system: '',
    description: '', owner: '', row_count: 0, column_count: 0, status: 'active'
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await catalogAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load catalog data');
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
    if (!window.confirm(`Delete table "${item.table_name}"? This action cannot be undone.`)) return;
    try {
      await catalogAPI.delete(item.id);
      toast.success(`"${item.table_name}" deleted successfully`);
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const handleSave = async () => {
    if (!formData.table_name || !formData.schema_name || !formData.database_name) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await catalogAPI.update(formData.id, formData);
        toast.success(`"${formData.table_name}" updated successfully`);
      } else {
        await catalogAPI.create(formData);
        toast.success(`"${formData.table_name}" created successfully`);
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update item' : 'Failed to create item');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filtered = items.filter(item =>
    [item.table_name, item.schema_name, item.database_name, item.source_system, item.owner]
      .some(field => (field || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    active: items.filter(i => i.status === 'active').length,
    totalRows: items.reduce((sum, i) => sum + (Number(i.row_count) || 0), 0),
    sourceSystems: new Set(items.map(i => i.source_system).filter(Boolean)).size
  };

  const getStatusClass = (status) => {
    const map = { active: 'active', inactive: 'warning', deprecated: 'critical' };
    return map[status] || '';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Catalog</h1>
          <p className="page-subtitle">Manage and explore your organization's data assets</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><Database size={14} /> Total Tables</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label"><Table size={14} /> Active</div></div>
        <div className="stat-card"><div className="stat-value">{stats.totalRows.toLocaleString()}</div><div className="stat-label"><BarChart3 size={14} /> Total Rows</div></div>
        <div className="stat-card"><div className="stat-value">{stats.sourceSystems}</div><div className="stat-label"><Server size={14} /> Source Systems</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search tables, schemas, databases..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Table Name</th><th>Schema</th><th>Database</th><th>Source System</th><th>Owner</th><th>Rows</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.table_name}</strong></td>
                <td>{item.schema_name}</td>
                <td>{item.database_name}</td>
                <td>{item.source_system}</td>
                <td>{item.owner}</td>
                <td>{(item.row_count || 0).toLocaleString()}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No tables found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.table_name}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Table Name</span><span className="detail-value">{selectedItem.table_name}</span></div>
              <div className="detail-row"><span className="detail-label">Schema</span><span className="detail-value">{selectedItem.schema_name}</span></div>
              <div className="detail-row"><span className="detail-label">Database</span><span className="detail-value">{selectedItem.database_name}</span></div>
              <div className="detail-row"><span className="detail-label">Source System</span><span className="detail-value">{selectedItem.source_system}</span></div>
              <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{selectedItem.description || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Owner</span><span className="detail-value">{selectedItem.owner}</span></div>
              <div className="detail-row"><span className="detail-label">Row Count</span><span className="detail-value">{(selectedItem.row_count || 0).toLocaleString()}</span></div>
              <div className="detail-row"><span className="detail-label">Column Count</span><span className="detail-value">{selectedItem.column_count}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></span></div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Table' : 'Add New Table'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Table Name *</label>
                <input className="form-input" name="table_name" value={formData.table_name || ''} onChange={handleChange} placeholder="e.g. customers" />
              </div>
              <div className="form-group">
                <label className="form-label">Schema Name *</label>
                <input className="form-input" name="schema_name" value={formData.schema_name || ''} onChange={handleChange} placeholder="e.g. public" />
              </div>
              <div className="form-group">
                <label className="form-label">Database Name *</label>
                <input className="form-input" name="database_name" value={formData.database_name || ''} onChange={handleChange} placeholder="e.g. production_db" />
              </div>
              <div className="form-group">
                <label className="form-label">Source System</label>
                <input className="form-input" name="source_system" value={formData.source_system || ''} onChange={handleChange} placeholder="e.g. SAP, Salesforce" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" name="description" value={formData.description || ''} onChange={handleChange} rows={3} placeholder="Describe this table..." />
              </div>
              <div className="form-group">
                <label className="form-label">Owner</label>
                <input className="form-input" name="owner" value={formData.owner || ''} onChange={handleChange} placeholder="e.g. data-engineering" />
              </div>
              <div className="form-group">
                <label className="form-label">Row Count</label>
                <input className="form-input" name="row_count" type="number" value={formData.row_count || 0} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Column Count</label>
                <input className="form-input" name="column_count" type="number" value={formData.column_count || 0} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'active'} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="deprecated">Deprecated</option>
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

export default DataCatalog;
