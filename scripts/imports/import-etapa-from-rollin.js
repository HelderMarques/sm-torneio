#!/usr/bin/env node
/**
 * Importa uma etapa a partir dos dados públicos do tenis.rollin.com.br
 * (Supabase/PostgREST em supasm.rollin.com.br — migraram do Firestore em 10/2026).
 *
 * Uso:
 *   node scripts/imports/import-etapa-from-rollin.js [--month=YYYY-MM] [--mode=apply|dry-run]
 *                                                     [--extra-sorteio=Nome:Grupo:Pontos ...]
 *
 * Sem --month: usa a etapa mais recente encontrada em apuracoes.
 *
 * --extra-sorteio pode ser repetido. Útil quando o organizador ainda não registrou
 * um sorteio em pontos_sorteio. Grupo: F|M. Pontos: 80 (sorteio padrão) ou 60
 * (sorteio_a_pedido). Ex.: --extra-sorteio="Sandra:F:80".
 *
 * Variáveis de ambiente (carregadas de scripts/.env.import se presente):
 *   API_BASE_URL     (default https://www.sm-ttc.com.br/api)
 *   TOURNAMENT_SLUG  (default 2026)
 *   ADMIN_EMAIL      (obrigatório em apply)
 *   ADMIN_PASSWORD   (obrigatório em apply)
 *
 * Fonte dos dados (Supabase REST público):
 *   apuracoes      — id="{sessionTimestamp}_{F|M}", dados={date, gender, updatedAt, resultados[]}
 *   draw_history   — colunas player1, player2, gender, date, session_timestamp, timestamp
 *   pontos_sorteio — id="{ano}_{F|M}", dados={year, gender, entries[]}
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

// Argumentos: nomes podem repetir (--extra-sorteio=…), por isso coletamos em array.
const argList = process.argv.slice(2).map(a => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=') || true];
});
const args = Object.fromEntries(argList);
const MODE = (args.mode || 'apply').toLowerCase();
const TARGET_MONTH = args.month || null;
// --extra-sorteio="Nome:Grupo:Pontos" — pode repetir
const EXTRA_SORTEIOS = argList
  .filter(([k]) => k === 'extra-sorteio')
  .map(([, v]) => {
    const [name, group, points] = String(v).split(':');
    if (!name || (group !== 'F' && group !== 'M') || !/^\d+$/.test(points || '')) {
      console.error(`❌ --extra-sorteio inválido: "${v}". Esperado "Nome:Grupo(F|M):Pontos(60|80)".`);
      process.exit(2);
    }
    const pts = parseInt(points, 10);
    return { name, group, points: pts, type: pts === 60 ? 'sorteio_a_pedido' : 'sorteio' };
  });
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.sm-ttc.com.br/api';
const TOURNAMENT_SLUG = process.env.TOURNAMENT_SLUG || '2026';

// Anon key JWT pública do Supabase do rollin — embutida no bundle da SPA (role=anon).
// Leitura dessas tabelas é liberada sem auth.
const SUPABASE_BASE = 'https://supasm.rollin.com.br/rest/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODY1ODYzODgsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.Kc5jNggOW2yPl7X4l5i5bGVkpHHpo5TQd6wEF7VH24s';

// ============================================================================
// SUPABASE / PostgREST helpers
// ============================================================================

async function supabaseFetch(pathAndQuery) {
  const url = `${SUPABASE_BASE}/${pathAndQuery}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${pathAndQuery} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

async function supabaseList(table, { select = '*', pageSize = 1000, extra = '' } = {}) {
  const all = [];
  let offset = 0;
  while (true) {
    const q = `${table}?select=${select}&order=id.asc&offset=${offset}&limit=${pageSize}${extra ? '&' + extra : ''}`;
    const rows = await supabaseFetch(q);
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function supabaseGetById(table, id, { select = '*' } = {}) {
  const rows = await supabaseFetch(`${table}?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
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

module.exports = { courtLabelFor, computeDoubleLossPositions, supabaseFetch, supabaseList, supabaseGetById };
if (require.main !== module) return;

// ============================================================================
// MAIN
// ============================================================================

(async () => {
  const warnings = [];
  const errors = [];

  console.log(`Modo: ${MODE}`);
  console.log(`Fonte: Supabase ${SUPABASE_BASE}`);
  console.log(`API SM Torneio: ${API_BASE_URL}`);
  console.log(`Torneio: ${TOURNAMENT_SLUG}`);
  if (TARGET_MONTH) console.log(`Mês solicitado: ${TARGET_MONTH}`);

  // ---- 1. Descobrir etapas disponíveis ----
  console.log('\n[1/7] Listando etapas em apuracoes…');
  // id tem formato "{sessionTimestamp}_{gender}"; dados = { date, gender, resultados[], ... }
  const apuracoesRaw = await supabaseList('apuracoes', { select: 'id,dados' });
  const apuracoes = apuracoesRaw.map(row => {
    const [sessionTimestamp, gender] = row.id.split(/_([FM])$/).filter(Boolean);
    return {
      sessionTimestamp,
      gender,
      resultados: row.dados?.resultados || [],
      dadosDate: row.dados?.date || null,
    };
  });
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

  // ---- 2. Buscar duplas em draw_history ----
  console.log('\n[2/7] Buscando duplas em draw_history…');
  const drawHistoryAll = await supabaseList('draw_history', { select: 'player1,player2,gender,session_timestamp' });
  const duplasBySession = {};
  for (const dh of drawHistoryAll) {
    if (!dh.session_timestamp || !dh.player1 || !dh.player2) continue;
    const k = `${dh.session_timestamp}_${dh.gender}`;
    if (!duplasBySession[k]) duplasBySession[k] = [];
    duplasBySession[k].push({ player1: dh.player1, player2: dh.player2 });
  }
  const duplasF = sessionF ? (duplasBySession[`${sessionF.sessionTimestamp}_F`] || []) : [];
  const duplasM = sessionM ? (duplasBySession[`${sessionM.sessionTimestamp}_M`] || []) : [];
  console.log(`  F: ${duplasF.length} duplas | M: ${duplasM.length} duplas`);

  // ---- 3. Buscar sorteios em pontos_sorteio ----
  console.log('\n[3/7] Buscando sorteios em pontos_sorteio…');
  async function loadSorteios(gender) {
    const row = await supabaseGetById('pontos_sorteio', `${yy}_${gender}`, { select: 'dados' });
    if (!row || !row.dados) return [];
    return (row.dados.entries || [])
      .filter(e => e.date === dateBR)
      .map(e => ({
        name: e.player,
        group: gender,
        points: e.pontos,
        type: e.pontos === 60 ? 'sorteio_a_pedido' : 'sorteio',
      }));
  }
  const sorteiosDoRollin = [
    ...(sessionF ? await loadSorteios('F') : []),
    ...(sessionM ? await loadSorteios('M') : []),
  ];
  // Merge com --extra-sorteio, dedup por nome+grupo (CLI tem precedência).
  const sorteadosMap = new Map();
  for (const s of sorteiosDoRollin) sorteadosMap.set(`${s.group}|${s.name.toLowerCase()}`, s);
  for (const s of EXTRA_SORTEIOS) sorteadosMap.set(`${s.group}|${s.name.toLowerCase()}`, s);
  const sorteados = [...sorteadosMap.values()];
  if (EXTRA_SORTEIOS.length) {
    console.log(`  --extra-sorteio aplicados: ${EXTRA_SORTEIOS.map(s => `${s.name}[${s.group}, ${s.points}pts]`).join(', ')}`);
  }
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
      // Ordena os jogos por jogoId (sequência cronológica). O algoritmo double-loss
      // depende dessa ordem para determinar quem foi eliminado primeiro, e o
      // Supabase devolve o array sem ordenação definida.
      const games = gamesByChave[chave].slice().sort((a, b) => Number(a.jogoId) - Number(b.jogoId));
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
