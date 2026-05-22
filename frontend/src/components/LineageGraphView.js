import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { GitBranch, RefreshCcw } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const TYPE_COLOR = {
  source:   '#3b82f6',
  staging:  '#a855f7',
  mart:     '#10b981',
  consumer: '#f59e0b',
};

export default function LineageGraphView() {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/custom-views/lineage-graph`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGraph(res.data.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="card" data-testid="lineage-loading">Loading lineage graph…</div>;
  if (error)   return <div className="card" style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!graph)  return null;

  const W = 820, H = 420;
  const nodeById = Object.fromEntries(graph.nodes.map(n => [n.id, n]));

  return (
    <div className="card" data-testid="lineage-graph">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 className="card-title"><GitBranch size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Data Lineage Graph</h3>
          <p className="card-subtitle">
            {graph.summary.assets} assets · {graph.summary.pipelines} pipelines · avg quality {Math.round(graph.summary.avg_quality * 100)}%
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>
      <div className="card-body" style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ background: '#0f172a', borderRadius: 8 }}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" />
            </marker>
          </defs>
          {graph.edges.map((e, i) => {
            const a = nodeById[e.from], b = nodeById[e.to];
            if (!a || !b) return null;
            const stroke = e.quality > 0.95 ? '#10b981' : e.quality > 0.9 ? '#facc15' : '#ef4444';
            return (
              <g key={i}>
                <line x1={a.x + 70} y1={a.y + 20} x2={b.x - 5} y2={b.y + 20}
                      stroke={stroke} strokeWidth="2" markerEnd="url(#arrow)" opacity="0.8" />
                <text x={(a.x + b.x) / 2 + 30} y={(a.y + b.y) / 2 + 14}
                      fill="#cbd5e1" fontSize="10">{e.label}</text>
              </g>
            );
          })}
          {graph.nodes.map(n => (
            <g key={n.id} onClick={() => setSelected(n)} style={{ cursor: 'pointer' }}>
              <rect x={n.x} y={n.y} width="140" height="40" rx="6"
                    fill={TYPE_COLOR[n.type] || '#64748b'}
                    stroke={selected?.id === n.id ? '#fff' : 'transparent'}
                    strokeWidth="2" />
              <text x={n.x + 70} y={n.y + 18} fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">
                {n.label}
              </text>
              <text x={n.x + 70} y={n.y + 32} fill="#e2e8f0" fontSize="9" textAnchor="middle">
                {n.type} · {n.domain}
              </text>
            </g>
          ))}
        </svg>
        {selected && (
          <div style={{ marginTop: 12, padding: 10, background: '#1e293b', color: '#e2e8f0', borderRadius: 6 }} data-testid="lineage-selected">
            <strong>{selected.label}</strong> — type: {selected.type}, domain: {selected.domain}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_COLOR).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, background: v, borderRadius: 3, display: 'inline-block' }} />
              {k}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
