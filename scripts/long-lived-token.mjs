// Turns a short-lived WhatsApp token (Meta > WhatsApp > API Setup > Generate token) into a 60-day one,
// and saves it into .env.local in place of the old WHATSAPP_TOKEN. The token is never printed.
// Needs in .env.local: WHATSAPP_TOKEN (fresh), META_APP_ID and WHATSAPP_APP_SECRET (Meta > App settings > Basic).
// Run: npm run token:extend
import { readFileSync, writeFileSync } from 'node:fs';

const { WHATSAPP_TOKEN: shortToken, META_APP_ID: appId, WHATSAPP_APP_SECRET: appSecret } = process.env;
const missing = [!shortToken && 'WHATSAPP_TOKEN', !appId && 'META_APP_ID', !appSecret && 'WHATSAPP_APP_SECRET'].filter(Boolean);
if (missing.length) {
  console.log(`✗ Missing in .env.local: ${missing.join(', ')}`);
  process.exit(1);
}

const graph = 'https://graph.facebook.com/v25.0';
const url = `${graph}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}`
  + `&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
const result = await (await fetch(url)).json();
if (!result.access_token) {
  console.log(`✗ Meta refused: ${result.error?.message ?? 'unknown error'}`);
  console.log('  (Most likely: the WHATSAPP_TOKEN in .env.local has already expired. Generate a fresh one and run this again straight away.)');
  process.exit(1);
}

// Check what we got
const info = (await (await fetch(`${graph}/debug_token?input_token=${encodeURIComponent(result.access_token)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`)).json()).data ?? {};
const expires = info.expires_at ? new Date(info.expires_at * 1000).toDateString() : 'never';

// Save it over the old token in .env.local
const env = readFileSync('.env.local', 'utf8');
writeFileSync('.env.local', env.replace(/^WHATSAPP_TOKEN=.*$/m, `WHATSAPP_TOKEN=${result.access_token}`));
console.log(`✓ New token saved in .env.local (valid: ${info.is_valid}, expires: ${expires}).`);
console.log('  Next: copy the WHATSAPP_TOKEN line\'s value into Vercel, then tell Claude "token done".');
