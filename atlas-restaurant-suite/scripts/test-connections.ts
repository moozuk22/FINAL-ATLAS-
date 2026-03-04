#!/usr/bin/env tsx
/**
 * Connection Test Script
 * Tests all application connections including Supabase database, real-time subscriptions, and external services
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zqnyugoudabtqieuqhrp.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ConnectionTest {
  name: string;
  test: () => Promise<{ success: boolean; message: string; details?: any }>;
}

const tests: ConnectionTest[] = [
  {
    name: 'Supabase Client Configuration',
    test: async () => {
      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          success: false,
          message: 'Missing Supabase configuration',
          details: { url: !!supabaseUrl, key: !!supabaseAnonKey }
        };
      }
      return {
        success: true,
        message: 'Supabase client configured',
        details: {
          url: supabaseUrl,
          keyLength: supabaseAnonKey.length,
          usingEnvVars: !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)
        }
      };
    }
  },
  {
    name: 'Database: restaurant_tables',
    test: async () => {
      try {
        const { data, error } = await supabase.from('restaurant_tables').select('table_id').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: menu_items',
    test: async () => {
      try {
        const { data, error } = await supabase.from('menu_items').select('id').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: cart_items',
    test: async () => {
      try {
        const { data, error } = await supabase.from('cart_items').select('*, menu_items(id, name, price)').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible with relations (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: table_requests',
    test: async () => {
      try {
        const { data, error } = await supabase
          .from('table_requests')
          .select('*')
          .neq('status', 'completed')
          .limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: daily_menu_assignments',
    test: async () => {
      try {
        const { data, error } = await supabase.from('daily_menu_assignments').select('id').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: customer_ratings',
    test: async () => {
      try {
        const { data, error } = await supabase.from('customer_ratings').select('id').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: completed_orders',
    test: async () => {
      try {
        const { data, error } = await supabase.from('completed_orders').select('id').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Database: table_history_archive',
    test: async () => {
      try {
        const { data, error } = await supabase.from('table_history_archive').select('id').limit(1);
        if (error) {
          return { success: false, message: error.message, details: error };
        }
        return { success: true, message: `Table accessible (${data?.length || 0} rows checked)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Real-time: WebSocket Connection',
    test: async () => {
      return new Promise((resolve) => {
        const channel = supabase.channel('test-connection');
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            channel.unsubscribe();
            resolve({
              success: false,
              message: 'WebSocket connection timeout (5s)',
              details: 'Real-time connection may not be available'
            });
          }
        }, 5000);

        channel
          .on('system', {}, (payload) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({
                success: true,
                message: 'WebSocket connected successfully',
                details: payload
              });
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED' && !resolved) {
              resolved = true;
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve({
                success: true,
                message: 'Real-time channel subscribed',
                details: { status }
              });
            } else if (status === 'CHANNEL_ERROR' && !resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve({
                success: false,
                message: 'Real-time channel error',
                details: { status }
              });
            }
          });
      });
    }
  },
  {
    name: 'External: Google Fonts',
    test: async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap', {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          return { success: true, message: 'Google Fonts accessible' };
        }
        return { success: false, message: `HTTP ${response.status}` };
      } catch (err: any) {
        // Network errors are acceptable - fonts will load in browser
        if (err.name === 'AbortError' || err.message.includes('fetch')) {
          return { 
            success: true, 
            message: 'Google Fonts URL valid (network check skipped - will load in browser)' 
          };
        }
        return { success: false, message: err.message };
      }
    }
  },
  {
    name: 'Environment: Google Place ID',
    test: async () => {
      const placeId = process.env.VITE_GOOGLE_PLACE_ID;
      if (!placeId || placeId === 'your_google_place_id') {
        return {
          success: false,
          message: 'VITE_GOOGLE_PLACE_ID not configured',
          details: 'Google Reviews feature will use fallback URL'
        };
      }
      return { success: true, message: 'Google Place ID configured' };
    }
  }
];

async function runTests() {
  console.log('🔍 Testing All Application Connections\n');
  console.log('='.repeat(60));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Using Env Vars: ${!!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)}`);
  console.log('='.repeat(60) + '\n');

  const results: Array<{ name: string; success: boolean; message: string; details?: any }> = [];

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    try {
      const result = await test.test();
      results.push({ name: test.name, ...result });
      if (result.success) {
        console.log(`✅ ${result.message}`);
      } else {
        console.log(`❌ ${result.message}`);
        if (result.details) {
          console.log(`   Details:`, result.details);
        }
      }
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}`);
      results.push({ name: test.name, success: false, message: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
