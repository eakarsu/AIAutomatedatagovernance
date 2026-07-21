'use strict';
const transitions = Object.freeze({ discovered: ['classified'], classified: ['lineage_mapped'], lineage_mapped: ['review_pending'], review_pending: ['approved', 'rejected'], rejected: ['classified'], approved: ['fulfilled'], fulfilled: [] });
function validateCase(input) {
  const errors = [];
  if (!input.assetId) errors.push('assetId is required');
  if (!['public', 'internal', 'confidential', 'restricted'].includes(input.classification)) errors.push('classification is invalid');
  if (!Array.isArray(input.lineageEdges) || input.lineageEdges.length === 0) errors.push('at least one lineage edge is required');
  for (const [i, edge] of (input.lineageEdges || []).entries()) {
    if (!edge.source || !edge.target || !edge.observedAt) errors.push(`lineageEdges[${i}] requires source, target, and observedAt`);
  }
  if (!Array.isArray(input.policies) || input.policies.length === 0) errors.push('at least one versioned policy is required');
  for (const [i, policy] of (input.policies || []).entries()) {
    if (!policy.id || !policy.version || !policy.jurisdiction || Number.isNaN(Date.parse(policy.effectiveAt || ''))) errors.push(`policies[${i}] is incomplete`);
  }
  if (input.request?.type === 'delete' && input.legalHold === true) errors.push('deletion is prohibited while a legal hold is active');
  if (input.request && !['access', 'export', 'correct', 'delete'].includes(input.request.type)) errors.push('request.type is invalid');
  return { valid: errors.length === 0, errors };
}
function coverage(input) {
  return { classification: input.classification ? 1 : 0, lineageEdges: (input.lineageEdges || []).length, policyCount: (input.policies || []).length, requestPresent: Boolean(input.request) };
}
function assertTransition(from, to, actor, record) {
  if (!(transitions[from] || []).includes(to)) throw new Error(`transition ${from} -> ${to} is not allowed`);
  if (['approved', 'fulfilled'].includes(to)) {
    if (!['data_steward', 'privacy_officer', 'compliance_officer', 'admin'].includes(actor.role)) throw new Error('governance reviewer role required');
    if (String(actor.id) === String(record.created_by)) throw new Error('requester cannot approve or attest their own case');
  }
  if (to === 'fulfilled' && record.request_type === 'delete' && record.legal_hold) throw new Error('legal hold blocks deletion fulfillment');
}
module.exports = { validateCase, coverage, assertTransition };

