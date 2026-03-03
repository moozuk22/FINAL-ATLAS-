import { createClient } from '@supabase/supabase-js';

// Стари Supabase credentials (за експорт)
const OLD_SUPABASE_URL = 'https://wicufyfrkaigjhirdgeu.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpY3VmeWZya2FpZ2poaXJkZ2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODMzMjcsImV4cCI6MjA4NTQ1OTMyN30.lqKJho15EnaohIhEtAq2TeISYhHHQvX-LdV9d9SETAc';

// Нови Supabase credentials (за импорт)
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

// Списък с всички таблици за миграция
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

interface MigrationResult {
  table: string;
  exported: number;
  imported: number;
  errors: string[];
}

async function migrateTable(tableName: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: tableName,
    exported: 0,
    imported: 0,
    errors: []
  };

  try {
    console.log(`\n📦 Migrating ${tableName}...`);

    // Експорт от стария проект
    const { data: oldData, error: exportError } = await oldSupabase
      .from(tableName)
      .select('*');

    if (exportError) {
      result.errors.push(`Export error: ${exportError.message}`);
      console.error(`❌ Error exporting ${tableName}:`, exportError);
      return result;
    }

    if (!oldData || oldData.length === 0) {
      console.log(`⚠️  No data found in ${tableName}, skipping...`);
      return result;
    }

    result.exported = oldData.length;
    console.log(`✅ Exported ${result.exported} rows from ${tableName}`);

    // Изчистване на данните в новата таблица (ако искаш да запазиш съществуващите, премахни това)
    // const { error: deleteError } = await newSupabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // if (deleteError && deleteError.code !== 'PGRST116') {
    //   console.warn(`⚠️  Could not clear ${tableName}:`, deleteError.message);
    // }

    // Импорт в новия проект
    // Използваме upsert за да избегнем дублирани записи
    const { data: importedData, error: importError } = await newSupabase
      .from(tableName)
      .upsert(oldData, { onConflict: 'id', ignoreDuplicates: false });

    if (importError) {
      // Ако upsert не работи, опитай с insert
      console.log(`⚠️  Upsert failed, trying insert for ${tableName}...`);
      
      // Раздели на батчове за по-големи таблици
      const batchSize = 100;
      for (let i = 0; i < oldData.length; i += batchSize) {
        const batch = oldData.slice(i, i + batchSize);
        const { error: batchError } = await newSupabase
          .from(tableName)
          .insert(batch);

        if (batchError) {
          result.errors.push(`Batch ${i}-${i + batchSize}: ${batchError.message}`);
          console.error(`❌ Error importing batch ${i}-${i + batchSize}:`, batchError);
        } else {
          result.imported += batch.length;
        }
      }
    } else {
      result.imported = oldData.length;
    }

    if (result.imported > 0) {
      console.log(`✅ Imported ${result.imported} rows to ${tableName}`);
    }

  } catch (error: any) {
    result.errors.push(`Unexpected error: ${error.message}`);
    console.error(`❌ Unexpected error migrating ${tableName}:`, error);
  }

  return result;
}

async function migrateAll() {
  console.log('🚀 Starting Supabase migration...');
  console.log(`📤 Source: ${OLD_SUPABASE_URL}`);
  console.log(`📥 Destination: ${NEW_SUPABASE_URL}`);
  console.log(`\n📋 Tables to migrate: ${TABLES.join(', ')}\n`);

  const results: MigrationResult[] = [];

  for (const table of TABLES) {
    const result = await migrateTable(table);
    results.push(result);
    
    // Малка пауза между таблиците за да не overload-нем API-то
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Обобщение
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));

  let totalExported = 0;
  let totalImported = 0;
  let totalErrors = 0;

  results.forEach(result => {
    totalExported += result.exported;
    totalImported += result.imported;
    totalErrors += result.errors.length;

    const status = result.errors.length > 0 ? '⚠️' : result.imported === result.exported ? '✅' : '⚠️';
    console.log(`${status} ${result.table.padEnd(30)} | Exported: ${result.exported.toString().padStart(4)} | Imported: ${result.imported.toString().padStart(4)}`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`   └─ Error: ${err}`));
    }
  });

  console.log('='.repeat(60));
  console.log(`Total exported: ${totalExported} rows`);
  console.log(`Total imported: ${totalImported} rows`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('='.repeat(60));

  if (totalErrors === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n⚠️  Migration completed with some errors. Please review the output above.');
  }
}

// Стартирай миграцията
migrateAll().catch(error => {
  console.error('💥 Fatal error during migration:', error);
  process.exit(1);
});
