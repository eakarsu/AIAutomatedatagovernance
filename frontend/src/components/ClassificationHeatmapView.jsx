import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, RefreshCcw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function ClassificationHeatmapView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/custom-views/classification-heatmap`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="card" data-testid="heatmap-loading">Loading heatmap…</div>;
  if (error)   return <div className="card" style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!data)   return null;

  const colorFor = (count) => {
    const t = Math.min(1, count / data.max);
    const r = Math.round(15 + t * 220);
    const g = Math.round(40 + (1 - t) * 100);
    const b = Math.round(80 + (1 - t) * 120);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="card" data-testid="classification-heatmap">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 className="card-title">
            <Shield size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Classification Heatmap (Domain × Sensitivity)
          </h3>
          <p className="card-subtitle">
            {data.totals.assets} classified assets · {data.totals.pii_assets} contain PII
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>
      <div className="card-body" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: 6, textAlign: 'left' }}>Domain</th>
              {data.levels.map(l => (
                <th key={l} style={{ padding: 6, textAlign: 'center', minWidth: 90 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map(row => (
              <tr key={row.domain}>
                <td style={{ padding: 6, fontWeight: 600 }}>{row.domain}</td>
                {row.cells.map(cell => (
                  <td key={cell.level}
                      title={`${row.domain} · ${cell.level}: ${cell.count}`}
                      style={{
                        padding: 14,
                        background: colorFor(cell.count),
                        color: '#fff',
                        textAlign: 'center',
                        borderRadius: 6,
                        fontWeight: 600,
                        minWidth: 70,
                      }}
                      data-testid={`cell-${row.domain}-${cell.level}`}
                  >
                    {cell.count}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Low</span>
          <div style={{ width: 200, height: 12,
            background: 'linear-gradient(to right, rgb(15,140,200), rgb(235,40,80))', borderRadius: 6 }} />
          <span>High (max {data.max})</span>
        </div>
      </div>
    </div>
  );
}
