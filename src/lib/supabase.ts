import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hpvsrdbxdzcnfgsxyrbg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnNyZGJ4ZHpjbmZnc3h5cmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTY5NjEsImV4cCI6MjA5NDMzMjk2MX0.M7qlk9pPP-3qm0Ivo0y6wTS73PWgM4TAyuOuImFxHn4';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client with service role key
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnNyZGJ4ZHpjbmZnc3h5cmJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc1Njk2MSwiZXhwIjoyMDk0MzMyOTYxfQ.QlxcRO6d-2wxoaZRBrCDf1M_J3ooBngMmrgum_ujovA'
);

export default supabase;
