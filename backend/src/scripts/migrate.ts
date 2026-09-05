/**
 * LedgerLens Database Migration Runner
 *
 * Applies schema.sql and optionally seed.sql to the Supabase database.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate.ts           # schema only
 *   npx ts-node src/scripts/migrate.ts --seed    # schema + seed data
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[migrate] ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSql(label: string, sqlPath: string): Promise<void> {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../..', sqlPath), 'utf-8');

  console.log(`[migrate] Running ${label} from ${sqlPath}...`);

  // Execute via Supabase's raw SQL execution (requires service role)
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // Supabase doesn't expose a direct SQL endpoint in JS SDK —
    // guide user to run SQL via dashboard or psql
    console.error(`[migrate] ⚠️  Cannot auto-execute SQL via JS SDK.`);
    console.error(`[migrate] Please run the following SQL manually in your Supabase dashboard:`);
    console.error(`[migrate] Dashboard → SQL Editor → New Query → paste contents of: ${sqlPath}`);
    console.error(`[migrate] Error detail: ${error.message}`);
    return;
  }

  console.log(`[migrate] ✓ ${label} applied successfully.`);
}

async function main(): Promise<void> {
  console.log('[migrate] LedgerLens Database Migration');
  console.log(`[migrate] Target: ${SUPABASE_URL}`);
  console.log('');

  const applySchema = true;
  const applySeed = process.argv.includes('--seed');

  if (applySchema) {
    await runSql('Schema', 'database/schema.sql');
  }

  if (applySeed) {
    await runSql('Seed Data', 'database/seed.sql');
  }

  console.log('');
  console.log('[migrate] ✓ Migration complete.');
  console.log('[migrate] If SQL could not be auto-executed, use the Supabase SQL Editor:');
  console.log('[migrate]   https://supabase.com/dashboard/project/_/sql/new');
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
