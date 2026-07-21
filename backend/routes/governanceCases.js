'use strict';
const router = require('express').Router(); const { pool } = require('../db');
const { validateCase, coverage, assertTransition } = require('../domain/governanceWorkflow');
const tenantFor = user => String(user.tenant_id || user.organization_id || `legacy-user:${user.id}`);
router.get('/external-capabilities', (req, res) => res.json({ catalog: { configured: false }, warehouse: { configured: false }, iam: { configured: false }, ticketing: { configured: false }, consent: { configured: false }, deletionExport: { configured: false } }));
router.get('/', async (req, res) => { try { const r = await pool.query('SELECT * FROM governance_cases WHERE tenant_id=$1 ORDER BY updated_at DESC', [tenantFor(req.user)]); res.json(r.rows); } catch { res.status(500).json({ error: 'Unable to load cases' }); } });
router.post('/', async (req, res) => {
  const key = req.get('Idempotency-Key'); if (!key) return res.status(400).json({ error: 'Idempotency-Key header is required' });
  const validation = validateCase(req.body || {}); if (!validation.valid) return res.status(422).json(validation);
  const tenant = tenantFor(req.user); let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const prior = await client.query('SELECT * FROM governance_cases WHERE tenant_id=$1 AND idempotency_key=$2', [tenant, key]);
    if (prior.rows[0]) { await client.query('ROLLBACK'); return res.json(prior.rows[0]); }
    const created = await client.query(`INSERT INTO governance_cases (tenant_id,idempotency_key,asset_id,classification,request_type,legal_hold,payload,coverage,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [tenant,key,req.body.assetId,req.body.classification,req.body.request?.type || null,Boolean(req.body.legalHold),req.body,coverage(req.body),String(req.user.id)]);
    await client.query(`INSERT INTO governance_case_events(tenant_id,case_id,actor_id,event_type,to_status,event_data) VALUES($1,$2,$3,'created','discovered',$4)`, [tenant,created.rows[0].id,String(req.user.id),coverage(req.body)]);
    await client.query('COMMIT'); res.status(201).json(created.rows[0]);
  } catch { if (client) await client.query('ROLLBACK'); res.status(500).json({ error: 'Unable to create governance case' }); } finally { if (client) client.release(); }
});
router.post('/:id/transition', async (req, res) => {
  const { toStatus, expectedVersion, rationale, fulfillmentEvidence } = req.body || {};
  if (!Number.isInteger(expectedVersion) || !rationale) return res.status(400).json({ error: 'expectedVersion and rationale are required' });
  if (toStatus === 'fulfilled' && (!fulfillmentEvidence?.operationId || !fulfillmentEvidence?.completedAt)) return res.status(422).json({ error: 'fulfillmentEvidence.operationId and completedAt are required' });
  const tenant=tenantFor(req.user); let client;
  try {
    client=await pool.connect();
    await client.query('BEGIN'); const found=await client.query('SELECT * FROM governance_cases WHERE id=$1 AND tenant_id=$2 FOR UPDATE',[req.params.id,tenant]); const current=found.rows[0];
    if(!current){await client.query('ROLLBACK');return res.status(404).json({error:'Case not found'});} assertTransition(current.status,toStatus,req.user,current);
    if(current.version!==expectedVersion){await client.query('ROLLBACK');return res.status(409).json({error:'Version conflict',currentVersion:current.version});}
    const updated=await client.query(`UPDATE governance_cases SET status=$1,version=version+1,updated_at=NOW(),approved_by=CASE WHEN $1='approved' THEN $2 ELSE approved_by END WHERE id=$3 AND tenant_id=$4 AND version=$5 RETURNING *`,[toStatus,String(req.user.id),current.id,tenant,expectedVersion]);
    await client.query(`INSERT INTO governance_case_events(tenant_id,case_id,actor_id,event_type,from_status,to_status,event_data) VALUES($1,$2,$3,'transition',$4,$5,$6)`,[tenant,current.id,String(req.user.id),current.status,toStatus,{rationale,fulfillmentEvidence}]);
    await client.query('COMMIT');res.json(updated.rows[0]);
  } catch(error){if(client)await client.query('ROLLBACK');const bad=/not allowed|role required|own case|legal hold/.test(error.message);res.status(bad?422:500).json({error:bad?error.message:'Unable to transition case'});}finally{if(client)client.release();}
});
router.get('/:id/history', async(req,res)=>{try{const r=await pool.query('SELECT * FROM governance_case_events WHERE case_id=$1 AND tenant_id=$2 ORDER BY occurred_at,id',[req.params.id,tenantFor(req.user)]);res.json(r.rows);}catch{res.status(500).json({error:'Unable to load history'});}});
module.exports=router;
