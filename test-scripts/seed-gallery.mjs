#!/usr/bin/env node
/**
 * Re-seed the Family Gallery: clear existing photos, then upload the demo photo
 * set (assets/demo-photos) with member tags + memory notes.
 *
 *   node test-scripts/seed-gallery.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const API = (process.env.API_URL || 'http://localhost:6100') + '/api/v1';
const PASSWORD = process.env.DEMO_PASSWORD || 'RememberKin2026!';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'demo-photos');

const log = (...a) => console.log('[gallery]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Stay under the /photos rate limit (20/min) — ~4s spacing = 15/min
const THROTTLE_MS = 4200;

async function login() {
  const r = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@rememberkin.demo', password: PASSWORD }),
  });
  const d = await r.json();
  return d.token || d.data?.token;
}

async function memberIds(token) {
  const r = await fetch(API + '/members', { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  return Object.fromEntries(d.members.map((m) => [m.name, m.id]));
}

// filename -> { caption, note, people: [member names] }
function plan(M) {
  const P = (name) => M[name];
  return [
    // Base portraits
    ['grandpa-minh-portrait.png', 'Grandpa Minh', 'Ong Noi — always the calm heart of the family.', ['Grandpa Minh']],
    ['grandma-hoa-portrait.png', 'Grandma Hoa', 'Ba Noi, whose pho recipe holds the family together.', ['Grandma Hoa']],
    ['linh-nguyen.png', 'Linh', 'Keeper of the family memories.', ['Linh Nguyen']],
    ['an-nguyen.png', 'An', "Linh's youngest sibling, full of energy.", ['An Nguyen']],
    ['uncle-tuan-portrait.png', 'Uncle Tuan', "Linh's brother — the family fixer.", ['Uncle Tuan']],
    ['aunt-mai-portrait.png', 'Aunt Mai', "Tuan's wife, the gentlest smile at any gathering.", ['Aunt Mai']],
    ['cousin-duc.png', 'Cousin Duc', 'Fresh out of school and going places.', ['Cousin Duc']],
    ['david-miller.png', 'David', "Linh's husband.", []],
    // Scene variations (same person, different moments)
    ['grandpa-minh-kite.png', 'Grandpa making kites', 'Every summer he builds a new kite for the grandkids.', ['Grandpa Minh']],
    ['grandpa-minh-boat.png', 'Dawn on the water', 'Grandpa still loves being out on the boat at first light.', ['Grandpa Minh']],
    ['grandma-hoa-cooking.png', 'Grandma cooking pho', 'The secret is charring the ginger just right.', ['Grandma Hoa']],
    ['grandma-hoa-garden.png', 'Grandma in the garden', 'Her flowers win the neighborhood every year.', ['Grandma Hoa']],
    ['grandma-hoa-beach-kite.png', 'Beach day 2024', 'Grandma flew the kite at Da Nang and insisted on holding the string herself!', ['Grandpa Minh', 'Grandma Hoa']],
    ['linh-nguyen-reading.png', 'Quiet afternoon', 'Linh with a book by the window.', ['Linh Nguyen']],
    ['linh-nguyen-cafe.png', 'Coffee break', 'Her favorite corner cafe.', ['Linh Nguyen']],
    ['an-nguyen-studying.png', 'An studying', 'Exams season — willing the textbooks to cooperate.', ['An Nguyen']],
    ['an-nguyen-guitar.png', 'An on guitar', 'Learning a new song for the family gathering.', ['An Nguyen']],
    ['uncle-tuan-bicycle.png', 'Tuan fixing bikes', 'He can repair anything with two wheels.', ['Uncle Tuan']],
    ['uncle-tuan-football.png', 'Match day', 'Cheering loud enough for the whole street.', ['Uncle Tuan']],
    ['aunt-mai-flowers.png', 'Mai at the market', 'She always brings home the brightest flowers.', ['Aunt Mai']],
    ['aunt-mai-teaching.png', 'Mai teaching', 'Patiently guiding little hands to write.', ['Aunt Mai']],
    ['cousin-duc-graduation.png', "Duc's graduation", 'First in the family to finish university!', ['Cousin Duc']],
    ['cousin-duc-hiking.png', 'Duc hiking', 'Weekend trail up the green mountains.', ['Cousin Duc']],
    // Group photos
    ['group-1-family-dinner.png', 'Family dinner', 'Sunday dinners are sacred in this house.', ['Grandpa Minh', 'Grandma Hoa', 'Linh Nguyen', 'An Nguyen']],
    ['group-2-family-reunion.png', 'Family reunion', 'Three generations together in the garden.', ['Grandpa Minh', 'Grandma Hoa', 'Linh Nguyen', 'Uncle Tuan', 'Aunt Mai', 'An Nguyen', 'Cousin Duc']],
    ['group-3-tet.png', 'Tết celebration', 'Lunar New Year — red envelopes and too much food.', ['Grandpa Minh', 'Grandma Hoa', 'Linh Nguyen', 'An Nguyen', 'Cousin Duc']],
    ['group-4-grandparents.png', 'Ong Noi & Ba Noi', 'Fifty years and still holding hands.', ['Grandpa Minh', 'Grandma Hoa']],
    ['group-5-the-kids.png', 'The kids', 'An and Duc, partners in mischief.', ['An Nguyen', 'Cousin Duc']],
  ].map(([file, caption, note, people]) => ({
    file,
    caption,
    note,
    ids: people.map(P).filter(Boolean),
  }));
}

async function main() {
  const token = await login();
  const M = await memberIds(token);

  // Clear existing
  const existing = await (await fetch(API + '/photos', { headers: { Authorization: `Bearer ${token}` } })).json();
  for (const p of existing.photos || []) {
    await fetch(`${API}/photos/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await sleep(THROTTLE_MS);
  }
  log(`cleared ${existing.photos?.length || 0} existing photos`);

  let ok = 0;
  for (const item of plan(M)) {
    const fp = path.join(DIR, item.file);
    if (!existsSync(fp)) { log('SKIP missing', item.file); continue; }
    const form = new FormData();
    const buf = readFileSync(fp);
    form.append('photo', new Blob([buf], { type: 'image/png' }), item.file);
    form.append('caption', item.caption);
    form.append('note', item.note);
    if (item.ids.length) form.append('taggedMembers', JSON.stringify(item.ids));
    let r = await fetch(API + '/photos', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (r.status === 429) { log('rate limited, waiting 60s…'); await sleep(61000); r = await fetch(API + '/photos', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); }
    if (r.ok) { ok++; log(`uploaded ${item.file} (tags: ${item.ids.length})`); }
    else { log('FAIL', item.file, r.status, (await r.text()).slice(0, 100)); }
    await sleep(THROTTLE_MS);
  }
  log(`done — ${ok} photos in the gallery`);
}

main().catch((e) => { console.error('[gallery] FAILED:', e); process.exit(1); });
