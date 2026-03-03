import { createClient } from '@supabase/supabase-js';

// Нови Supabase credentials
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies in new project...');
  
  // Използвай RPC за изпълнение на SQL
  // За съжаление, Supabase JS client не поддържа direct SQL execution
  // Трябва да се използва Supabase Dashboard или CLI
  
  console.log('\n⚠️  Please run this SQL in the NEW Supabase project:');
  console.log('   Go to: https://zqnyugoudabtqieuqhrp.supabase.co');
  console.log('   SQL Editor → New Query → Paste this:\n');
  
  console.log(`
-- Fix RLS policies to allow INSERT operations

-- Restaurant Tables - Add INSERT policy
DROP POLICY IF EXISTS "Allow public insert to restaurant_tables" ON restaurant_tables;
CREATE POLICY "Allow public insert to restaurant_tables"
  ON restaurant_tables FOR INSERT
  WITH CHECK (true);

-- Table History Archive - Add INSERT policy  
DROP POLICY IF EXISTS "Allow public insert to table_history_archive" ON table_history_archive;
CREATE POLICY "Allow public insert to table_history_archive"
  ON table_history_archive FOR INSERT
  WITH CHECK (true);
  `);
  
  console.log('\n✅ After running the SQL, run: npm run migrate:mcp\n');
}

fixRLSPolicies().catch(error => {
  console.error('💥 Error:', error);
  process.exit(1);
});
