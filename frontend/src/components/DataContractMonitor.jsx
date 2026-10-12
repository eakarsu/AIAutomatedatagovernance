import React, { useEffect, useState } from 'react';

export default function DataContractMonitor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/data-contract-monitor').then((res) => {
      if (!res.ok) throw new Error('Data contracts could not be loaded.');
      return res.json();
    }).then((payload) => {
      if (!Array.isArray(payload.contracts)) throw new Error('Data contract response is invalid.');
      setData(payload);
    }).catch((cause) => setError(cause.message));
  }, []);
  return (
    <div className="content-page">
      <h1>Data Contract Monitor</h1>
      <p>Monitor producer-consumer schema promises, SLA breaks, and downstream blast radius.</p>
      <div className="metrics-grid">
        {data?.summary && Object.entries(data.summary).map(([key, value]) => <div className="metric-card" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></div>)}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="data-card">
        {(Array.isArray(data?.contracts) ? data.contracts : []).map((item) => <div key={item.asset} style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}><strong>{item.asset}</strong><div>{item.producer} to {item.consumer} - {item.breach} - {item.severity}</div></div>)}
      </div>
    </div>
  );
}
