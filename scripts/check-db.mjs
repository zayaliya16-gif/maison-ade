// Quick check that .env.local has working Supabase details.
// Run: npm run db:check
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('✗ SUPABASE_URL or SUPABASE_SECRET_KEY is empty in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
// Listing users needs the secret key, so it proves both the address and the key are right.
const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
if (error) {
  console.error('✗ Could not connect:', error.message);
  process.exit(1);
}
console.log('✓ Connected to', url);
