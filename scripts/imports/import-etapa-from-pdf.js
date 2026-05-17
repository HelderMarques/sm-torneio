#!/usr/bin/env node
/**
 * Importa uma etapa do torneio a partir do PDF "Resultados jogos <Mês>_<Ano>.pdf".
 *
 * Uso:
 *   node scripts/imports/import-etapa-from-pdf.js --pdf=<caminho> [--mode=apply|dry-run]
 *
 * Variáveis de ambiente (carregadas de scripts/.env.import se presente):
 *   API_BASE_URL     (default https://www.sm-ttc.com.br/api)
 *   TOURNAMENT_SLUG  (default 2026)
 *   ADMIN_EMAIL      (obrigatório em apply)
 *   ADMIN_PASSWORD   (obrigatório em apply)
 *
 * O script:
 *   1. Carrega o PDF e extrai itens de texto com coordenadas (pdfjs-dist).
 *   2. Detecta data, duplas/jogos por quadra, sorteios e (implicitamente) faltas.
 *   3. Resolve participantes contra a API e infere grupo (F/M) por quadra.
 *   4. Valida que as posições computadas pelo algoritmo double-loss batem com PDF.
 *   5. Localiza a etapa-alvo (mesmo ano-mês da data do PDF).
 *   6. Em apply: faz login, atualiza a data se diferente, envia court-results F e M, lê standings.
 *   7. Imprime relatório final com pontos de atenção.
 */

const fs = require('fs');
const path = require('path');

// Carrega .env.import se existir
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
const PDF_PATH = args.pdf;
const MODE = (args.mode || 'apply').toLowerCase();
const API_BASE_URL = process.env.API_BASE_URL || 'https://www.sm-ttc.com.br/api';
const TOURNAMENT_SLUG = process.env.TOURNAMENT_SLUG || '2026';

if (!PDF_PATH) {
  console.error('ERRO: --pdf=<caminho> é obrigatório');
  process.exit(2);
}
if (!fs.existsSync(PDF_PATH)) {
  console.error(`ERRO: PDF não encontrado: ${PDF_PATH}`);
  process.exit(2);
}

// ============================================================================
// PDF EXTRACTION
// ============================================================================

async function extractItems(pdfPath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buf = fs.readFileSync(pdfPath);
  const data = new Uint8Array(buf);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const allItems = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str) continue;
      allItems.push({
        str: it.str,
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
        page: i,
      });
    }
  }
  return allItems;
}

// ============================================================================
// PARSING
// ============================================================================

function parsePdf(items) {
  // 1) Data do torneio
  const headerRow = items.filter(i => i.str.includes('Data do Torneio'));
  let date = null;
  if (headerRow.length) {
    const headerY = headerRow[0].y;
    const dateItem = items.find(i => Math.abs(i.y - headerY) <= 3 && /^\d{2}\/\d{2}\/\d{4}$/.test(i.str.trim()));
    if (dateItem) {
      const [d, m, y] = dateItem.str.trim().split('/');
      date = `${y}-${m}-${d}`;
    }
  }
  if (!date) throw new Error('Data do torneio não encontrada no PDF.');

  // 2) Group items by Y (rows)
  const byY = {};
  for (const it of items.filter(i => i.str.trim())) {
    const yKey = Math.round(it.y / 3) * 3;
    if (!byY[yKey]) byY[yKey] = [];
    byY[yKey].push(it);
  }

  // 3) Find header "1º Jogo" row to determine column boundaries dynamically
  let JOGO_X = [];
  for (const yKey of Object.keys(byY).map(Number).sort((a, b) => b - a)) {
    const row = byY[yKey].sort((a, b) => a.x - b.x);
    const jogosInRow = row.filter(i => /^\d+º Jogo$/.test(i.str.trim()));
    if (jogosInRow.length >= 5) {
      JOGO_X = jogosInRow.map(i => i.x).sort((a, b) => a - b);
      break;
    }
  }
  if (JOGO_X.length === 0) throw new Error('Não consegui detectar os cabeçalhos "Nº Jogo" no PDF.');

  // 4) Parse pair rows: rows with a label like "6A", "7B", "8C"
  const pairRows = [];
  for (const yKey of Object.keys(byY).map(Number).sort((a, b) => b - a)) {
    const row = byY[yKey].sort((a, b) => a.x - b.x);
    const labelItem = row.find(i => /^(\d[A-F])$/.test(i.str.trim()));
    if (!labelItem) continue;

    const literalXs = row.filter(i => i.str.trim().toLowerCase() === 'x');
    const digits = row.filter(i => /^\d+$/.test(i.str.trim()));
    const results = row.filter(i => /^[VD]$/.test(i.str.trim()));
    const posItem = row.find(i => i.x >= 700);
    const position = posItem?.str.trim();

    const games = [];
    for (const xItem of literalXs) {
      const before = digits.filter(d => d.x < xItem.x && d.x >= xItem.x - 15).pop();
      const after  = digits.find  (d => d.x > xItem.x && d.x <= xItem.x + 15);
      if (!before || !after) continue;
      const resItem = results.find(r => r.x > after.x && r.x <= after.x + 20);
      let jogo = -1;
      for (let i = JOGO_X.length - 1; i >= 0; i--) {
        if (before.x >= JOGO_X[i] - 5) { jogo = i + 1; break; }
      }
      games.push({
        jogo,
        scoreA: parseInt(before.str, 10),
        scoreB: parseInt(after.str, 10),
        result: resItem?.str.trim() || null,
      });
    }
    games.sort((a, b) => a.jogo - b.jogo);

    // Player names: 2 names in the "Nome" column (x ≈ 50), at y just above and just below this game row
    const namesNearby = items
      .filter(i => i.x >= 35 && i.x <= 75 && Math.abs(i.y - yKey) <= 8)
      .filter(i => /^[A-Za-zÀ-ú][A-Za-zÀ-ú \-']+$/.test(i.str.trim()))
      .sort((a, b) => b.y - a.y);
    const playerA = namesNearby[0]?.str.trim();
    const playerB = namesNearby[1]?.str.trim();

    pairRows.push({
      y: yKey,
      label: labelItem.str.trim(),
      games,
      position,
      playerA,
      playerB,
    });
  }

  // 5) Sorteios: rows containing "S O R T E I O" letters
  const sorteioYs = new Set();
  for (const yKey of Object.keys(byY).map(Number)) {
    const row = byY[yKey];
    const text = row.map(i => i.str).join(' ');
    if (text.includes('S O R T E I O')) sorteioYs.add(yKey);
  }
  const sorteados = [];
  for (const yKey of sorteioYs) {
    const row = byY[yKey].sort((a, b) => a.x - b.x);
    // Name in the leftmost "Nome" column (x ≈ 50-65)
    const nameItem = row.find(i => i.x >= 35 && i.x <= 75 && /^[A-Za-zÀ-ú]/.test(i.str.trim()));
    if (!nameItem) continue;
    // Group: look for "Feminino" or "Masculino" in this row
    const groupLabel = row.find(i => /^(Feminino|Masculino)$/i.test(i.str.trim()))?.str.trim();
    // Points: numeric value at x ≈ 680
    const ptsItem = row.find(i => i.x >= 670 && i.x <= 690 && /^\d+$/.test(i.str.trim()));
    const points = ptsItem ? parseInt(ptsItem.str, 10) : null;
    sorteados.push({
      name: nameItem.str.trim(),
      group: groupLabel ? (groupLabel.toLowerCase().startsWith('f') ? 'F' : 'M') : null,
      points,
      // Tipo: 80 pts => sorteio (drawn); 60 pts => sorteio_a_pedido (volunteer)
      type: points === 60 ? 'sorteio_a_pedido' : 'sorteio',
    });
  }

  return { date, pairRows, sorteados };
}

// ============================================================================
// API
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
// ALGORITHM (mirrors backend computeDoubleLossPositions)
// ============================================================================

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

const POS_BY_LABEL = {
  'CAMPEÃO': 1, 'VICE-CAMPEÃO': 2,
  '3 LUGAR': 3, '3º LUGAR': 3,
  '4 LUGAR': 4, '4º LUGAR': 4,
  '5 LUGAR': 5, '5º LUGAR': 5,
  '6 LUGAR': 6, '6º LUGAR': 6,
  '7 LUGAR': 7, '7º LUGAR': 7,
};

// ============================================================================
// MAIN
// ============================================================================

(async () => {
  const warnings = [];
  const errors = [];

  console.log(`Modo: ${MODE}`);
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Torneio: ${TOURNAMENT_SLUG}`);
  console.log(`PDF: ${PDF_PATH}`);

  // ---- 1. Extract & parse ----
  console.log('\n[1/7] Extraindo dados do PDF…');
  const items = await extractItems(PDF_PATH);
  const { date, pairRows, sorteados } = parsePdf(items);
  console.log(`  Data: ${date}`);
  console.log(`  Duplas: ${pairRows.length} | Sorteios: ${sorteados.length}`);

  // ---- 2. Resolve participants ----
  console.log('\n[2/7] Buscando participantes do torneio…');
  const participants = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/participants`);
  const byNameLower = new Map();
  for (const p of participants) if (p.active) byNameLower.set(p.name.toLowerCase().trim(), p);

  function resolveName(name) {
    if (!name) return null;
    const direct = byNameLower.get(name.toLowerCase().trim());
    if (direct) return direct;
    // try without accents
    const noAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const target = noAccents(name);
    for (const p of participants) if (p.active && noAccents(p.name) === target) return p;
    return null;
  }

  // ---- 3. Determine group per pair (by player gender) ----
  console.log('\n[3/7] Determinando grupo (F/M) por quadra…');
  for (const pr of pairRows) {
    const pA = resolveName(pr.playerA);
    const pB = resolveName(pr.playerB);
    if (!pA) errors.push(`Dupla ${pr.label}: jogador "${pr.playerA}" não encontrado no torneio.`);
    if (!pB) errors.push(`Dupla ${pr.label}: jogador "${pr.playerB}" não encontrado no torneio.`);
    if (pA && pB && pA.group !== pB.group) errors.push(`Dupla ${pr.label}: "${pA.name}" (${pA.group}) e "${pB.name}" (${pB.group}) são de grupos diferentes.`);
    pr.group = pA?.group || pB?.group || null;
    pr.resolvedA = pA;
    pr.resolvedB = pB;
  }

  for (const s of sorteados) {
    const p = resolveName(s.name);
    if (!p) errors.push(`Sorteio: "${s.name}" não encontrado.`);
    else if (s.group && p.group !== s.group) errors.push(`Sorteio "${s.name}" no PDF é ${s.group} mas no DB é ${p.group}.`);
    s.resolved = p;
    s.group = s.group || p?.group;
  }

  // ---- 4. Build courts (pairs grouped by their pair-label-prefix and group) ----
  // Court detection: pairs sharing the same numeric label prefix (6, 7, 8) form a court.
  // Court labels: 4 → "Quadra 4" (5 pairs), 5 → "Quadra 5" (varies), 8 → "Estádio".
  // For the public API, the court label is informational; backend uses it as a string.
  console.log('\n[4/7] Agrupando duplas em quadras…');
  const courtsByGroup = { F: [], M: [] };
  const byPrefix = {};
  for (const pr of pairRows) {
    const prefix = pr.label[0];
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push(pr);
  }

  // Map prefix → courtLabel (heurística baseada na convenção observada)
  function courtLabelForPrefix(prefix, group) {
    if (prefix === '8') return 'Estádio';
    return `Quadra ${prefix === '6' ? '4' : prefix === '7' ? '5' : prefix}`;
  }

  for (const [prefix, prs] of Object.entries(byPrefix)) {
    if (prs.length === 0) continue;
    const group = prs[0].group;
    if (!group) continue;
    const courtLabel = courtLabelForPrefix(prefix, group);
    const pairs = prs.map(pr => ({ playerA: pr.resolvedA?.name || pr.playerA, playerB: pr.resolvedB?.name || pr.playerB, _pr: pr }));
    const labels = prs.map(pr => pr.label);
    const games = [];
    // Each game has 2 sides (pairs); we need pairAIndex/pairBIndex within this court
    const allGameSlots = {};
    prs.forEach((pr, idx) => {
      for (const g of pr.games) {
        if (!allGameSlots[g.jogo]) allGameSlots[g.jogo] = [];
        allGameSlots[g.jogo].push({ idx, ...g });
      }
    });
    for (const jogoNum of Object.keys(allGameSlots).map(Number).sort((a, b) => a - b)) {
      const sides = allGameSlots[jogoNum];
      if (sides.length !== 2) {
        errors.push(`${courtLabel}: Jogo ${jogoNum} tem ${sides.length} lados (esperado 2).`);
        continue;
      }
      const [a, b] = sides;
      if (a.scoreA !== b.scoreB || a.scoreB !== b.scoreA) {
        errors.push(`${courtLabel}: Jogo ${jogoNum} (${labels[a.idx]} vs ${labels[b.idx]}) placares não batem: ${a.scoreA}x${a.scoreB} vs ${b.scoreA}x${b.scoreB}.`);
      }
      games.push({ pairAIndex: a.idx, pairBIndex: b.idx, scoreA: a.scoreA, scoreB: a.scoreB });
    }

    // Validate computed positions vs PDF labels
    const computed = computeDoubleLossPositions(prs.length, games);
    prs.forEach((pr, i) => {
      const expected = POS_BY_LABEL[pr.position];
      if (expected != null && expected !== computed[i]) {
        errors.push(`${courtLabel} dupla ${pr.label}: PDF=${pr.position} (pos ${expected}), computado pos ${computed[i]}.`);
      }
    });

    courtsByGroup[group].push({ label: courtLabel, pairs, games, _prs: prs });
  }

  // Pretty print
  for (const g of ['F', 'M']) {
    if (!courtsByGroup[g].length) continue;
    console.log(`  ${g === 'F' ? 'FEMININO' : 'MASCULINO'}:`);
    for (const c of courtsByGroup[g]) {
      console.log(`    ${c.label} — ${c.pairs.length} duplas:`);
      c._prs.forEach((pr, i) => {
        console.log(`      ${pr.label}: ${pr.resolvedA?.name || '?'} & ${pr.resolvedB?.name || '?'}  →  ${pr.position}`);
      });
    }
  }
  if (sorteados.length) {
    console.log('  SORTEIOS:');
    for (const s of sorteados) console.log(`    ${s.name} (${s.group || '?'}, ${s.type}, ${s.points || '?'} pts)`);
  }

  // ---- 5. Find target round IDs ----
  console.log('\n[5/7] Localizando etapa-alvo…');
  const rounds = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/rounds`);
  const yyyymm = date.slice(0, 7);
  const roundF = rounds.find(r => r.group === 'F' && r.date.startsWith(yyyymm));
  const roundM = rounds.find(r => r.group === 'M' && r.date.startsWith(yyyymm));
  const hasF = courtsByGroup.F.length > 0 || sorteados.some(s => s.group === 'F');
  const hasM = courtsByGroup.M.length > 0 || sorteados.some(s => s.group === 'M');
  if (hasF && !roundF) errors.push(`Não encontrei etapa Feminina para o mês ${yyyymm}.`);
  if (hasM && !roundM) errors.push(`Não encontrei etapa Masculina para o mês ${yyyymm}.`);
  if (roundF) {
    console.log(`  F: ${roundF.id} (data atual=${roundF.date}, status=${roundF.status})`);
    if (roundF.date !== date) warnings.push(`Data F será atualizada de ${roundF.date} para ${date}.`);
    if (roundF.status === 'COMPLETED') warnings.push(`Etapa F já está COMPLETED — court-results vai SUBSTITUIR resultados existentes.`);
  }
  if (roundM) {
    console.log(`  M: ${roundM.id} (data atual=${roundM.date}, status=${roundM.status})`);
    if (roundM.date !== date) warnings.push(`Data M será atualizada de ${roundM.date} para ${date}.`);
    if (roundM.status === 'COMPLETED') warnings.push(`Etapa M já está COMPLETED — court-results vai SUBSTITUIR resultados existentes.`);
  }

  // ---- Bail out se houver erros ----
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

  // ---- 6. Apply ----
  if (MODE !== 'apply') {
    console.log('\n✅ DRY-RUN concluído. Para aplicar, rode com --mode=apply.');
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('\n❌ ADMIN_EMAIL e ADMIN_PASSWORD obrigatórios em modo apply.');
    console.error('   Configure-os em scripts/.env.import (gitignored) ou exporte como variáveis.');
    process.exit(1);
  }

  console.log('\n[6/7] Login admin…');
  const { token } = await api('POST', '/auth/login', { body: { email, password } });
  console.log('  ✓ token obtido');

  // Atualiza datas se necessário
  if (roundF && roundF.date !== date) {
    await api('PUT', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundF.id}`, { token, body: { date } });
    console.log(`  ✓ data F atualizada para ${date}`);
  }
  if (roundM && roundM.date !== date) {
    await api('PUT', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundM.id}`, { token, body: { date } });
    console.log(`  ✓ data M atualizada para ${date}`);
  }

  // Submete por grupo
  async function submitGroup(group, round) {
    if (!round) return null;
    const courts = courtsByGroup[group].map(c => ({
      label: c.label,
      pairs: c.pairs.map(p => ({ playerA: p.playerA, playerB: p.playerB })),
      games: c.games,
    }));
    const sortGroup = sorteados.filter(s => s.group === group).map(s => ({
      name: s.resolved?.name || s.name,
      type: s.type,
    }));
    const r = await api('POST', `/tournaments/${TOURNAMENT_SLUG}/rounds/${round.id}/court-results`, {
      token, body: { courts, sorteados: sortGroup },
    });
    console.log(`  ✓ ${group}: ${r.saved} resultados, ${r.absents.length} faltas: ${r.absents.join(', ') || '(nenhuma)'}`);
    return r;
  }

  console.log('\n[7/7] Submetendo court-results…');
  await submitGroup('F', roundF);
  await submitGroup('M', roundM);

  // ---- 8. Verify ----
  console.log('\n[verificação] Lendo standings após import…');
  if (roundF) {
    const sF = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/standings/F`);
    console.log(`  Feminino: ${sF.length} jogadoras. Top 3: ${sF.slice(0, 3).map(s => `${s.position}º ${s.name} (${s.pointsValid}pts)`).join(', ')}`);
  }
  if (roundM) {
    const sM = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/standings/M`);
    console.log(`  Masculino: ${sM.length} jogadores. Top 3: ${sM.slice(0, 3).map(s => `${s.position}º ${s.name} (${s.pointsValid}pts)`).join(', ')}`);
  }

  // ---- Relatório final ----
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RELATÓRIO FINAL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Data da etapa: ${date}`);
  console.log(`Quadras F: ${courtsByGroup.F.length} | Quadras M: ${courtsByGroup.M.length}`);
  console.log(`Sorteios: ${sorteados.length}`);
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
