import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Нови Supabase credentials
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
// NOTE: За да изпълниш SQL, трябва да използваш SERVICE_ROLE_KEY, не anon key
// Намери го в: Project Settings → API → service_role key
const NEW_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!NEW_SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set!');
  console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role key');
  console.error('   Then run: SUPABASE_SERVICE_ROLE_KEY=your_key npm run setup-schema');
  process.exit(1);
}

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupSchema() {
  console.log('🚀 Setting up database schema in new Supabase project...');
  console.log(`📥 Target: ${NEW_SUPABASE_URL}\n`);

  // Прочети SQL файла
  const sqlPath = path.join(__dirname, 'setup-new-supabase.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Раздели SQL на отделни statements (по ;)
  // Премахни коментарите и празните редове
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'NOTIFY pgrst, \'reload schema\'');

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Пропусни празни statements
    if (!statement || statement.length < 10) continue;

    try {
      // Използвай RPC за изпълнение на SQL (ако е налично)
      // Или използвай direct query
      const { error } = await newSupabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Ако RPC не работи, опитай с direct query чрез Supabase REST API
        // За съжаление, Supabase JS client не поддържа direct SQL execution
        // Трябва да се използва Supabase Dashboard или CLI
        console.log(`⚠️  Statement ${i + 1}: Cannot execute directly via API`);
        console.log(`   Please run this SQL manually in Supabase Dashboard`);
        errorCount++;
      } else {
        successCount++;
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Processed ${i + 1}/${statements.length} statements...`);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error executing statement ${i + 1}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Schema Setup Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));

  if (errorCount > 0) {
    console.log('\n⚠️  Note: Supabase JS client cannot execute raw SQL directly.');
    console.log('   Please run scripts/setup-new-supabase.sql manually in Supabase Dashboard:');
    console.log('   1. Go to: https://zqnyugoudabtqieuqhrp.supabase.co');
    console.log('   2. SQL Editor → New Query');
    console.log('   3. Paste the entire SQL file');
    console.log('   4. Click Run');
  } else {
    console.log('\n✅ Schema setup completed!');
  }
}

setupSchema().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
