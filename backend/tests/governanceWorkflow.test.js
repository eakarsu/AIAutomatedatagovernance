'use strict'; const test=require('node:test');const assert=require('node:assert/strict');const {validateCase,coverage,assertTransition}=require('../domain/governanceWorkflow');
const input={assetId:'warehouse.customer',classification:'restricted',lineageEdges:[{source:'crm.customer',target:'warehouse.customer',observedAt:'2026-07-18T00:00:00Z'}],policies:[{id:'GDPR-17',version:'4',jurisdiction:'EU',effectiveAt:'2026-01-01'}],request:{type:'export'},legalHold:false};
test('accepts governed lineage and versioned policy',()=>assert.equal(validateCase(input).valid,true));
test('legal hold blocks delete request',()=>assert.equal(validateCase({...input,request:{type:'delete'},legalHold:true}).valid,false));
test('reports deterministic coverage',()=>assert.deepEqual(coverage(input),{classification:1,lineageEdges:1,policyCount:1,requestPresent:true}));
test('requester cannot self-attest fulfillment',()=>assert.throws(()=>assertTransition('approved','fulfilled',{id:1,role:'privacy_officer'},{created_by:1,request_type:'export'}),/own case/));

