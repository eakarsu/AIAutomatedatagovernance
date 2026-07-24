import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit2, Trash2, BookOpen, Tag, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { glossaryAPI, aiAPI } from '../services/api';

const DataGlossary = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [synonymInput, setSynonymInput] = useState('');
  const [relatedTermInput, setRelatedTermInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const emptyForm = {
    term: '', definition: '', category: '', synonyms: [], related_terms: [],
    domain: '', owner: '', status: 'pending'
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await glossaryAPI.getAll();
      setItems(res.data || []);
    } catch (err) {
      toast.error('Failed to load glossary data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ ...emptyForm });
    setSynonymInput('');
    setRelatedTermInput('');
    setEditMode(false);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({
      ...item,
      synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
      related_terms: Array.isArray(item.related_terms) ? item.related_terms : []
    });
    setSynonymInput('');
    setRelatedTermInput('');
    setEditMode(true);
    setShowForm(true);
    setSelectedItem(null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete term "${item.term}"? This action cannot be undone.`)) return;
    try {
      await glossaryAPI.delete(item.id);
      toast.success(`"${item.term}" deleted successfully`);
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete term');
    }
  };

  const handleSave = async () => {
    if (!formData.term || !formData.definition) {
      toast.warning('Please fill in term and definition');
      return;
    }
    try {
      if (editMode) {
        await glossaryAPI.update(formData.id, formData);
        toast.success(`"${formData.term}" updated successfully`);
      } else {
        await glossaryAPI.create(formData);
        toast.success(`"${formData.term}" created successfully`);
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      toast.error(editMode ? 'Failed to update term' : 'Failed to create term');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSynonym = (e) => {
    if (e.key === 'Enter' && synonymInput.trim()) {
      e.preventDefault();
      const current = Array.isArray(formData.synonyms) ? formData.synonyms : [];
      if (!current.includes(synonymInput.trim())) {
        setFormData(prev => ({ ...prev, synonyms: [...current, synonymInput.trim()] }));
      }
      setSynonymInput('');
    }
  };

  const handleRemoveSynonym = (index) => {
    setFormData(prev => ({
      ...prev,
      synonyms: prev.synonyms.filter((_, i) => i !== index)
    }));
  };

  const handleAddRelatedTerm = (e) => {
    if (e.key === 'Enter' && relatedTermInput.trim()) {
      e.preventDefault();
      const current = Array.isArray(formData.related_terms) ? formData.related_terms : [];
      if (!current.includes(relatedTermInput.trim())) {
        setFormData(prev => ({ ...prev, related_terms: [...current, relatedTermInput.trim()] }));
      }
      setRelatedTermInput('');
    }
  };

  const handleRemoveRelatedTerm = (index) => {
    setFormData(prev => ({
      ...prev,
      related_terms: prev.related_terms.filter((_, i) => i !== index)
    }));
  };

  const handleAIGenerate = async () => {
    if (!selectedItem) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiAPI.generateDescription({
        table_name: selectedItem.domain || 'glossary',
        column_name: selectedItem.term,
        data_type: 'string',
        sample_values: selectedItem.definition
      });
      setAiResult(res.data);
      toast.success('AI description generated successfully');
    } catch (err) {
      toast.error('Failed to generate AI description');
    } finally {
      setAiLoading(false);
    }
  };

  const filtered = items.filter(item =>
    [item.term, item.definition, item.category, item.domain, item.owner, item.status]
      .some(field => (field || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: items.length,
    approved: items.filter(i => i.status === 'approved').length,
    pending: items.filter(i => i.status === 'pending').length,
    categories: new Set(items.map(i => i.category).filter(Boolean)).size
  };

  const getStatusClass = (status) => {
    const map = { approved: 'active', pending: 'warning', draft: 'inactive', deprecated: 'critical' };
    return map[status] || '';
  };

  const truncate = (str, len = 60) => {
    if (!str) return 'N/A';
    return str.length > len ? str.substring(0, len) + '...' : str;
  };

  const renderPills = (arr) => {
    const items = Array.isArray(arr) ? arr : [];
    if (items.length === 0) return <span style={{ color: 'var(--text-muted)' }}>None</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {items.map((item, i) => (
          <span key={i} style={{
            background: '#e0e7ff', color: '#3730a3', padding: '2px 10px',
            borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500
          }}>{item}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Glossary</h1>
          <p className="page-subtitle">Define and manage business data terminology</p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add New</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><BookOpen size={14} /> Total Terms</div></div>
        <div className="stat-card"><div className="stat-value">{stats.approved}</div><div className="stat-label"><CheckCircle size={14} /> Approved</div></div>
        <div className="stat-card"><div className="stat-value">{stats.pending}</div><div className="stat-label"><Clock size={14} /> Pending</div></div>
        <div className="stat-card"><div className="stat-value">{stats.categories}</div><div className="stat-label"><Tag size={14} /> Categories</div></div>
      </div>

      <div className="search-bar">
        <Search size={16} />
        <input className="search-input" placeholder="Search terms, definitions, categories..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Term</th><th>Definition</th><th>Category</th><th>Domain</th><th>Owner</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => { setSelectedItem(item); setAiResult(null); }} style={{ cursor: 'pointer' }}>
                <td><strong>{item.term}</strong></td>
                <td>{truncate(item.definition)}</td>
                <td>{item.category || 'N/A'}</td>
                <td>{item.domain || 'N/A'}</td>
                <td>{item.owner || 'N/A'}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No terms found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2>{selectedItem.term}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-primary" onClick={() => handleEdit(selectedItem)}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItem)}><Trash2 size={14} /> Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Term</span><span className="detail-value">{selectedItem.term}</span></div>
              <div className="detail-row"><span className="detail-label">Definition</span><span className="detail-value">{selectedItem.definition}</span></div>
              <div className="detail-row"><span className="detail-label">Category</span><span className="detail-value">{selectedItem.category || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Domain</span><span className="detail-value">{selectedItem.domain || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Owner</span><span className="detail-value">{selectedItem.owner || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></span></div>
              <div className="detail-row"><span className="detail-label">Synonyms</span><span className="detail-value">{renderPills(selectedItem.synonyms)}</span></div>
              <div className="detail-row"><span className="detail-label">Related Terms</span><span className="detail-value">{renderPills(selectedItem.related_terms)}</span></div>

              {/* AI Generate Description */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-primary)', paddingTop: '1rem' }}>
                <button className="btn btn-primary" onClick={handleAIGenerate} disabled={aiLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> {aiLoading ? 'Generating...' : 'AI Generate Description'}
                </button>
                {aiLoading && <div className="loading-spinner" style={{ marginTop: '1rem' }}>Generating AI description...</div>}
                {aiResult && (
                  <div className="ai-output" style={{ marginTop: '1rem' }}>
                    <div className="ai-output-card">
                      <div className="ai-output-header">AI Generated Description</div>
                      <div className="ai-output-body">
                        {aiResult.description && (
                          <div className="ai-output-section">
                            <div className="ai-section-title">Description</div>
                            <p>{aiResult.description}</p>
                          </div>
                        )}
                        {aiResult.business_definition && (
                          <div className="ai-output-section">
                            <div className="ai-section-title">Business Definition</div>
                            <p>{aiResult.business_definition}</p>
                          </div>
                        )}
                        {aiResult.suggested_tags && (
                          <div className="ai-output-section">
                            <div className="ai-section-title">Suggested Tags</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(Array.isArray(aiResult.suggested_tags) ? aiResult.suggested_tags : []).map((tag, i) => (
                                <span key={i} style={{
                                  background: '#dbeafe', color: '#1e40af', padding: '2px 10px',
                                  borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500
                                }}>{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Term' : 'Add New Term'}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Term *</label>
                <input className="form-input" name="term" value={formData.term || ''} onChange={handleChange} placeholder="e.g. Passenger Name Record" />
              </div>
              <div className="form-group">
                <label className="form-label">Definition *</label>
                <textarea className="form-textarea" name="definition" value={formData.definition || ''} onChange={handleChange} rows={3} placeholder="Define this term..." />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-input" name="category" value={formData.category || ''} onChange={handleChange} placeholder="e.g. Operations, Finance, Customer" />
              </div>
              <div className="form-group">
                <label className="form-label">Domain</label>
                <input className="form-input" name="domain" value={formData.domain || ''} onChange={handleChange} placeholder="e.g. Flight Operations" />
              </div>
              <div className="form-group">
                <label className="form-label">Owner</label>
                <input className="form-input" name="owner" value={formData.owner || ''} onChange={handleChange} placeholder="e.g. Data Governance Team" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" name="status" value={formData.status || 'pending'} onChange={handleChange}>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="draft">Draft</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Synonyms (press Enter to add)</label>
                <input
                  className="form-input"
                  value={synonymInput}
                  onChange={e => setSynonymInput(e.target.value)}
                  onKeyDown={handleAddSynonym}
                  placeholder="Type a synonym and press Enter..."
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {(formData.synonyms || []).map((syn, i) => (
                    <span key={i} style={{
                      background: '#e0e7ff', color: '#3730a3', padding: '2px 8px',
                      borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500,
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      {syn}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveSynonym(i)} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Related Terms (press Enter to add)</label>
                <input
                  className="form-input"
                  value={relatedTermInput}
                  onChange={e => setRelatedTermInput(e.target.value)}
                  onKeyDown={handleAddRelatedTerm}
                  placeholder="Type a related term and press Enter..."
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {(formData.related_terms || []).map((rt, i) => (
                    <span key={i} style={{
                      background: '#fef3c7', color: '#92400e', padding: '2px 8px',
                      borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500,
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      {rt}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveRelatedTerm(i)} />
                    </span>
                  ))}
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

export default DataGlossary;
