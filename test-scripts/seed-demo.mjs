#!/usr/bin/env node
/**
 * Seed the demo family + judge accounts.
 *
 * Usage:
 *   node test-scripts/seed-demo.mjs                          # local (http://localhost:6100)
 *   API_URL=https://<deployed-host> node test-scripts/seed-demo.mjs
 *
 * Run this ONCE per environment while ALLOW_REGISTRATION is still true,
 * then set ALLOW_REGISTRATION=false and restart the backend so the public
 * deployment is login-only.
 *
 * Creates:
 *   - demo@rememberkin.demo   (family owner, "The Nguyen Family")
 *   - judge1..judge3@rememberkin.demo (each a registered member of the family)
 *   - a 3-generation family tree, 3 stories, 2 events
 */

const API = (process.env.API_URL || 'http://localhost:6100') + '/api/v1';
const PASSWORD = process.env.DEMO_PASSWORD || 'RememberKin2026!';

const log = (...args) => console.log('[seed]', ...args);

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function registerOrLogin(name, email) {
  const reg = await api('/auth/register', { method: 'POST', body: { name, email, password: PASSWORD } });
  if (reg.ok) {
    log(`registered ${email}`);
    return reg.data.token;
  }
  const login = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (!login.ok) throw new Error(`Cannot register or login ${email}: ${JSON.stringify(reg.data)} / ${JSON.stringify(login.data)}`);
  log(`logged in existing ${email}`);
  return login.data.token;
}

async function main() {
  // 1. Owner + family
  let owner = await registerOrLogin('Linh Nguyen', 'demo@rememberkin.demo');

  const family = await api('/family', { token: owner });
  if (!family.ok) {
    const created = await api('/family', { method: 'POST', token: owner, body: { name: 'The Nguyen Family' } });
    if (!created.ok) throw new Error('Family creation failed: ' + JSON.stringify(created.data));
    // The endpoint issues a fresh token carrying familyId — use it from here on
    if (created.data.token) owner = created.data.token;
    log('created family "The Nguyen Family"');
  } else {
    log('family already exists — reusing');
  }

  // 2. Judge accounts — each plays a family persona so the tree stays a real family
  const judges = [
    { login: 'judge1', persona: 'Uncle Tuan', birthDate: '1975-06-03' },
    { login: 'judge2', persona: 'Aunt Mai', birthDate: '1978-01-19' },
    { login: 'judge3', persona: 'Cousin Duc', birthDate: '2003-09-27' },
  ];
  for (const j of judges) {
    await registerOrLogin(j.persona, `${j.login}@rememberkin.demo`);
  }

  // 3. Family members
  const membersRes = await api('/members', { token: owner });
  const existing = new Set((membersRes.data?.members || []).map((m) => m.name));
  const me = (membersRes.data?.members || []).find((m) => m.name === 'Linh Nguyen');

  const addMember = async (payload, label) => {
    if (existing.has(payload.name)) { log(`member ${payload.name} exists — skipping`); return null; }
    const r = await api('/family/invite', { method: 'POST', token: owner, body: payload });
    if (!r.ok) { log(`WARN could not add ${label}:`, JSON.stringify(r.data)); return null; }
    log(`added ${label}`);
    return r.data.member?.id || r.data.member?.id;
  };

  const grandpa = await addMember({ name: 'Grandpa Minh', nickname: 'Ong Noi', birthDate: '1948-03-15', relationship: 'PARENT_OF', relatedTo: me?.id }, 'Grandpa Minh (parent of Linh)');
  await addMember({ name: 'Grandma Hoa', nickname: 'Ba Noi', birthDate: '1952-08-22', ...(grandpa ? { relationship: 'SPOUSE_OF', relatedTo: grandpa } : {}) }, 'Grandma Hoa (spouse of Minh)');
  await addMember({ name: 'An Nguyen', birthDate: '2008-04-12', ...(me ? { relationship: 'SIBLING_OF', relatedTo: me.id } : {}) }, 'An Nguyen');

  // Complete the relationship graph (the invite endpoint only takes one
  // relationship per member): both grandparents parent Linh AND An.
  const membersNow = ((await api('/members', { token: owner })).data?.members || []);
  const idOf = Object.fromEntries(membersNow.map((m) => [m.name, m.id]));
  const relate = async (fromName, type, toName) => {
    const from = idOf[fromName];
    const to = idOf[toName];
    if (!from || !to) return;
    const r = await api(`/members/${from}/relationships`, { method: 'POST', token: owner, body: { relatedTo: to, type } });
    log(r.ok ? `related: ${fromName} ${type} ${toName}` : `relate ${fromName}->${toName}: ${r.data?.error?.message || 'exists'}`);
  };
  await relate('Grandma Hoa', 'PARENT_OF', 'Linh Nguyen');
  await relate('Grandma Hoa', 'PARENT_OF', 'An Nguyen');
  await relate('Grandpa Minh', 'PARENT_OF', 'An Nguyen');

  // Judges join the family as registered members
  for (const j of judges) {
    const r = await api('/family/invite', { method: 'POST', token: owner, body: { name: j.persona, email: `${j.login}@rememberkin.demo` } });
    log(r.ok ? `judge ${j.login} attached as ${j.persona}` : `judge ${j.login}: ${r.data?.error?.message || 'already in family'}`);
  }

  // Rename any legacy "Judge N" members to their personas and set birthdays
  const membersAfter = ((await api('/members', { token: owner })).data?.members || []);
  for (const [i, j] of judges.entries()) {
    const legacy = membersAfter.find((m) => m.name === `Judge ${i + 1}`);
    if (legacy) {
      const r = await api(`/members/${legacy.id}`, { method: 'PUT', token: owner, body: { name: j.persona, birthDate: j.birthDate } });
      log(r.ok ? `renamed Judge ${i + 1} -> ${j.persona}` : `WARN rename failed: ${JSON.stringify(r.data).slice(0, 100)}`);
    }
  }

  // Wire judge personas into the tree: Tuan is Linh's brother, Mai his wife, Duc their son
  const membersFinal = ((await api('/members', { token: owner })).data?.members || []);
  const pid = Object.fromEntries(membersFinal.map((m) => [m.name, m.id]));
  const rel = async (a, type, b) => {
    if (!pid[a] || !pid[b]) return;
    const r = await api(`/members/${pid[a]}/relationships`, { method: 'POST', token: owner, body: { relatedTo: pid[b], type } });
    log(r.ok ? `related: ${a} ${type} ${b}` : `relate ${a}->${b}: ${r.data?.error?.message || 'exists'}`);
  };
  await rel('Grandpa Minh', 'PARENT_OF', 'Uncle Tuan');
  await rel('Grandma Hoa', 'PARENT_OF', 'Uncle Tuan');
  await rel('Uncle Tuan', 'SIBLING_OF', 'Linh Nguyen');
  await rel('Uncle Tuan', 'SPOUSE_OF', 'Aunt Mai');
  await rel('Uncle Tuan', 'PARENT_OF', 'Cousin Duc');
  await rel('Aunt Mai', 'PARENT_OF', 'Cousin Duc');

  // 4. Stories (AI enrichment runs on creation)
  const stories = [
    'Grandpa Minh grew up in a small fishing village near Hoi An. Every summer he made bamboo kites for all the neighborhood kids, and they would fly them together on the beach at sunset.',
    'Grandma Hoa is famous for her pho recipe, passed down from her mother. Every Lunar New Year the whole family gathers in her kitchen, and she insists the secret is charring the ginger just right.',
    'When An was ten, Grandpa Minh taught him to fish at dawn. An caught nothing for three hours, then landed the biggest fish of the day. Grandpa still tells everyone he "supervised".',
  ];
  const meNow = ((await api('/members', { token: owner })).data?.members || []).find((m) => m.name === 'Linh Nguyen');
  const existingStories = await api('/stories', { token: owner });
  if ((existingStories.data?.stories || []).length >= stories.length) {
    log('stories already seeded — skipping');
  } else {
    for (const content of stories) {
      const r = await api('/stories', { method: 'POST', token: owner, body: { content, authorId: meNow?.id } });
      log(r.ok ? `story added: "${content.slice(0, 40)}..."` : `WARN story failed: ${JSON.stringify(r.data)}`);
    }
  }

  // 5. Events
  const members2 = await api('/members', { token: owner });
  const byName = Object.fromEntries((members2.data?.members || []).map((m) => [m.name, m.id]));
  const events = [
    { type: 'birthday', title: "Grandpa Minh's Birthday", date: '2027-03-15', recurring: true, involves: [byName['Grandpa Minh']].filter(Boolean) },
    { type: 'custom', title: 'Family Reunion in Da Nang', date: '2026-12-20', recurring: false, involves: [] },
  ];
  const existingEvents = await api('/events?days=400', { token: owner });
  const eventTitles = new Set((existingEvents.data?.events || []).map((e) => e.title));
  for (const ev of events) {
    if (eventTitles.has(ev.title)) { log(`event "${ev.title}" exists — skipping`); continue; }
    const r = await api('/events', { method: 'POST', token: owner, body: ev });
    log(r.ok ? `event added: ${ev.title}` : `WARN event failed: ${JSON.stringify(r.data)}`);
  }

  // 6. Chat a few facts so the 4-layer memory dashboard starts populated
  //    (memory extraction is chat-driven; stories alone don't feed the layers)
  const chatFacts = [
    'Grandpa Minh told me he grew up in a small fishing village near Hoi An and loves making bamboo kites every summer.',
    "Grandma Hoa's birthday is August 22nd, and her pho recipe secret is charring the ginger just right.",
    'An loves fishing at dawn with Grandpa Minh — they go every Sunday morning during the holidays.',
  ];
  const sessionId = 'seed-session-0001';
  for (const message of chatFacts) {
    const r = await api('/chat', { method: 'POST', token: owner, body: { message, sessionId, history: [] } });
    log(r.ok ? `chatted: "${message.slice(0, 45)}..."` : `WARN chat failed: ${JSON.stringify(r.data).slice(0, 120)}`);
  }
  // Extraction runs async after each reply — give it a moment, then consolidate
  log('waiting 15s for memory extraction...');
  await new Promise((r) => setTimeout(r, 15000));
  const consolidated = await api('/memory-dashboard/consolidate', { method: 'POST', token: owner, body: {} });
  log(consolidated.ok ? 'memory consolidation triggered' : `WARN consolidate failed: ${JSON.stringify(consolidated.data).slice(0, 120)}`);

  // 7. Repeat a routine across separate sessions so the PROCEDURAL layer
  //    learns a pattern (detection needs the same fact in >= 2 episodes)
  const routine = 'An goes fishing with Grandpa Minh every Sunday morning.';
  for (const s of ['seed-session-0002', 'seed-session-0003']) {
    const r = await api('/chat', { method: 'POST', token: owner, body: { message: routine, sessionId: s, history: [] } });
    log(r.ok ? `chatted routine (${s})` : `WARN routine chat failed: ${JSON.stringify(r.data).slice(0, 100)}`);
  }
  log('waiting 12s for extraction...');
  await new Promise((r) => setTimeout(r, 12000));
  const pat = await api('/memory-dashboard/detect-patterns', { method: 'POST', token: owner, body: {} });
  log('pattern detection: ' + JSON.stringify(pat.data).slice(0, 160));

  log('');
  log('Seed complete. Demo accounts (password: ' + PASSWORD + '):');
  log('  demo@rememberkin.demo    — family owner');
  judges.forEach((j) => log(`  ${j}@rememberkin.demo  — judge account (member of the family)`));
  log('');
  log('Now set ALLOW_REGISTRATION=false (backend) and VITE_ALLOW_REGISTRATION=false (frontend build) for the public deployment.');
}

main().catch((e) => { console.error('[seed] FAILED:', e.message); process.exit(1); });
