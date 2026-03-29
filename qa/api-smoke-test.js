#!/usr/bin/env node
/**
 * SM Torneio — API Smoke Test
 * Executa todos os endpoints críticos e reporta PASS / FAIL.
 *
 * Uso:
 *   node qa/api-smoke-test.js
 *   node qa/api-smoke-test.js --base http://myserver.com
 *
 * Retorna exit code 0 se tudo passou, 1 se houve falhas.
 */

const http = require('http');
const https = require('https');

const BASE = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1]
  || process.env.QA_BASE_URL
  || 'http://localhost:3001';

const MASTER_EMAIL    = process.env.MASTER_EMAIL    || 'admin@smtorneio.com';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin123';
const TEST_SLUG       = process.env.TEST_SLUG        || 'demo';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const lib = url.protocol === 'https:' ? https : http;
    const json = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json ? { 'Content-Length': Buffer.byteLength(json) } : {}),
    };
    const req = lib.request({ hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (json) req.write(json);
    req.end();
  });
}

const get  = (path, token)       => request('GET',  path, null, token);
const post = (path, body, token) => request('POST', path, body, token);
const put  = (path, body, token) => request('PUT',  path, body, token);

// ── Test runner ───────────────────────────────────────────────────────────────

const results = [];
let token = null;

function test(id, name, fn) {
  results.push({ id, name, fn });
}

async function runAll() {
  console.log(`\n🏓 SM Torneio API Smoke Test`);
  console.log(`   Base: ${BASE}`);
  console.log(`   Slug: ${TEST_SLUG}`);
  console.log(`   Time: ${new Date().toLocaleString('pt-BR')}\n`);

  let pass = 0, fail = 0, skip = 0;
  const failures = [];

  for (const t of results) {
    let status = 'PASS';
    let detail = '';
    try {
      await t.fn();
      pass++;
    } catch (err) {
      status = 'FAIL';
      detail = err.message;
      fail++;
      failures.push({ id: t.id, name: t.name, error: detail });
    }
    const icon = status === 'PASS' ? '✅' : '❌';
    const line = `${icon} [${t.id}] ${t.name}${detail ? `\n       ↳ ${detail}` : ''}`;
    console.log(line);
  }

  console.log(`\n─────────────────────────────`);
  console.log(`📊 Resultado: ${pass} PASS  ${fail} FAIL  ${skip} SKIP`);

  if (failures.length) {
    console.log(`\n❌ Falhas:\n`);
    failures.forEach((f) => console.log(`  [${f.id}] ${f.name}\n      ${f.error}`));
  } else {
    console.log(`\n🎉 Todos os testes passaram!`);
  }

  console.log('');
  process.exit(fail > 0 ? 1 : 0);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── Test definitions ──────────────────────────────────────────────────────────

// 10.1 Health
test('10.1', 'GET /api/health → 200 {status:"ok"}', async () => {
  const r = await get('/api/health');
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.body?.status === 'ok', `body.status = ${r.body?.status}`);
});

// 10.2 List tournaments
test('10.2', 'GET /api/tournaments → 200 array', async () => {
  const r = await get('/api/tournaments');
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body), `não é array: ${JSON.stringify(r.body)}`);
  assert(r.body.length > 0, 'array vazio');
});

// 10.3 Single tournament
test('10.3', `GET /api/tournaments/${TEST_SLUG} → 200`, async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}`);
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.body?.slug === TEST_SLUG, `slug errado: ${r.body?.slug}`);
});

// 10.4 Settings grouped
test('10.4', 'GET /api/settings → 200 objeto agrupado', async () => {
  const r = await get('/api/settings');
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(typeof r.body === 'object' && !Array.isArray(r.body), 'não é objeto');
  const categories = Object.keys(r.body);
  assert(categories.length >= 7, `apenas ${categories.length} categorias, esperado >= 7`);
  const required = ['pontuacao','bonificacao','descarte','formato_partida','inscricoes','quadras','financeiro'];
  for (const cat of required) {
    assert(r.body[cat], `categoria "${cat}" ausente`);
  }
});

// 10.5 Settings flat
test('10.5', 'GET /api/settings/flat → 200 array com 42+ settings', async () => {
  const r = await get('/api/settings/flat');
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body), 'não é array');
  assert(r.body.length >= 42, `apenas ${r.body.length} settings, esperado >= 42`);
});

// 10.6 Login OK
test('10.6', `POST /api/auth/login (${MASTER_EMAIL}) → 200 + token`, async () => {
  const r = await post('/api/auth/login', { email: MASTER_EMAIL, password: MASTER_PASSWORD });
  assert(r.status === 200, `HTTP ${r.status} — body: ${JSON.stringify(r.body)}`);
  assert(r.body?.token, 'token ausente na resposta');
  token = r.body.token; // salva para os testes seguintes
});

// 10.7 Login wrong password
test('10.7', 'POST /api/auth/login (senha errada) → 401', async () => {
  const r = await post('/api/auth/login', { email: MASTER_EMAIL, password: 'senha_errada_xyz' });
  assert(r.status === 401, `HTTP ${r.status} esperado 401`);
});

// 10.8 GET /me sem token
test('10.8', 'GET /api/auth/me sem token → 401', async () => {
  const r = await get('/api/auth/me');
  assert(r.status === 401, `HTTP ${r.status} esperado 401`);
});

// 10.9 Participants
test('10.9', `GET /api/tournaments/${TEST_SLUG}/participants → 200 array`, async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/participants`);
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body), 'não é array');
});

// 10.10 Rounds
test('10.10', `GET /api/tournaments/${TEST_SLUG}/rounds → 200 array`, async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/rounds`);
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body), 'não é array');
});

// 10.11 Standings Feminino
test('10.11', `GET /api/tournaments/${TEST_SLUG}/standings/F → 200 array`, async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/standings/F`);
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body), 'não é array');
});

// 10.12 Standings Masculino
test('10.12', `GET /api/tournaments/${TEST_SLUG}/standings/M → 200 array`, async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/standings/M`);
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body), 'não é array');
});

// 10.13 Bulk settings sem auth → 401
test('10.13', 'PUT /api/settings/bulk sem auth → 401', async () => {
  const r = await put('/api/settings/bulk', { settings: [{ key: 'games_to_win_set', value: '5' }] });
  assert(r.status === 401, `HTTP ${r.status} esperado 401`);
});

// 10.14 Bulk settings com auth → 200
test('10.14', 'PUT /api/settings/bulk com auth → 200', async () => {
  assert(token, 'token não disponível — o teste 10.6 falhou?');
  const r = await put('/api/settings/bulk', { settings: [{ key: 'games_to_win_set', value: '5' }] }, token);
  assert(r.status === 200, `HTTP ${r.status} — body: ${JSON.stringify(r.body)}`);
});

// 11.x — Lógica de pontuação via standings
test('11.1-8', 'Standings: points_valid = raw − discard + bonus − penalty', async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/standings/F`);
  assert(r.status === 200, `HTTP ${r.status}`);
  for (const s of r.body) {
    const expected = s.pointsRaw - s.pointsDiscard + s.pointsBonus - s.pointsPenalty;
    assert(
      s.pointsValid === expected,
      `Participante ${s.name}: pointsValid=${s.pointsValid} mas esperado ${expected} (raw=${s.pointsRaw} disc=${s.pointsDiscard} bonus=${s.pointsBonus} pen=${s.pointsPenalty})`
    );
  }
});

// Settings integrity: check key values match seeded defaults
test('12.7', 'Settings: valores padrão corretos no banco', async () => {
  const r = await get('/api/settings/flat');
  assert(r.status === 200, `HTTP ${r.status}`);
  const map = {};
  for (const s of r.body) map[s.key] = s.value;

  const checks = [
    ['points_1st_place',          '100'],
    ['points_sit_out_drawn',      '80'],
    ['points_sit_out_volunteer',  '60'],
    ['bonus_full_attendance',     '20'],
    ['discard_starts_after_round','5'],
    ['games_to_win_set',          '5'],
  ];
  for (const [key, expected] of checks) {
    assert(map[key] !== undefined, `Setting "${key}" ausente`);
    assert(map[key] === expected, `Setting "${key}": valor=${map[key]}, esperado=${expected}`);
  }
});

// ── Run ───────────────────────────────────────────────────────────────────────
runAll().catch((err) => {
  console.error('Erro fatal no runner:', err);
  process.exit(1);
});
