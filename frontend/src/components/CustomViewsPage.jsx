import React from 'react';
import { Layers } from 'lucide-react';
import LineageGraphView from './LineageGraphView';
import ClassificationHeatmapView from './ClassificationHeatmapView';
import AuditPdfView from './AuditPdfView';
import PolicyRulesEditor from './PolicyRulesEditor';

export default function CustomViewsPage() {
  return (
    <div className="custom-views-page" data-testid="custom-views-page" style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <Layers size={26} /> Governance Views
        </h1>
        <p style={{ color: '#64748b', marginTop: 6 }}>
          Custom synthesized views for automated data governance — lineage, classification, audit, and policy rules.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <LineageGraphView />
        <ClassificationHeatmapView />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          <AuditPdfView />
          <PolicyRulesEditor />
        </div>
      </div>
    </div>
  );
}
