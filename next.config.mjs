import { fileURLToPath } from 'node:url';

// Browser safety settings sent with every page
const securityHeaders = [
  // Nobody can show this site inside a frame on their own site (stops "clickjacking")
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Browsers must trust our file types instead of guessing (blocks a class of attacks)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Other sites only learn our domain when someone clicks a link, not the full page address
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // We never need these, so no script can ask for them
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise what the site is built with
  // There's a stray package-lock.json in the home folder; tell Next this folder is the project.
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  async headers() {
    // Private pages (customer links, staff diary): never in search engines, never kept in shared caches
    const privateHeaders = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'Cache-Control', value: 'private, no-store' },
    ];
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/b/:path*', headers: privateHeaders },
      { source: '/staff/:path*', headers: privateHeaders },
      { source: '/staff', headers: privateHeaders },
    ];
  },
};

export default nextConfig;
