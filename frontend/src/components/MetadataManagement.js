import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, Database, Users, Tag, FileText, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { metadataAPI, aiAPI } from '../services/api';

const MetadataManagement = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const emptyForm = {
    table_name: '', column_name: '', data_type: '', description: '',
    business_definition: '', technical_owner: '', business_owner: '', last_updated: '', tags: []
  };

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await metadataAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load metadata');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => { setFormData({ ...emptyForm }); setTagInput(''); setEditMode(false); setShowForm(true); };

  const handleEdit = (item) => { setFormData({ ...item }); setTagInput(''); setEditMode(true); setShowForm(true); setSelectedItem(null); };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete metadata for "${item.table_name}.${item.column_name}"?`)) return;
    try {
      await metadataAPI.delete(item.id);
      toast.success('Metadata entry deleted');
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleSave = async () => {
    if (!formData.table_name || !formData.column_name) {
      toast.warning('Please fill in all required fields');
      return;
    }
    try {
      if (editMode) {
        await metadataAPI.update(formData.id, formData);
        toast.success('Metadata updated');
      } else {
        await metadataAPI.create(formData);
        toast.success('Metadata created');
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update' : 'Failed to create');
    }
  };

  const handleAIDescription = async (item) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiAPI.generateDescription({ table_name: item.table_name, column_name: item.column_name, data_type: item.data_type });
      setAiResult(res.data);
      toast.success('AI description generated');
    } catch (err) {
      toast.error('AI description generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addTag = () => {
    if (tagInput.trim() && !(formData.tags || []).includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
  };

  const filtered = items.filter(item =>
    [item.table_name, item.column_name, item.data_type, item.description, item.technical_owner, item.business_owner]
      .some(f => (f || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    tables: new Set(items.map(i => i.table_name).filter(Boolean)).size,
    owners: new Set([...items.map(i => i.technical_owner), ...items.map(i => i.business_owner)].filter(Boolean)).size,
    tagged: items.filter(i => (i.tags || []).length > 0).length
  };

  const TagPill = ({ tag, onRemove }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#ede9fe', color: '#7c3aed', fontSize: '0.75rem', fontWeight: 500 }}>
      {tag}
      {onRemove && <X size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onRemove(tag); }} />}
    </span>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Metadata Management</h1>
          <p className="page-subtitle">Manage metadata definitions and documentation for all data assets</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><FileText size={14} /> Total Entries</div></div>
        <div className="stat-card"><div className="stat-value">{stats.tables}</div><div className="stat-label"><Database size={14} /> Tables Covered</div></div>
        <div className="stat-card"><div className="stat-value">{stats.owners}</div><div className="stat-label"><Users size={14} /> Owners</div></div>
        <div className="stat-card"><div className="stat-value">{stats.tagged}</div><div className="stat-label"><Tag size={14} /> Tagged</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search metadata..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th><th>Column</th><th>Data Type</th><th>Description</th><th>Tech Owner</th><th>Business Owner</th><th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td><strong>{item.table_name}</strong></td>
                <td>{item.column_name}</td>
                <td>{item.data_type}</td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || 'N/A'}</td>
                <td>{item.technical_owner}</td>
                <td>{item.business_owner}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {(item.tags || []).slice(0, 3).map((tag, i) => <TagPill key={i} tag={tag} />)}
                    {(item.tags || []).length > 3 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{item.tags.length - 3}</span>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No metadata found</td></tr>
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
              <div className="detail-row"><span className="detail-label">Data Type</span><span className="detail-value">{selectedItem.data_type}</span></div>
              <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{selectedItem.description || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Business Definition</span><span className="detail-value">{selectedItem.business_definition || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Technical Owner</span><span className="detail-value">{selectedItem.technical_owner}</span></div>
              <div className="detail-row"><span className="detail-label">Business Owner</span><span className="detail-value">{selectedItem.business_owner}</span></div>
              <div className="detail-row"><span className="detail-label">Last Updated</span><span className="detail-value">{selectedItem.last_updated ? new Date(selectedItem.last_updated).toLocaleString() : 'N/A'}</span></div>
              <div className="detail-row">
                <span className="detail-label">Tags</span>
                <span className="detail-value">
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {(selectedItem.tags || []).map((tag, i) => <TagPill key={i} tag={tag} />)}
                    {(selectedItem.tags || []).length === 0 && <span style={{ color: 'var(--text-muted)' }}>No tags</span>}
                  </div>
                </span>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <button className="btn btn-primary" onClick={() => handleAIDescription(selectedItem)} disabled={aiLoading}>
                  <Sparkles size={16} /> {aiLoading ? 'Generating...' : 'AI Generate Description'}
                </button>
              </div>

              {aiResult && (
                <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))', border: '2px solid transparent', boxShadow: '0 0 0 2px rgba(99,102,241,0.3)' }}>
                  <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={18} /> AI Generated Content</h3>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {aiResult.description && (
                      <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}><FileText size={14} /> Description</div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{aiResult.description}</p>
                      </div>
                    )}

                    {aiResult.business_definition && (
                      <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}><Database size={14} /> Business Definition</div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{aiResult.business_definition}</p>
                      </div>
                    )}

                    {aiResult.suggested_tags && aiResult.suggested_tags.length > 0 && (
                      <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}><Tag size={14} /> Suggested Tags</div>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {aiResult.suggested_tags.map((tag, i) => <TagPill key={i} tag={tag} />)}
                        </div>
                      </div>
                    )}
                  </div>
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
              <h2>{editMode ? 'Edit Metadata' : 'Add Metadata'}</h2>
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
                <label className="form-label">Data Type</label>
                <input className="form-input" name="data_type" value={formData.data_type || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" name="description" value={formData.description || ''} onChange={handleChange} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Business Definition</label>
                <textarea className="form-textarea" name="business_definition" value={formData.business_definition || ''} onChange={handleChange} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Technical Owner</label>
                <input className="form-input" name="technical_owner" value={formData.technical_owner || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Business Owner</label>
                <input className="form-input" name="business_owner" value={formData.business_owner || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Updated</label>
                <input className="form-input" name="last_updated" type="datetime-local" value={formData.last_updated || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input className="form-input" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Type tag and press Enter" style={{ flex: 1 }} />
                  <button className="btn btn-sm btn-secondary" type="button" onClick={addTag}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {(formData.tags || []).map((tag, i) => <TagPill key={i} tag={tag} onRemove={removeTag} />)}
                </div>
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

export default MetadataManagement;
