import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zqnyugoudabtqieuqhrp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxbnl1Z291ZGFidHFpZXVxaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTAzMDQsImV4cCI6MjA4ODEyNjMwNH0.ahoHNU_-3y0rVWOuXGOb8fUoOfA5bjuPABHCrDzvgLc';

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Supabase features will not work.');
}

// Log configuration (without exposing the full key)
if (import.meta.env.DEV) {
  console.log('Supabase Configuration:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey?.length || 0,
    usingEnvVars: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
