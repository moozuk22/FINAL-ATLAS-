import { createClient } from '@supabase/supabase-js';

// Стари Supabase credentials (от MCP - текущ проект)
const OLD_SUPABASE_URL = 'https://wicufyfrkaigjhirdgeu.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpY3VmeWZya2FpZ2poaXJkZ2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODMzMjcsImV4cCI6MjA4NTQ1OTMyN30.lqKJho15EnaohIhEtAq2TeISYhHHQvX-LdV9d9SETAc';

// Нови Supabase credentials
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

// Важен: Редът на таблиците е важен за foreign key constraints
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

interface MigrationResult {
  table: string;
  exported: number;
  imported: number;
  errors: string[];
}

async function fixRLSPoliciesViaRPC(): Promise<boolean> {
  console.log('🔧 Attempting to fix RLS policies via RPC...');
  
  // Опитай да използваме RPC функция за изпълнение на SQL
  // Това изисква да има RPC функция дефинирана в базата данни
  try {
    // За сега, просто информираме потребителя
    return false;
  } catch {
    return false;
  }
}

async function migrateTable(tableName: string, retryOnRLSError: boolean = true): Promise<MigrationResult> {
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

    // Импорт в новия проект
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < oldData.length; i += batchSize) {
      const batch = oldData.slice(i, i + batchSize);
      
      // Премахни/конвертирай полета които може да не съществуват в новата схема
      const cleanedBatch = batch.map((row: any) => {
        const cleaned: any = { ...row };
        
        if (tableName === 'menu_items') {
          delete cleaned.daily_menu_date;
          delete cleaned.is_daily_menu;
        }
        
        if (tableName === 'completed_orders') {
          delete cleaned.completed_at;
        }
        
        if (tableName === 'table_history_archive') {
          delete cleaned.created_at;
        }
        
        if (tableName === 'table_requests') {
          if (cleaned.timer_started_at && typeof cleaned.timer_started_at === 'string') {
            cleaned.timer_started_at = new Date(cleaned.timer_started_at).getTime();
          }
          if (cleaned.timer_paused_at && typeof cleaned.timer_paused_at === 'string') {
            cleaned.timer_paused_at = new Date(cleaned.timer_paused_at).getTime();
          }
        }
        
        return cleaned;
      });

      // Опитай upsert първо
      const { error: upsertError } = await newSupabase
        .from(tableName)
        .upsert(cleanedBatch, { onConflict: 'id', ignoreDuplicates: true });

      if (upsertError) {
        // Ако upsert не работи, опитай с insert
        const { error: insertError } = await newSupabase
          .from(tableName)
          .insert(cleanedBatch);

        if (insertError) {
          if (insertError.message.includes('row-level security') && retryOnRLSError) {
            result.errors.push(`RLS policy violation - will retry after fixing policies`);
            console.warn(`⚠️  RLS policy violation for ${tableName}. This table will be retried.`);
            // Не добавяй към imported, ще опитаме отново
          } else {
            result.errors.push(`Batch ${i}-${i + batchSize}: ${insertError.message}`);
            console.error(`❌ Error importing batch ${i}-${i + batchSize}:`, insertError.message);
          }
        } else {
          imported += batch.length;
        }
      } else {
        imported += batch.length;
      }
    }

    result.imported = imported;
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
  console.log('🚀 Starting Complete Supabase Migration');
  console.log(`📤 Source (OLD): ${OLD_SUPABASE_URL}`);
  console.log(`📥 Destination (NEW): ${NEW_SUPABASE_URL}`);
  console.log(`\n📋 Tables to migrate: ${TABLES.join(', ')}\n`);

  // Провери дали схемата съществува
  const { error: schemaCheckError } = await newSupabase
    .from('menu_items')
    .select('id')
    .limit(1);
  
  if (schemaCheckError && schemaCheckError.code === 'PGRST205') {
    console.log('❌ Schema not found in new project!');
    console.log('\n📋 Please create the schema first:');
    console.log('   1. Go to: https://zqnyugoudabtqieuqhrp.supabase.co');
    console.log('   2. SQL Editor → New Query');
    console.log('   3. Copy and paste: scripts/setup-new-supabase.sql');
    console.log('   4. Click Run');
    console.log('   5. Also run: scripts/fix-rls-new-project.sql');
    console.log('   6. Wait a few seconds');
    console.log('   7. Run: npm run migrate:mcp\n');
    process.exit(1);
  }

  console.log('✅ Schema found, starting migration...\n');

  // Първи опит за импорт
  const results: MigrationResult[] = [];
  const tablesWithRLSErrors: string[] = [];

  for (const table of TABLES) {
    const result = await migrateTable(table, true);
    results.push(result);
    
    if (result.errors.some(e => e.includes('RLS policy violation'))) {
      tablesWithRLSErrors.push(table);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Ако има RLS грешки, информирай потребителя
  if (tablesWithRLSErrors.length > 0) {
    console.log('\n⚠️  Some tables failed due to RLS policies:');
    tablesWithRLSErrors.forEach(table => console.log(`   - ${table}`));
    console.log('\n📋 To fix, run this SQL in the NEW project:');
    console.log('   Go to: https://zqnyugoudabtqieuqhrp.supabase.co');
    console.log('   SQL Editor → New Query → Paste: scripts/fix-rls-new-project.sql');
    console.log('   Then run: npm run migrate:mcp\n');
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
    totalErrors += result.errors.filter(e => !e.includes('RLS policy violation')).length;

    const status = result.errors.some(e => !e.includes('RLS policy violation')) ? '⚠️' : 
                   result.imported === result.exported ? '✅' : 
                   result.errors.some(e => e.includes('RLS policy violation')) ? '⏳' : '⚠️';
    
    console.log(`${status} ${result.table.padEnd(30)} | Exported: ${result.exported.toString().padStart(4)} | Imported: ${result.imported.toString().padStart(4)}`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => {
        if (!err.includes('RLS policy violation')) {
          console.log(`   └─ Error: ${err}`);
        }
      });
    }
  });

  console.log('='.repeat(60));
  console.log(`Total exported: ${totalExported} rows`);
  console.log(`Total imported: ${totalImported} rows`);
  console.log(`Remaining: ${totalExported - totalImported} rows (need RLS fix)`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('='.repeat(60));

  if (totalImported === totalExported) {
    console.log('\n✅ All data migrated successfully!');
  } else if (tablesWithRLSErrors.length > 0) {
    console.log(`\n⏳ ${totalExported - totalImported} rows pending (RLS policies need to be fixed)`);
    console.log('   After fixing RLS policies, run: npm run migrate:mcp');
  } else {
    console.log('\n⚠️  Migration completed with some errors. Please review above.');
  }
}

migrateAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
