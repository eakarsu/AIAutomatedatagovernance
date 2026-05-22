import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ScrollText, Plus, Save, Trash2 } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const SEVERITIES = ['Low', 'Medium', 'High'];
const ACTIONS = ['mask', 'expire', 'restrict', 'audit', 'classify:sensitive'];

export default function PolicyRulesEditor() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/custom-views/policy-rules`, { headers: headers() });
      setRules(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (i, patch) => {
    setRules(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const remove = (i) => setRules(prev => prev.filter((_, idx) => idx !== i));

  const add = () => setRules(prev => [...prev, {
    id: `PR-${Math.floor(Math.random() * 9000 + 1000)}`,
    name: 'New Rule', domain: 'General', severity: 'Medium',
    action: 'audit', target: '*', enabled: true,
  }]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await axios.put(`${API}/custom-views/policy-rules`,
        { rules },
        { headers: headers() });
      setRules(res.data.data);
      setMessage(`Saved ${res.data.count} rules.`);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card" data-testid="rules-loading">Loading policy rules…</div>;

  return (
    <div className="card" data-testid="policy-rules-editor">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 className="card-title">
            <ScrollText size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Policy Rules Editor
          </h3>
          <p className="card-subtitle">{rules.length} rules · edit inline, then save</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={add}><Plus size={14} /> Add</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>
      <div className="card-body" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>ID</th>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Domain</th>
              <th style={{ padding: 8 }}>Severity</th>
              <th style={{ padding: 8 }}>Action</th>
              <th style={{ padding: 8 }}>Target</th>
              <th style={{ padding: 8 }}>On</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id + i} style={{ borderBottom: '1px solid #e2e8f0' }} data-testid={`rule-row-${i}`}>
                <td style={{ padding: 6, fontFamily: 'monospace' }}>{r.id}</td>
                <td style={{ padding: 6 }}>
                  <input value={r.name} onChange={e => update(i, { name: e.target.value })}
                         style={{ width: '100%', padding: 4 }} />
                </td>
                <td style={{ padding: 6 }}>
                  <input value={r.domain} onChange={e => update(i, { domain: e.target.value })}
                         style={{ width: 110, padding: 4 }} />
                </td>
                <td style={{ padding: 6 }}>
                  <select value={r.severity} onChange={e => update(i, { severity: e.target.value })}>
                    {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  <select value={r.action} onChange={e => update(i, { action: e.target.value })}>
                    {ACTIONS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  <input value={r.target} onChange={e => update(i, { target: e.target.value })}
                         style={{ width: 180, padding: 4, fontFamily: 'monospace' }} />
                </td>
                <td style={{ padding: 6, textAlign: 'center' }}>
                  <input type="checkbox" checked={!!r.enabled}
                         onChange={e => update(i, { enabled: e.target.checked })} />
                </td>
                <td style={{ padding: 6 }}>
                  <button className="btn btn-secondary" onClick={() => remove(i)}
                          title="Delete rule">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {message && <p style={{ marginTop: 10, color: '#10b981' }} data-testid="rules-saved">{message}</p>}
        {error   && <p style={{ marginTop: 10, color: '#ef4444' }}>Error: {error}</p>}
      </div>
    </div>
  );
}
