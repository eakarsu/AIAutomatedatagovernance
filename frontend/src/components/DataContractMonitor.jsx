import React, { useEffect, useState } from 'react';

export default function DataContractMonitor() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/data-contract-monitor').then((res) => res.json()).then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="content-page">
      <h1>Data Contract Monitor</h1>
      <p>Monitor producer-consumer schema promises, SLA breaks, and downstream blast radius.</p>
      <div className="metrics-grid">
        {data && Object.entries(data.summary).map(([key, value]) => <div className="metric-card" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></div>)}
      </div>
      <div className="data-card">
        {(data?.contracts || []).map((item) => <div key={item.asset} style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}><strong>{item.asset}</strong><div>{item.producer} to {item.consumer} - {item.breach} - {item.severity}</div></div>)}
      </div>
    </div>
  );
}
