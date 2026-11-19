// ─────────────────────────────────────────────────────────────
// Maison Adé is a MADE-UP salon for a portfolio project.
// Everything here is DEMO data: names, prices, hours and contact details.
// Prices are in kobo (₦1 = 100 kobo), durations in minutes.
// ─────────────────────────────────────────────────────────────

export const salon = {
  name: 'Maison Adé',
  tagline: 'Hair and beauty, crowned.',
  intro:
    'A calm, unhurried salon in Lekki for silk presses, braids, colour and skin. Book online, choose your stylist, and we remind you before you come.',
  area: 'Lekki Phase 1, Lagos', // DEMO
  phoneDisplay: '0800 000 0000', // DEMO: not a real number
  email: 'hello@example.com', // DEMO
  timezone: 'Africa/Lagos',
  // Opening hours by weekday (0 = Sunday). null = closed. DEMO.
  hours: {
    0: { open: '12:00', close: '17:00' },
    1: null,
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '19:00' },
    6: { open: '09:00', close: '19:00' },
  },
};

export const categories = [
  { id: 'hair', label: 'Hair' },
  { id: 'braids', label: 'Braids and locs' },
  { id: 'beauty', label: 'Skin, brows and nails' },
];

export const services = [
  { id: 'trim', category: 'hair', name: 'Trim and shape', minutes: 30, priceKobo: 1000000, summary: 'Ends cleaned up and shape refreshed, finished with a light blow-dry.' },
  { id: 'blow-dry', category: 'hair', name: 'Wash and blow-dry', minutes: 60, priceKobo: 1800000, summary: 'Deep cleanse and conditioning, then a smooth, bouncy blow-dry.' },
  { id: 'silk-press', category: 'hair', name: 'Silk press', minutes: 90, priceKobo: 3500000, summary: 'Glossy, swinging straight hair with heat protection, no relaxer.' },
  { id: 'wig-install', category: 'hair', name: 'Frontal wig install', minutes: 150, priceKobo: 4500000, summary: 'Customised, melted and styled so the hairline looks your own.' },
  { id: 'colour', category: 'hair', name: 'Full colour', minutes: 180, priceKobo: 6000000, summary: 'Consultation, strand test and an all-over colour with gloss.' },
  { id: 'cornrows', category: 'braids', name: 'Feed-in cornrows', minutes: 120, priceKobo: 3000000, summary: 'Neat, tension-free cornrows in your choice of pattern.' },
  { id: 'loc-retwist', category: 'braids', name: 'Loc retwist', minutes: 120, priceKobo: 2800000, summary: 'Wash, retwist and style, with care for your scalp.' },
  { id: 'knotless', category: 'braids', name: 'Knotless braids, mid-back', minutes: 300, priceKobo: 8500000, summary: 'Light, natural-looking braids that start flat at the root. Hair included.' },
  { id: 'brows', category: 'beauty', name: 'Brow shape and tint', minutes: 45, priceKobo: 1500000, summary: 'Mapped to your face, shaped and tinted to frame your eyes.' },
  { id: 'manicure', category: 'beauty', name: 'Gel manicure', minutes: 60, priceKobo: 1500000, summary: 'Shape, cuticle care and a gel colour that lasts two to three weeks.' },
  { id: 'facial', category: 'beauty', name: 'Signature facial', minutes: 75, priceKobo: 4000000, summary: 'Cleanse, exfoliation, extraction and a calming mask for your skin type.' },
  { id: 'pedicure', category: 'beauty', name: 'Spa pedicure', minutes: 75, priceKobo: 2000000, summary: 'A long soak, scrub, massage and polish.' },
];

// DEMO stylists. `services` lists the service ids each one offers.
export const staff = [
  {
    id: 'tolu', name: 'Tolu', role: 'Senior stylist',
    bio: 'Twelve years of silk presses and colour. Known for hair that still moves a week later.',
    services: ['trim', 'blow-dry', 'silk-press', 'wig-install', 'colour'],
  },
  {
    id: 'ifeoma', name: 'Ifeoma', role: 'Braids and locs specialist',
    bio: 'Gentle, tension-free braiding and loc care. Your edges are safe with her.',
    services: ['trim', 'cornrows', 'loc-retwist', 'knotless'],
  },
  {
    id: 'kemi', name: 'Kemi', role: 'Stylist',
    bio: 'Wig installs, cornrows and blow-dries, with an eye for a natural hairline.',
    services: ['blow-dry', 'silk-press', 'wig-install', 'cornrows', 'knotless'],
  },
  {
    id: 'zainab', name: 'Zainab', role: 'Beauty therapist',
    bio: 'Facials, brows and nails. Calm hands and a very good playlist.',
    services: ['brows', 'manicure', 'facial', 'pedicure'],
  },
];
