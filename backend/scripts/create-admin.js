'use strict';

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  if (!['1', 'true'].includes(process.env.ALLOW_SCHEMA_MIGRATION)) throw new Error('Explicit provisioning acknowledgement is required');
  const email = (process.env.PROVISION_ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || password.length < 12) throw new Error('Explicit admin email and 12+ character password are required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, department)
       VALUES ($1, $2, $3, 'admin', $4)
       ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash,
         full_name=EXCLUDED.full_name, role=EXCLUDED.role, department=EXCLUDED.department`,
      [email, await bcrypt.hash(password, 12), 'Runtime Administrator', 'Data Governance'],
    );
    console.log('Administrator provisioned.');
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
