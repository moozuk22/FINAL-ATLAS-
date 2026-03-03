import { createClient } from '@supabase/supabase-js';

// Стари Supabase credentials (от стария проект)
const OLD_SUPABASE_URL = 'https://wicufyfrkaigjhirdgeu.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpY3VmeWZya2FpZ2poaXJkZ2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODMzMjcsImV4cCI6MjA4NTQ1OTMyN30.lqKJho15EnaohIhEtAq2TeISYhHHQvX-LdV9d9SETAc';

// Нови Supabase credentials
const NEW_SUPABASE_URL = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrateRemainingTables() {
  console.log('🚀 Migrating remaining tables...\n');

  // Импортирай restaurant_tables
  console.log('📦 Migrating restaurant_tables...');
  const { data: restaurantTables, error: rtError } = await oldSupabase
    .from('restaurant_tables')
    .select('*');

  if (!rtError && restaurantTables && restaurantTables.length > 0) {
    // Премахни created_at и updated_at за да използваме default стойностите
    const cleaned = restaurantTables.map((row: any) => {
      const { created_at, updated_at, ...rest } = row;
      return rest;
    });

    const { error: insertError } = await newSupabase
      .from('restaurant_tables')
      .upsert(cleaned, { onConflict: 'table_id', ignoreDuplicates: true });

    if (insertError) {
      console.error(`❌ Error: ${insertError.message}`);
    } else {
      console.log(`✅ Imported ${restaurantTables.length} restaurant tables`);
    }
  }

  // Импортирай table_history_archive
  console.log('\n📦 Migrating table_history_archive...');
  const { data: archiveData, error: archError } = await oldSupabase
    .from('table_history_archive')
    .select('*');

  if (!archError && archiveData && archiveData.length > 0) {
    // Премахни created_at защото не е в новата схема
    const cleaned = archiveData.map((row: any) => {
      const { created_at, ...rest } = row;
      return rest;
    });

    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < cleaned.length; i += batchSize) {
      const batch = cleaned.slice(i, i + batchSize);
      const { error: batchError } = await newSupabase
        .from('table_history_archive')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

      if (batchError) {
        console.error(`❌ Error importing batch ${i}-${i + batchSize}: ${batchError.message}`);
      } else {
        imported += batch.length;
      }
    }

    console.log(`✅ Imported ${imported}/${cleaned.length} archive records`);
  }

  console.log('\n✅ Migration complete!');
}

migrateRemainingTables().catch(error => {
  console.error('💥 Error:', error);
  process.exit(1);
});
