import { createClient } from '@supabase/supabase-js';

// Стари Supabase credentials
const OLD_SUPABASE_URL = 'https://wicufyfrkaigjhirdgeu.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpY3VmeWZya2FpZ2poaXJkZ2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODMzMjcsImV4cCI6MjA4NTQ1OTMyN30.lqKJho15EnaohIhEtAq2TeISYhHHQvX-LdV9d9SETAc';

// Нови Supabase credentials
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

const TABLES = [
  'menu_items',
  'restaurant_tables',
  'cart_items',
  'table_requests',
  'customer_ratings',
  'daily_menu_assignments',
  'completed_orders',
  'table_history_archive'
];

async function verifyMigration() {
  console.log('🔍 Verifying Migration Status');
  console.log(`📤 Source (OLD): ${OLD_SUPABASE_URL}`);
  console.log(`📥 Destination (NEW): ${NEW_SUPABASE_URL}\n`);

  const results: Array<{table: string; oldCount: number; newCount: number; status: string}> = [];

  for (const table of TABLES) {
    const { count: oldCount } = await oldSupabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    const { count: newCount } = await newSupabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    const old = oldCount || 0;
    const new_ = newCount || 0;
    const status = old === new_ ? '✅' : old > new_ ? '⚠️' : '❓';

    results.push({ table, oldCount: old, newCount: new_, status });
  }

  console.log('='.repeat(70));
  console.log('📊 Migration Verification:');
  console.log('='.repeat(70));
  console.log(`${'Table'.padEnd(30)} | ${'OLD'.padStart(6)} | ${'NEW'.padStart(6)} | Status`);
  console.log('-'.repeat(70));

  let totalOld = 0;
  let totalNew = 0;

  results.forEach(r => {
    totalOld += r.oldCount;
    totalNew += r.newCount;
    console.log(`${r.table.padEnd(30)} | ${r.oldCount.toString().padStart(6)} | ${r.newCount.toString().padStart(6)} | ${r.status}`);
  });

  console.log('-'.repeat(70));
  console.log(`${'TOTAL'.padEnd(30)} | ${totalOld.toString().padStart(6)} | ${totalNew.toString().padStart(6)} | ${totalOld === totalNew ? '✅' : '⚠️'}`);
  console.log('='.repeat(70));

  if (totalOld === totalNew) {
    console.log('\n✅ Migration verified: All data successfully migrated!');
  } else {
    console.log(`\n⚠️  Migration incomplete: ${totalOld - totalNew} rows missing`);
  }
}

verifyMigration().catch(error => {
  console.error('💥 Error:', error);
  process.exit(1);
});
