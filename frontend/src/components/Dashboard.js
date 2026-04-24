import React, { useState, useEffect } from 'react';
import {
  Database, Tag, CheckSquare, GitBranch, FileText, Shield, Users,
  ShieldCheck, Key, BookOpen, Activity, Sparkles, BarChart3, TrendingUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  catalogAPI, classificationAPI, qualityAPI, lineageAPI, metadataAPI,
  policiesAPI, stewardshipAPI, complianceAPI, accessControlAPI, glossaryAPI, auditAPI
} from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    catalog: 0, classification: 0, quality: 0, lineage: 0,
    metadata: 0, policies: 0, stewardship: 0, compliance: 0,
    accessControl: 0, glossary: 0, audit: 0
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qualityItems, setQualityItems] = useState([]);
  const [classificationItems, setClassificationItems] = useState([]);

  useEffect(() => {
    fetchAllStats();
  }, []);

  const fetchAllStats = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        catalogAPI.getAll(),
        classificationAPI.getAll(),
        qualityAPI.getAll(),
        lineageAPI.getAll(),
        metadataAPI.getAll(),
        policiesAPI.getAll(),
        stewardshipAPI.getAll(),
        complianceAPI.getAll(),
        accessControlAPI.getAll(),
        glossaryAPI.getAll(),
        auditAPI.getAll()
      ]);

      const getData = (r) => (r.status === 'fulfilled' ? (r.value.data || []) : []);

      const catalogData = getData(results[0]);
      const classData = getData(results[1]);
      const qualData = getData(results[2]);
      const lineData = getData(results[3]);
      const metaData = getData(results[4]);
      const polData = getData(results[5]);
      const stewData = getData(results[6]);
      const compData = getData(results[7]);
      const accData = getData(results[8]);
      const glossData = getData(results[9]);
      const auditData = getData(results[10]);

      setStats({
        catalog: catalogData.length,
        classification: classData.length,
        quality: qualData.length,
        lineage: lineData.length,
        metadata: metaData.length,
        policies: polData.length,
        stewardship: stewData.length,
        compliance: compData.length,
        accessControl: accData.length,
        glossary: glossData.length,
        audit: auditData.length
      });

      setQualityItems(qualData);
      setClassificationItems(classData);

      const sortedLogs = [...auditData].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentLogs(sortedLogs.slice(0, 10));
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const totalAssets = stats.catalog;
  const classificationCoverage = totalAssets > 0
    ? Math.round((stats.classification / totalAssets) * 100)
    : 0;
  const qualityScore = qualityItems.length > 0
    ? Math.round(qualityItems.reduce((sum, q) => sum + (Number(q.current_score) || 0), 0) / qualityItems.length)
    : 0;
  const activePolicies = stats.policies;

  const features = [
    { key: 'catalog', label: 'Data Catalog', icon: <Database size={28} />, count: stats.catalog, desc: 'Manage and explore data assets', color: '#2563eb' },
    { key: 'classification', label: 'Data Classification', icon: <Tag size={28} />, count: stats.classification, desc: 'Classify data sensitivity levels', color: '#7c3aed' },
    { key: 'quality', label: 'Data Quality', icon: <CheckSquare size={28} />, count: stats.quality, desc: 'Monitor data quality rules', color: '#16a34a' },
    { key: 'lineage', label: 'Data Lineage', icon: <GitBranch size={28} />, count: stats.lineage, desc: 'Track data flow and dependencies', color: '#ea580c' },
    { key: 'metadata', label: 'Metadata', icon: <FileText size={28} />, count: stats.metadata, desc: 'Manage metadata attributes', color: '#0d9488' },
    { key: 'policies', label: 'Policies', icon: <Shield size={28} />, count: stats.policies, desc: 'Define governance policies', color: '#dc2626' },
    { key: 'stewardship', label: 'Stewardship', icon: <Users size={28} />, count: stats.stewardship, desc: 'Assign data stewards and tasks', color: '#ca8a04' },
    { key: 'compliance', label: 'Compliance', icon: <ShieldCheck size={28} />, count: stats.compliance, desc: 'Track regulatory compliance', color: '#9333ea' },
    { key: 'access', label: 'Access Control', icon: <Key size={28} />, count: stats.accessControl, desc: 'Manage access permissions', color: '#0284c7' },
    { key: 'glossary', label: 'Glossary', icon: <BookOpen size={28} />, count: stats.glossary, desc: 'Business term definitions', color: '#059669' },
    { key: 'audit', label: 'Audit Logs', icon: <Activity size={28} />, count: stats.audit, desc: 'View system audit trail', color: '#6b7280' },
    { key: 'ai', label: 'AI Insights', icon: <Sparkles size={28} />, count: null, desc: 'AI-powered governance tools', color: '#d946ef' }
  ];

  const chartData = [
    { name: 'Catalog', count: stats.catalog },
    { name: 'Classification', count: stats.classification },
    { name: 'Quality', count: stats.quality },
    { name: 'Lineage', count: stats.lineage },
    { name: 'Metadata', count: stats.metadata },
    { name: 'Policies', count: stats.policies },
    { name: 'Stewardship', count: stats.stewardship },
    { name: 'Compliance', count: stats.compliance },
    { name: 'Access', count: stats.accessControl },
    { name: 'Glossary', count: stats.glossary }
  ];

  const getActionBadge = (action) => {
    const map = {
      CREATE: { background: '#dcfce7', color: '#166534' },
      UPDATE: { background: '#dbeafe', color: '#1e40af' },
      DELETE: { background: '#fee2e2', color: '#991b1b' },
      READ: { background: '#f3f4f6', color: '#374151' },
      LOGIN: { background: '#f3e8ff', color: '#6b21a8' }
    };
    const style = map[action] || { background: '#f3f4f6', color: '#374151' };
    return <span style={{ ...style, padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{action}</span>;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const user = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user'));
      return u?.full_name || u?.name || u?.email || 'User';
    } catch {
      return 'User';
    }
  })();

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Welcome Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user}</h1>
          <p className="page-subtitle">Airline Data Governance Dashboard - Overview of your data governance program</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">{totalAssets}</div>
          <div className="stat-label"><Database size={14} /> Total Data Assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{classificationCoverage}%</div>
          <div className="stat-label"><Tag size={14} /> Classification Coverage</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{qualityScore || 'N/A'}</div>
          <div className="stat-label"><TrendingUp size={14} /> Avg Quality Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activePolicies}</div>
          <div className="stat-label"><Shield size={14} /> Active Policies</div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Governance Modules</h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem'
      }}>
        {features.map(f => (
          <div
            key={f.key}
            onClick={() => onNavigate(f.key)}
            style={{
              border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '1.25rem',
              cursor: 'pointer', transition: 'all 0.2s ease', background: 'var(--bg-secondary)',
              borderTop: `3px solid ${f.color}`
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ color: f.color }}>{f.icon}</div>
              {f.count !== null && (
                <span style={{
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 10px',
                  borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700
                }}>{f.count}</span>
              )}
            </div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{f.label}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        <BarChart3 size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
        Items by Module
      </h2>
      <div style={{
        border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '1.5rem',
        background: 'var(--bg-secondary)', marginBottom: '2rem'
      }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #2d3a4f', background: '#1a2035', color: '#f1f5f9' }}
              labelStyle={{ fontWeight: 700 }}
            />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Audit Logs */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        <Activity size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
        Recent Activity
      </h2>
      <div style={{
        border: '1px solid var(--border-primary)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-secondary)'
      }}>
        <table className="data-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Timestamp</th><th>Action</th><th>Entity</th><th>Performed By</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((log, i) => (
              <tr key={log.id || i}>
                <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatTimestamp(log.created_at)}</td>
                <td>{getActionBadge(log.action)}</td>
                <td>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{log.entity_type}</span>
                  {log.entity_name && <> - <strong>{log.entity_name}</strong></>}
                </td>
                <td>{log.performed_by}</td>
                <td>
                  <span className={`status-badge ${log.status === 'success' ? 'active' : log.status === 'failure' ? 'critical' : ''}`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
            {recentLogs.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent activity</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
