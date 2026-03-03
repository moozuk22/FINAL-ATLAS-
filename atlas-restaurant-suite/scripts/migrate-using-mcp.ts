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
  'menu_items',              // Първо - няма зависимости
  'restaurant_tables',       // Второ - няма зависимости
  'cart_items',              // Зависи от menu_items и restaurant_tables
  'table_requests',          // Зависи от restaurant_tables
  'customer_ratings',        // Зависи от restaurant_tables
  'daily_menu_assignments', // Зависи от menu_items
  'completed_orders',       // Зависи от restaurant_tables
  'table_history_archive'   // Последно - няма foreign keys
];

interface MigrationResult {
  table: string;
  exported: number;
  imported: number;
  errors: string[];
}

async function checkSchemaExists(): Promise<boolean> {
  try {
    const { error } = await newSupabase
      .from('menu_items')
      .select('id')
      .limit(1);
    
    return !error || error.code !== 'PGRST205';
  } catch {
    return false;
  }
}

async function fixRLSPolicies(): Promise<boolean> {
  console.log('🔧 Attempting to fix RLS policies...');
  
  // Опитай да създадем policies чрез RPC или директно чрез REST API
  // За съжаление, Supabase JS client не поддържа direct SQL execution
  // Но можем да опитаме да използваме RPC функция ако съществува
  
  // За сега, просто информираме потребителя
  console.log('⚠️  RLS policies need to be fixed manually.');
  console.log('   Please run scripts/fix-rls-new-project.sql in the NEW project.\n');
  
  return false;
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

    // Експорт от стария проект (използвай стария Supabase client)
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

    // Импорт в новия проект (използвай новия Supabase client)
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < oldData.length; i += batchSize) {
      const batch = oldData.slice(i, i + batchSize);
      
      // Премахни/конвертирай полета които може да не съществуват в новата схема
      const cleanedBatch = batch.map((row: any) => {
        const cleaned: any = { ...row };
        
        // Премахни полета които не съществуват в новата схема
        if (tableName === 'menu_items') {
          // Премахни daily_menu_date и is_daily_menu - не са в новата схема
          delete cleaned.daily_menu_date;
          delete cleaned.is_daily_menu;
        }
        
        if (tableName === 'completed_orders') {
          // Премахни completed_at - не е в новата схема
          delete cleaned.completed_at;
        }
        
        if (tableName === 'table_history_archive') {
          // Премахни created_at - не е в новата схема
          delete cleaned.created_at;
        }
        
        // За table_requests, timer полетата са BIGINT в новата схема, не TIMESTAMPTZ
        // Ако са TIMESTAMPTZ strings, конвертирай ги към BIGINT (timestamp в milliseconds)
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

      // Опитай upsert първо с ignoreDuplicates за да избегнем duplicate key errors
      const { error: upsertError } = await newSupabase
        .from(tableName)
        .upsert(cleanedBatch, { onConflict: 'id', ignoreDuplicates: true });

      if (upsertError) {
        // Ако upsert не работи, опитай с insert
        const { error: insertError } = await newSupabase
          .from(tableName)
          .insert(cleanedBatch);

        if (insertError) {
          // Ако insert също не работи поради RLS, опитай да използваме service_role key
          // или да информираме потребителя
          if (insertError.message.includes('row-level security')) {
            result.errors.push(`Batch ${i}-${i + batchSize}: RLS policy violation - please run scripts/fix-rls-new-project.sql first`);
            console.error(`❌ RLS policy violation for ${tableName}. Please fix RLS policies first.`);
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
  console.log('🚀 Starting Supabase migration using MCP export...');
  console.log(`📤 Source (MCP): ${OLD_SUPABASE_URL}`);
  console.log(`📥 Destination: ${NEW_SUPABASE_URL}`);
  console.log(`\n📋 Tables to migrate: ${TABLES.join(', ')}\n`);

  // Провери дали схемата съществува
  const schemaExists = await checkSchemaExists();
  
  if (!schemaExists) {
    console.log('❌ Schema not found in new project!');
    console.log('\n📋 Please create the schema first:');
    console.log('   1. Go to: https://zqnyugoudabtqieuqhrp.supabase.co');
    console.log('   2. SQL Editor → New Query');
    console.log('   3. Copy and paste the contents of scripts/setup-new-supabase.sql');
    console.log('   4. Click Run');
    console.log('   5. Also run scripts/fix-rls-new-project.sql to fix RLS policies');
    console.log('   6. Wait a few seconds for PostgREST to reload the schema');
    console.log('   7. Then run this script again: npm run migrate:mcp\n');
    process.exit(1);
  }

  console.log('✅ Schema found in new project, starting migration...\n');

  // Поправи RLS policies преди импорт
  await fixRLSPolicies();

  const results: MigrationResult[] = [];

  for (const table of TABLES) {
    const result = await migrateTable(table);
    results.push(result);
    
    // Малка пауза между таблиците
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

  if (totalErrors === 0 && totalImported === totalExported) {
    console.log('\n✅ Migration completed successfully!');
  } else if (totalImported > 0) {
    console.log('\n⚠️  Migration completed with some errors. Please review the output above.');
  } else {
    console.log('\n❌ Migration failed. Please check the errors above.');
  }
}

// Стартирай миграцията
migrateAll().catch(error => {
  console.error('💥 Fatal error during migration:', error);
  process.exit(1);
});
