import React, { useState } from 'react';
import axios from 'axios';
import { FileText, Download } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function AuditPdfView() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [lastSize, setLastSize] = useState(null);

  const fetchPdf = async (download = false) => {
    setStatus('loading');
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/custom-views/audit-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      setLastSize(blob.size);
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'skygov-audit.pdf';
        a.click();
      } else {
        window.open(url, '_blank');
      }
      setStatus('done');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setStatus('error');
    }
  };

  return (
    <div className="card" data-testid="audit-pdf">
      <div className="card-header">
        <h3 className="card-title">
          <FileText size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Governance Audit Document
        </h3>
        <p className="card-subtitle">Synthesize a printable, auditor-ready PDF summary.</p>
      </div>
      <div className="card-body">
        <ul style={{ marginBottom: 14, lineHeight: 1.7, color: '#334155' }}>
          <li>Scope: 6 domains across the last 30 days</li>
          <li>Includes findings, scoring, and remediation recommendations</li>
          <li>Signed by SkyGov Governance Office</li>
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => fetchPdf(false)} disabled={status === 'loading'}>
            {status === 'loading' ? 'Generating…' : 'Open PDF'}
          </button>
          <button className="btn btn-secondary" onClick={() => fetchPdf(true)} disabled={status === 'loading'}>
            <Download size={14} /> Download
          </button>
        </div>
        {status === 'done' && (
          <p style={{ marginTop: 12, color: '#10b981', fontSize: 13 }} data-testid="pdf-status">
            PDF ready ({lastSize} bytes).
          </p>
        )}
        {error && (
          <p style={{ marginTop: 12, color: '#ef4444', fontSize: 13 }}>Error: {error}</p>
        )}
      </div>
    </div>
  );
}
