// A robot browser books, changes, cancels, and uses the staff area, by clicking like a person would.
// Uses the made-up phone +99900000007 with no reminders ticked (so nothing is really sent), and cleans up after itself.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const TEST_PHONE = '+99900000007';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

async function cleanUp() {
  await supabase.from('bookings').delete().eq('customer_phone', TEST_PHONE);
  // The wrong-password test leaves one failed login for this computer ("unknown" address locally): remove it
  const local = createHash('sha256').update(`maison-ade login\n${process.env.SUPABASE_SECRET_KEY}\nunknown`).digest('hex');
  await supabase.from('login_attempts').delete().eq('ip_hash', local);
}
test.beforeAll(cleanUp);
test.afterAll(cleanUp);

/** Fails the test if the browser blocks anything because of our Content Security Policy, or shows a page error */
function watchForProblems(page) {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

test('a customer books, changes the time, then cancels', async ({ page }) => {
  const problems = watchForProblems(page);

  // Book
  await page.goto('/');
  await page.getByRole('link', { name: 'Book a visit' }).first().click();
  await page.getByRole('link', { name: /Trim and shape/ }).click();
  await page.getByRole('link', { name: /Any stylist/ }).click();
  await page.getByRole('link', { name: /times free/ }).first().click();
  const firstTime = page.locator('section[aria-label="Day and time"] ul.grid-cols-3 a').first();
  await firstTime.click();
  await page.getByLabel('Your name').fill('Playwright Test');
  await page.getByLabel('Mobile number').fill(TEST_PHONE);
  await page.getByLabel('On WhatsApp').uncheck();
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByRole('heading', { name: 'See you soon, Playwright' })).toBeVisible();
  const before = await page.locator('dl').first().innerText();

  // The calendar file downloads
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Add to calendar' }).click();
  expect((await download).suggestedFilename()).toBe('maison-ade-booking.ics');

  // Change time: pick a different day
  await page.getByRole('link', { name: 'Change time' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a new time' })).toBeVisible();
  await page.getByRole('link', { name: /times free/ }).nth(1).click();
  await page.locator('section[aria-label="Day and time"] ul.grid-cols-3 a').first().click();
  await page.getByRole('button', { name: 'Confirm new time' }).click();
  await expect(page.getByText('Done: your booking has moved')).toBeVisible();
  expect(await page.locator('dl').first().innerText()).not.toBe(before);

  // Cancel (accepting the "Are you sure?" question)
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(page.getByRole('heading', { name: 'This booking is cancelled' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Change time' })).toHaveCount(0);

  expect(problems, problems.join('\n')).toEqual([]);
});

test('the booking form explains mistakes and keeps what was typed', async ({ page }) => {
  await page.goto('/book?service=trim&staff=any');
  await page.getByRole('link', { name: /times free/ }).first().click();
  await page.locator('section[aria-label="Day and time"] ul.grid-cols-3 a').first().click();
  await page.getByLabel('Your name').fill('Playwright Test');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByText(/Please enter a mobile number/)).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveValue('Playwright Test');
});

test('staff: wrong password refused, right password opens the diary and message log', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/staff\/login$/);

  await page.getByLabel('Password').fill('definitely-not-the-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('That password isn’t right.')).toBeVisible();

  await page.getByLabel('Password').fill(process.env.STAFF_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole('heading', { name: 'Add time off' })).toBeVisible();

  await page.getByRole('link', { name: 'Messages' }).click();
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/staff\/login$/);
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/staff\/login$/); // really logged out
  expect(problems.filter((p) => !/401/.test(p)), problems.join('\n')).toEqual([]);
});
