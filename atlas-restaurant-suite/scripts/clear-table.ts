import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zqnyugoudabtqieuqhrp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function clearTable(tableId: string) {
  console.log(`\n🔄 Clearing ${tableId}...\n`);

  try {
    // Step 1: Get all data
    const [cartResult, requestsResult] = await Promise.all([
      supabase
        .from('cart_items')
        .select('*')
        .eq('table_id', tableId),
      supabase
        .from('table_requests')
        .select('*')
        .eq('table_id', tableId)
    ]);

    if (cartResult.error) {
      console.error('❌ Error fetching cart:', cartResult.error);
      return;
    }
    if (requestsResult.error) {
      console.error('❌ Error fetching requests:', requestsResult.error);
      return;
    }

    const cartData = cartResult.data || [];
    const requestsData = requestsResult.data || [];

    console.log(`📊 Found ${cartData.length} cart items and ${requestsData.length} requests`);

    // Step 2: Move requests to completed_orders
    if (requestsData.length > 0) {
      const completedOrders = requestsData.map(req => ({
        id: `completed_${req.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        table_id: req.table_id,
        action: req.action,
        details: req.details || '',
        total: parseFloat(req.total || '0'),
        status: 'completed',
        timestamp: req.timestamp,
        payment_method: req.payment_method || null,
      }));

      const { error: insertError } = await supabase
        .from('completed_orders')
        .insert(completedOrders);

      if (insertError) {
        console.error('❌ Error moving to completed_orders:', insertError);
      } else {
        console.log(`✅ Moved ${completedOrders.length} requests to completed_orders`);
      }
    }

    // Step 3: Delete cart items
    if (cartData.length > 0) {
      const { error: deleteCartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('table_id', tableId);

      if (deleteCartError) {
        console.error('❌ Error deleting cart items:', deleteCartError);
      } else {
        console.log(`✅ Deleted ${cartData.length} cart items`);
      }
    }

    // Step 4: Delete requests
    if (requestsData.length > 0) {
      const { error: deleteRequestsError } = await supabase
        .from('table_requests')
        .delete()
        .eq('table_id', tableId);

      if (deleteRequestsError) {
        console.error('❌ Error deleting requests:', deleteRequestsError);
      } else {
        console.log(`✅ Deleted ${requestsData.length} requests`);
      }
    }

    // Step 5: Reset table status
    const { error: updateError } = await supabase
      .from('restaurant_tables')
      .update({
        is_locked: false,
        session_started_at: new Date().toISOString()
      })
      .eq('table_id', tableId);

    if (updateError) {
      console.error('❌ Error updating table:', updateError);
    } else {
      console.log(`✅ Reset table status`);
    }

    console.log(`\n✨ ${tableId} cleared successfully!\n`);
  } catch (error) {
    console.error('❌ Error clearing table:', error);
  }
}

// Get table ID from command line argument or default to Table_01
const tableId = process.argv[2] || 'Table_01';

clearTable(tableId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
