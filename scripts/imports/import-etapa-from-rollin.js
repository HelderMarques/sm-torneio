#!/usr/bin/env node
/**
 * Importa uma etapa a partir dos dados públicos do tenis.rollin.com.br
 * (Firestore do projeto secosmolhados-25ee0).
 *
 * Uso:
 *   node scripts/imports/import-etapa-from-rollin.js [--month=YYYY-MM] [--mode=apply|dry-run]
 *
 * Sem --month: usa a etapa mais recente encontrada em apuracoes.
 *
 * Variáveis de ambiente (carregadas de scripts/.env.import se presente):
 *   API_BASE_URL     (default https://www.sm-ttc.com.br/api)
 *   TOURNAMENT_SLUG  (default 2026)
 *   ADMIN_EMAIL      (obrigatório em apply)
 *   ADMIN_PASSWORD   (obrigatório em apply)
 *
 * Fonte dos dados (Firestore, coleções públicas):
 *   apuracoes/{sessionTimestamp}_{F|M}  — jogos da etapa (resultados[])
 *   drawHistory/*                       — duplas formadas por sessão
 *   pontosSorteio/{ano}_{F|M}           — sorteios do ano por gênero
 *
 * Convenção de rótulo de quadra (para a API do SM Torneio):
 *   Feminino:  chave 1 → "Estádio"
 *   Masculino: chave 1 → "Quadra 4", chave 2 → "Quadra 5"
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.import');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=') || true];
}));
const MODE = (args.mode || 'apply').toLowerCase();
const TARGET_MONTH = args.month || null;
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.sm-ttc.com.br/api';
const TOURNAMENT_SLUG = process.env.TOURNAMENT_SLUG || '2026';

const FIREBASE_PROJECT = 'secosmolhados-25ee0';
// API key pública embutida no bundle da SPA; leitura dessas coleções é permitida sem auth.
const FIREBASE_API_KEY = 'AIzaSyDOuUHVWrNogEFlv_BTOXup1GajHkaN7FE';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ============================================================================
// FIRESTORE REST helpers
// ============================================================================

function unwrap(field) {
  if (!field) return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('nullValue' in field) return null;
  if ('timestampValue' in field) return field.timestampValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(unwrap);
  if ('mapValue' in field) return unwrapFields(field.mapValue.fields);
  return undefined;
}
function unwrapFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = unwrap(v);
  return out;
}
function unwrapDoc(doc) {
  return { _name: doc.name.split('/').pop(), ...unwrapFields(doc.fields || {}) };
}

async function firestoreGet(docPath) {
  const url = `${FIRESTORE_BASE}/${docPath}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${docPath} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function firestoreList(collection, { pageSize = 300 } = {}) {
  const all = [];
  let pageToken = null;
  do {
    const q = new URLSearchParams({ key: FIREBASE_API_KEY, pageSize: String(pageSize) });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${FIRESTORE_BASE}/${collection}?${q}`);
    const text = await res.text();
    if (!res.ok) throw new Error(`LIST ${collection} → ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text);
    for (const d of json.documents || []) all.push(unwrapDoc(d));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return all;
}

// ============================================================================
// SM Torneio API
// ============================================================================

async function api(method, p, { token, body } = {}) {
  const url = `${API_BASE_URL}${p}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${p} → ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

// ============================================================================
// Domain helpers
// ============================================================================

function courtLabelFor(gender, chave) {
  if (gender === 'F') return 'Estádio';
  if (chave === 1) return 'Quadra 4';
  if (chave === 2) return 'Quadra 5';
  return `Chave ${chave}`;
}

function canonPairKey(a, b) {
  return [a, b].sort().join('|');
}

// Mesmo algoritmo do backend do SM Torneio.
function computeDoubleLossPositions(n, games) {
  const losses = new Array(n).fill(0);
  const eliminationOrder = [];
  for (const { pairAIndex: a, pairBIndex: b, scoreA, scoreB } of games) {
    if (a == null || b == null || scoreA === scoreB) continue;
    const loser = scoreA < scoreB ? a : b;
    losses[loser]++;
    if (losses[loser] >= 2 && !eliminationOrder.includes(loser)) eliminationOrder.push(loser);
  }
  const winners = Array.from({ length: n }, (_, i) => i).filter(i => !eliminationOrder.includes(i));
  const positionMap = new Array(n).fill(null);
  let pos = 1;
  winners.forEach(i => { positionMap[i] = pos++; });
  for (let i = eliminationOrder.length - 1; i >= 0; i--) positionMap[eliminationOrder[i]] = pos++;
  return positionMap;
}

const ORDINAL = { 1: 'CAMPEÃO', 2: 'VICE-CAMPEÃO', 3: '3º LUGAR', 4: '4º LUGAR', 5: '5º LUGAR', 6: '6º LUGAR', 7: '7º LUGAR', 8: '8º LUGAR' };

module.exports = { unwrapDoc, unwrapFields, courtLabelFor, computeDoubleLossPositions };
if (require.main !== module) return;

// ============================================================================
// MAIN
// ============================================================================

(async () => {
  const warnings = [];
  const errors = [];

  console.log(`Modo: ${MODE}`);
  console.log(`Fonte: Firestore ${FIREBASE_PROJECT}`);
  console.log(`API SM Torneio: ${API_BASE_URL}`);
  console.log(`Torneio: ${TOURNAMENT_SLUG}`);
  if (TARGET_MONTH) console.log(`Mês solicitado: ${TARGET_MONTH}`);

  // ---- 1. Descobrir etapas disponíveis ----
  console.log('\n[1/7] Listando etapas em apuracoes…');
  const apuracoes = await firestoreList('apuracoes');
  const byMonth = {};
  for (const a of apuracoes) {
    if (!a.sessionTimestamp || !a.gender) continue;
    const month = a.sessionTimestamp.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { F: null, M: null };
    const prev = byMonth[month][a.gender];
    if (!prev || a.sessionTimestamp > prev.sessionTimestamp) byMonth[month][a.gender] = a;
  }
  const availableMonths = Object.keys(byMonth).sort();
  if (!availableMonths.length) {
    console.error('❌ Nenhuma etapa encontrada em apuracoes.');
    process.exit(1);
  }
  const targetMonth = TARGET_MONTH || availableMonths[availableMonths.length - 1];
  const target = byMonth[targetMonth];
  if (!target) {
    console.error(`❌ Não há etapa em apuracoes para ${targetMonth}. Meses disponíveis: ${availableMonths.join(', ')}`);
    process.exit(1);
  }
  const sessionF = target.F;
  const sessionM = target.M;
  console.log(`  Mês-alvo: ${targetMonth}`);
  if (sessionF) console.log(`  F: sessionTimestamp=${sessionF.sessionTimestamp}, jogos=${sessionF.resultados?.length || 0}`);
  else console.log(`  F: nenhuma sessão encontrada.`);
  if (sessionM) console.log(`  M: sessionTimestamp=${sessionM.sessionTimestamp}, jogos=${sessionM.resultados?.length || 0}`);
  else console.log(`  M: nenhuma sessão encontrada.`);

  const referenceSession = sessionF || sessionM;
  const dateISO = referenceSession.sessionTimestamp.slice(0, 10);
  const [yy, mm, dd] = dateISO.split('-');
  const dateBR = `${dd}/${mm}/${yy}`;
  console.log(`  Data da etapa: ${dateISO}`);

  // ---- 2. Buscar duplas em drawHistory ----
  console.log('\n[2/7] Buscando duplas em drawHistory…');
  const drawHistoryAll = await firestoreList('drawHistory');
  const duplasBySession = {};
  for (const dh of drawHistoryAll) {
    if (!dh.sessionTimestamp || !dh.player1 || !dh.player2) continue;
    const k = `${dh.sessionTimestamp}_${dh.gender}`;
    if (!duplasBySession[k]) duplasBySession[k] = [];
    duplasBySession[k].push({ player1: dh.player1, player2: dh.player2 });
  }
  const duplasF = sessionF ? (duplasBySession[`${sessionF.sessionTimestamp}_F`] || []) : [];
  const duplasM = sessionM ? (duplasBySession[`${sessionM.sessionTimestamp}_M`] || []) : [];
  console.log(`  F: ${duplasF.length} duplas | M: ${duplasM.length} duplas`);

  // ---- 3. Buscar sorteios em pontosSorteio ----
  console.log('\n[3/7] Buscando sorteios em pontosSorteio…');
  async function loadSorteios(gender) {
    const doc = await firestoreGet(`pontosSorteio/${yy}_${gender}`);
    if (!doc || !doc.fields) return [];
    const parsed = unwrapFields(doc.fields);
    return (parsed.entries || [])
      .filter(e => e.date === dateBR)
      .map(e => ({
        name: e.player,
        group: gender,
        points: e.pontos,
        type: e.pontos === 60 ? 'sorteio_a_pedido' : 'sorteio',
      }));
  }
  const sorteados = [
    ...(sessionF ? await loadSorteios('F') : []),
    ...(sessionM ? await loadSorteios('M') : []),
  ];
  console.log(`  Sorteios: ${sorteados.length} (${sorteados.map(s => `${s.name}[${s.group}]`).join(', ') || '—'})`);

  // ---- 4. Resolver nomes contra a API do SM Torneio ----
  console.log('\n[4/7] Resolvendo nomes na API SM Torneio…');
  const participants = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/participants`);
  const byNameLower = new Map();
  for (const p of participants) if (p.active) byNameLower.set(p.name.toLowerCase().trim(), p);
  const noAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function resolveName(name) {
    if (!name) return null;
    const direct = byNameLower.get(name.toLowerCase().trim());
    if (direct) return direct;
    const target = noAccents(name);
    for (const p of participants) if (p.active && noAccents(p.name) === target) return p;
    return null;
  }

  const resolveDupla = (d, gender) => {
    const p1 = resolveName(d.player1), p2 = resolveName(d.player2);
    if (!p1) errors.push(`${gender}: jogador "${d.player1}" não encontrado no torneio.`);
    if (!p2) errors.push(`${gender}: jogador "${d.player2}" não encontrado no torneio.`);
    if (p1 && p1.group !== gender) errors.push(`${gender}: "${p1.name}" está no grupo ${p1.group} no DB.`);
    if (p2 && p2.group !== gender) errors.push(`${gender}: "${p2.name}" está no grupo ${p2.group} no DB.`);
    return { playerA: p1?.name || d.player1, playerB: p2?.name || d.player2, orig: d };
  };
  const dfR = duplasF.map(d => resolveDupla(d, 'F'));
  const dmR = duplasM.map(d => resolveDupla(d, 'M'));
  const sR = sorteados.map(s => {
    const p = resolveName(s.name);
    if (!p) errors.push(`Sorteio: "${s.name}" não encontrado.`);
    else if (p.group !== s.group) errors.push(`Sorteio "${s.name}": rollin=${s.group}, DB=${p.group}.`);
    return { ...s, resolved: p, name: p?.name || s.name };
  });

  // ---- 5. Montar courts a partir de session.resultados ----
  console.log('\n[5/7] Montando quadras…');
  function buildCourts(session, resolvedDuplas, gender) {
    if (!session || !Array.isArray(session.resultados) || !session.resultados.length) return [];
    const canonMap = new Map();
    resolvedDuplas.forEach((d, i) => canonMap.set(canonPairKey(d.orig.player1, d.orig.player2), i));

    const gamesByChave = {};
    for (const r of session.resultados) {
      const chave = r.chave || 1;
      if (!gamesByChave[chave]) gamesByChave[chave] = [];
      gamesByChave[chave].push(r);
    }
    const courts = [];
    for (const chaveStr of Object.keys(gamesByChave).sort((a, b) => Number(a) - Number(b))) {
      const chave = Number(chaveStr);
      const games = gamesByChave[chave];
      const label = courtLabelFor(gender, chave);

      const seenKeys = [];
      const idxOfKey = new Map();
      const addKey = (k) => {
        if (idxOfKey.has(k)) return;
        idxOfKey.set(k, seenKeys.length);
        seenKeys.push(k);
      };
      for (const g of games) { addKey(g.dupla1Key); addKey(g.dupla2Key); }

      let brokeSomePair = false;
      const pairs = seenKeys.map(k => {
        const [a, b] = k.split('|');
        const canon = canonPairKey(a, b);
        const origIdx = canonMap.get(canon);
        if (origIdx == null) {
          errors.push(`${label}: dupla "${k}" (rollin) não encontrada em drawHistory da mesma sessão.`);
          brokeSomePair = true;
          return null;
        }
        const rd = resolvedDuplas[origIdx];
        return { playerA: rd.playerA, playerB: rd.playerB };
      });
      if (brokeSomePair) continue;

      const gamesFmt = games.map(g => ({
        pairAIndex: idxOfKey.get(g.dupla1Key),
        pairBIndex: idxOfKey.get(g.dupla2Key),
        scoreA: g.games1,
        scoreB: g.games2,
      }));

      courts.push({ label, pairs, games: gamesFmt });
    }
    return courts;
  }
  const courtsByGroup = {
    F: buildCourts(sessionF, dfR, 'F'),
    M: buildCourts(sessionM, dmR, 'M'),
  };

  for (const g of ['F', 'M']) {
    if (!courtsByGroup[g].length) continue;
    console.log(`  ${g === 'F' ? 'FEMININO' : 'MASCULINO'}:`);
    for (const c of courtsByGroup[g]) {
      const positions = computeDoubleLossPositions(c.pairs.length, c.games);
      console.log(`    ${c.label} — ${c.pairs.length} duplas:`);
      c.pairs.forEach((p, i) => {
        const pos = positions[i];
        const rotulo = ORDINAL[pos] || `${pos}º LUGAR`;
        console.log(`      ${p.playerA} & ${p.playerB}  →  ${rotulo}`);
      });
    }
  }
  if (sR.length) {
    console.log('  SORTEIOS:');
    for (const s of sR) console.log(`    ${s.name} (${s.group}, ${s.type}, ${s.points || '?'} pts)`);
  }

  // ---- 6. Localizar etapa-alvo no SM Torneio ----
  console.log('\n[6/7] Localizando etapa-alvo no SM Torneio…');
  const rounds = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/rounds`);
  const roundF = rounds.find(r => r.group === 'F' && r.date.startsWith(targetMonth));
  const roundM = rounds.find(r => r.group === 'M' && r.date.startsWith(targetMonth));
  const hasF = courtsByGroup.F.length > 0 || sR.some(s => s.group === 'F');
  const hasM = courtsByGroup.M.length > 0 || sR.some(s => s.group === 'M');
  if (hasF && !roundF) errors.push(`Não encontrei etapa Feminina no SM Torneio para o mês ${targetMonth}.`);
  if (hasM && !roundM) errors.push(`Não encontrei etapa Masculina no SM Torneio para o mês ${targetMonth}.`);
  if (roundF) {
    console.log(`  F: ${roundF.id} (data atual=${roundF.date}, status=${roundF.status})`);
    if (roundF.date !== dateISO) warnings.push(`Data F será atualizada de ${roundF.date} para ${dateISO}.`);
    if (roundF.status === 'COMPLETED') warnings.push(`Etapa F já está COMPLETED — court-results vai SUBSTITUIR resultados existentes.`);
  }
  if (roundM) {
    console.log(`  M: ${roundM.id} (data atual=${roundM.date}, status=${roundM.status})`);
    if (roundM.date !== dateISO) warnings.push(`Data M será atualizada de ${roundM.date} para ${dateISO}.`);
    if (roundM.status === 'COMPLETED') warnings.push(`Etapa M já está COMPLETED — court-results vai SUBSTITUIR resultados existentes.`);
  }

  if (errors.length) {
    console.error('\n❌ ERROS de validação:');
    for (const e of errors) console.error(`  - ${e}`);
    console.error('\nNada foi gravado. Corrija e rode de novo.');
    process.exit(1);
  }
  if (warnings.length) {
    console.log('\n⚠ AVISOS:');
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (MODE !== 'apply') {
    console.log('\n✅ DRY-RUN concluído. Para aplicar, rode com --mode=apply.');
    return;
  }

  // ---- 7. Apply ----
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('\n❌ ADMIN_EMAIL e ADMIN_PASSWORD obrigatórios em modo apply.');
    console.error('   Configure-os em scripts/.env.import (gitignored) ou exporte como variáveis.');
    process.exit(1);
  }

  console.log('\n[7/7] Login admin…');
  const { token } = await api('POST', '/auth/login', { body: { email, password } });
  console.log('  ✓ token obtido');

  if (roundF && roundF.date !== dateISO) {
    await api('PUT', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundF.id}`, { token, body: { date: dateISO } });
    console.log(`  ✓ data F atualizada para ${dateISO}`);
  }
  if (roundM && roundM.date !== dateISO) {
    await api('PUT', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundM.id}`, { token, body: { date: dateISO } });
    console.log(`  ✓ data M atualizada para ${dateISO}`);
  }

  async function submitGroup(group, round) {
    if (!round) return null;
    const courts = courtsByGroup[group].map(c => ({
      label: c.label,
      pairs: c.pairs.map(p => ({ playerA: p.playerA, playerB: p.playerB })),
      games: c.games,
    }));
    const sortGroup = sR.filter(s => s.group === group).map(s => ({
      name: s.name,
      type: s.type,
    }));
    const r = await api('POST', `/tournaments/${TOURNAMENT_SLUG}/rounds/${round.id}/court-results`, {
      token, body: { courts, sorteados: sortGroup },
    });
    console.log(`  ✓ ${group}: ${r.saved} resultados, ${r.absents.length} faltas: ${r.absents.join(', ') || '(nenhuma)'}`);
    return r;
  }

  console.log('\nSubmetendo court-results…');
  await submitGroup('F', roundF);
  await submitGroup('M', roundM);

  console.log('\n[verificação] Lendo standings após import…');
  if (roundF) {
    const s = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/standings/F`);
    console.log(`  Feminino: ${s.length} jogadoras. Top 3: ${s.slice(0, 3).map(x => `${x.position}º ${x.name} (${x.pointsValid}pts)`).join(', ')}`);
  }
  if (roundM) {
    const s = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/standings/M`);
    console.log(`  Masculino: ${s.length} jogadores. Top 3: ${s.slice(0, 3).map(x => `${x.position}º ${x.name} (${x.pointsValid}pts)`).join(', ')}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RELATÓRIO FINAL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Data da etapa: ${dateISO}`);
  console.log(`Quadras F: ${courtsByGroup.F.length} | Quadras M: ${courtsByGroup.M.length}`);
  console.log(`Sorteios: ${sR.length}`);
  if (warnings.length) {
    console.log('\nPontos de atenção:');
    for (const w of warnings) console.log(`  - ${w}`);
  } else {
    console.log('\n✅ Sem pontos de atenção.');
  }
  console.log('\n✅ APPLY concluído com sucesso.');
})().catch(err => {
  console.error('\n❌ ERRO inesperado:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
