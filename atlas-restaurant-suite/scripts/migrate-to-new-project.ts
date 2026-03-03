import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Стари Supabase credentials (от MCP - текущ проект)
const OLD_SUPABASE_URL = 'https://wicufyfrkaigjhirdgeu.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpY3VmeWZya2FpZ2poaXJkZ2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODMzMjcsImV4cCI6MjA4NTQ1OTMyN30.lqKJho15EnaohIhEtAq2TeISYhHHQvX-LdV9d9SETAc';

// Нови Supabase credentials
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function setupSchema() {
  console.log('📋 Setting up schema in new project...');
  
  // Прочети SQL файла
  const sqlPath = path.join(__dirname, 'setup-new-supabase.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // Използвай REST API за изпълнение на SQL
  // За съжаление, Supabase JS client не поддържа direct SQL execution
  // Трябва да се използва Supabase Dashboard или CLI
  console.log('⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
  console.log('   Please run scripts/setup-new-supabase.sql manually in the NEW Supabase project:');
  console.log('   1. Go to: https://zqnyugoudabtqieuqhrp.supabase.co');
  console.log('   2. SQL Editor → New Query');
  console.log('   3. Paste the entire SQL file');
  console.log('   4. Click Run');
  console.log('   5. Then run this script again: npm run migrate:mcp\n');
}

async function migrateTable(tableName: string) {
  console.log(`\n📦 Migrating ${tableName}...`);

  // Експорт от стария проект
  const { data: oldData, error: exportError } = await oldSupabase
    .from(tableName)
    .select('*');

  if (exportError) {
    console.error(`❌ Error exporting ${tableName}:`, exportError);
    return { exported: 0, imported: 0 };
  }

  if (!oldData || oldData.length === 0) {
    console.log(`⚠️  No data found in ${tableName}, skipping...`);
    return { exported: 0, imported: 0 };
  }

  console.log(`✅ Exported ${oldData.length} rows from ${tableName}`);

  // Импорт в новия проект
  const batchSize = 100;
  let imported = 0;

  for (let i = 0; i < oldData.length; i += batchSize) {
    const batch = oldData.slice(i, i + batchSize);
    
    // Премахни полета които може да не съществуват в новата схема
    const cleanedBatch = batch.map((row: any) => {
      const cleaned: any = { ...row };
      // Премахни completed_at ако съществува (за completed_orders)
      if (tableName === 'completed_orders' && cleaned.completed_at) {
        delete cleaned.completed_at;
      }
      // Конвертирай timer_started_at и timer_paused_at от BIGINT към TIMESTAMPTZ ако е необходимо
      if (tableName === 'table_requests') {
        if (cleaned.timer_started_at && typeof cleaned.timer_started_at === 'number') {
          cleaned.timer_started_at = new Date(cleaned.timer_started_at).toISOString();
        }
        if (cleaned.timer_paused_at && typeof cleaned.timer_paused_at === 'number') {
          cleaned.timer_paused_at = new Date(cleaned.timer_paused_at).toISOString();
        }
      }
      return cleaned;
    });

    const { error: batchError } = await newSupabase
      .from(tableName)
      .upsert(cleanedBatch, { onConflict: 'id', ignoreDuplicates: false });

    if (batchError) {
      // Ако upsert не работи, опитай с insert
      const { error: insertError } = await newSupabase
        .from(tableName)
        .insert(cleanedBatch);

      if (insertError) {
        console.error(`❌ Error importing batch ${i}-${i + batchSize}:`, insertError.message);
        throw insertError;
      } else {
        imported += batch.length;
      }
    } else {
      imported += batch.length;
    }
  }

  console.log(`✅ Imported ${imported} rows to ${tableName}`);
  return { exported: oldData.length, imported };
}

async function migrateAll() {
  console.log('🚀 Starting Supabase migration...');
  console.log(`📤 Source: ${OLD_SUPABASE_URL}`);
  console.log(`📥 Destination: ${NEW_SUPABASE_URL}\n`);

  // Първо провери дали схемата съществува
  const { error: schemaCheckError } = await newSupabase
    .from('menu_items')
    .select('id')
    .limit(1);

  if (schemaCheckError && schemaCheckError.code === 'PGRST205') {
    console.log('❌ Schema not found in new project!');
    await setupSchema();
    console.log('\n⏳ Please run the SQL setup first, then run this script again.');
    process.exit(1);
  }

  const TABLES = [
    'menu_items',
    'restaurant_tables',
    'cart_items',
    'table_requests',
    'daily_menu_assignments',
    'customer_ratings',
    'completed_orders',
    'table_history_archive'
  ];

  let totalExported = 0;
  let totalImported = 0;

  for (const table of TABLES) {
    const result = await migrateTable(table);
    totalExported += result.exported;
    totalImported += result.imported;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`Total exported: ${totalExported} rows`);
  console.log(`Total imported: ${totalImported} rows`);
  console.log('='.repeat(60));
  console.log('\n✅ Migration completed successfully!');
}

migrateAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
