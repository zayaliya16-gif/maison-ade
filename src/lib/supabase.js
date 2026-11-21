import 'server-only'; // build fails if a browser component ever imports this file
import { createClient } from '@supabase/supabase-js';

// One database connection for the whole server.
// It uses the SECRET key, so it can read and write everything: it must never reach the browser.
// Pages and server actions call this; customers' browsers never talk to Supabase directly.
let client;

export function db() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Add them to .env.local (see .env.example).');
  }

  client = createClient(url, key, {
    // The server has no logged-in user session to remember
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
