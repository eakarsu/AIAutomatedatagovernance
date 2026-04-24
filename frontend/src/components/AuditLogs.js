import React, { useState, useEffect } from 'react';
import { Search, X, FileText, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';
import { toast } from 'react-toastify';
import { auditAPI } from '../services/api';

const AuditLogs = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.getAll();
      const data = res.data || [];
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setItems(data);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter(item => {
    const matchesSearch = [item.action, item.entity_type, item.entity_name, item.performed_by, item.status, item.ip_address]
      .some(field => (field || '').toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesDate = true;
    if (dateFrom) {
      matchesDate = matchesDate && new Date(item.created_at) >= new Date(dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(item.created_at) <= toDate;
    }

    return matchesSearch && matchesDate;
  });

  const today = new Date().toISOString().split('T')[0];
  const stats = {
    total: items.length,
    success: items.filter(i => i.status === 'success').length,
    failure: items.filter(i => i.status === 'failure').length,
    today: items.filter(i => {
      if (!i.created_at) return false;
      return i.created_at.split('T')[0] === today;
    }).length
  };

  const getActionBadge = (action) => {
    const map = {
      CREATE: { background: '#dcfce7', color: '#166534' },
      UPDATE: { background: '#dbeafe', color: '#1e40af' },
      DELETE: { background: '#fee2e2', color: '#991b1b' },
      READ: { background: '#f3f4f6', color: '#374151' },
      LOGIN: { background: '#f3e8ff', color: '#6b21a8' }
    };
    const style = map[action] || { background: '#f3f4f6', color: '#374151' };
    return (
      <span style={{ ...style, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
        {action}
      </span>
    );
  };

  const getStatusClass = (status) => {
    const map = { success: 'active', failure: 'critical', error: 'critical', pending: 'warning' };
    return map[status] || '';
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">View system activity and audit trail (read-only)</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label"><FileText size={14} /> Total Logs</div></div>
        <div className="stat-card"><div className="stat-value">{stats.success}</div><div className="stat-label"><CheckCircle size={14} /> Success</div></div>
        <div className="stat-card"><div className="stat-value">{stats.failure}</div><div className="stat-label"><XCircle size={14} /> Failure</div></div>
        <div className="stat-card"><div className="stat-value">{stats.today}</div><div className="stat-label"><Clock size={14} /> Today</div></div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={16} />
          <input className="search-input" placeholder="Search actions, entities, users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>From:</label>
          <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '160px', padding: '6px 10px' }} />
          <label style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>To:</label>
          <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '160px', padding: '6px 10px' }} />
          {(dateFrom || dateTo) && (
            <button className="btn btn-sm btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th><th>Action</th><th>Entity Type</th><th>Entity Name</th><th>Performed By</th><th>Status</th><th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatTimestamp(item.created_at)}</td>
                <td>{getActionBadge(item.action)}</td>
                <td>{item.entity_type}</td>
                <td><strong>{item.entity_name || 'N/A'}</strong></td>
                <td>{item.performed_by}</td>
                <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status}</span></td>
                <td style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.ip_address || 'N/A'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No audit logs found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Detail Panel - Read Only */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h2><Activity size={20} /> Audit Log Detail</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedItem(null)}><X size={14} /></button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-row"><span className="detail-label">Timestamp</span><span className="detail-value">{formatTimestamp(selectedItem.created_at)}</span></div>
              <div className="detail-row"><span className="detail-label">Action</span><span className="detail-value">{getActionBadge(selectedItem.action)}</span></div>
              <div className="detail-row"><span className="detail-label">Entity Type</span><span className="detail-value">{selectedItem.entity_type}</span></div>
              <div className="detail-row"><span className="detail-label">Entity ID</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{selectedItem.entity_id || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Entity Name</span><span className="detail-value">{selectedItem.entity_name || 'N/A'}</span></div>
              <div className="detail-row"><span className="detail-label">Performed By</span><span className="detail-value">{selectedItem.performed_by}</span></div>
              <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-badge ${getStatusClass(selectedItem.status)}`}>{selectedItem.status}</span></span></div>
              <div className="detail-row"><span className="detail-label">IP Address</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{selectedItem.ip_address || 'N/A'}</span></div>
              <div className="detail-row">
                <span className="detail-label">Details</span>
                <span className="detail-value">
                  {selectedItem.details ? (
                    <div style={{
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '6px',
                      padding: '12px', fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'monospace'
                    }}>
                      {typeof selectedItem.details === 'object' ? JSON.stringify(selectedItem.details, null, 2) : selectedItem.details}
                    </div>
                  ) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
