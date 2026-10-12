import React, { useState } from 'react';
import { aiAPI } from '../services/api';
import FormattedAIReport from './FormattedAIReport';

export default function AIHistory() {
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const { data } = await aiAPI.history({ limit: 25 });
      setRows(Array.isArray(data.data) ? data.data : Array.isArray(data.history) ? data.history : []);
      setError('');
    } catch (_) { setError('Saved AI results could not be loaded.'); }
  };
  return <section aria-label="Saved AI results" style={{ marginTop: 24 }}>
    <h2>Saved AI results</h2>
    <button type="button" onClick={load}>Load saved results</button>
    {error && <p role="alert">{error}</p>}
    {rows && <div>{rows.length === 0 ? <p>No saved results.</p> : <ul>{rows.map(row => <li key={row.id}><button type="button" onClick={() => setSelected(row)}>{row.endpoint || row.feature} · {new Date(row.created_at || row.createdAt).toLocaleString()}</button></li>)}</ul>}</div>}
    {selected && <FormattedAIReport title={`Saved ${selected.endpoint || selected.feature} report`} response={selected.result_data ?? selected.output} model={selected.model_used ?? selected.model} tokens={selected.tokens_used} />}
  </section>;
}
