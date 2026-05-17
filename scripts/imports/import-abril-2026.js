#!/usr/bin/env node
/**
 * Importação da 2ª Etapa (Abril/2026) do Torneio 2026.
 *
 * Modos:
 *   MODE=dry-run (default) — valida tudo, imprime resumo, não escreve nada.
 *   MODE=apply             — login + atualiza data + 2× court-results + verificação.
 *
 * Variáveis de ambiente:
 *   API_BASE_URL    (default https://www.sm-ttc.com.br/api)
 *   ADMIN_EMAIL     (obrigatório em apply)
 *   ADMIN_PASSWORD  (obrigatório em apply)
 *   MODE            (dry-run | apply)
 *
 * Origem dos dados: RESULTADOS/Abril26/Resultados jogos Abril_2026.pdf
 * Validação: RESULTADOS/Abril26/Classificação Geral *.pdf
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://www.sm-ttc.com.br/api';
const TOURNAMENT_SLUG = '2026';
const ROUND_NUMBER = 2;
const ROUND_DATE = '2026-04-12';
const MODE = (process.env.MODE || 'dry-run').toLowerCase();

// ============================================================================
// DADOS EXTRAÍDOS DO PDF (validados localmente: posições computadas == PDF)
// ============================================================================

const ETAPA = {
  feminino: {
    courts: [
      {
        label: 'Quadra 4',
        pairs: [
          { playerA: 'Núbia',   playerB: 'Ana' },       // 6A → 5º LUGAR
          { playerA: 'Letícia', playerB: 'Rose' },      // 6B → 3º LUGAR
          { playerA: 'Natalia', playerB: 'Mariana' },   // 6C → CAMPEÃO
          { playerA: 'Giovana', playerB: 'Jeovana' },   // 6D → VICE-CAMPEÃO
          { playerA: 'Andrea',  playerB: 'Sandra' },    // 6E → 4º LUGAR
        ],
        // pairAIndex/pairBIndex: 0=6A, 1=6B, 2=6C, 3=6D, 4=6E
        games: [
          { pairAIndex: 0, pairBIndex: 1, scoreA: 1, scoreB: 5 }, // J1: 6A 1x5 6B
          { pairAIndex: 2, pairBIndex: 3, scoreA: 5, scoreB: 3 }, // J2: 6C 5x3 6D
          { pairAIndex: 1, pairBIndex: 4, scoreA: 5, scoreB: 2 }, // J3: 6B 5x2 6E
          { pairAIndex: 0, pairBIndex: 3, scoreA: 4, scoreB: 5 }, // J4: 6A 4x5 6D
          { pairAIndex: 3, pairBIndex: 4, scoreA: 5, scoreB: 3 }, // J5: 6D 5x3 6E
          { pairAIndex: 1, pairBIndex: 2, scoreA: 2, scoreB: 5 }, // J6: 6B 2x5 6C
          { pairAIndex: 1, pairBIndex: 3, scoreA: 3, scoreB: 5 }, // J7: 6B 3x5 6D
          { pairAIndex: 2, pairBIndex: 3, scoreA: 5, scoreB: 0 }, // J8: 6C 5x0 6D
        ],
      },
    ],
    sorteados: [
      { name: 'Katia', type: 'sorteio' },  // Kátia no PDF → "Katia" no DB (sem acento)
    ],
  },
  masculino: {
    courts: [
      {
        label: 'Quadra 5',
        pairs: [
          { playerA: 'Vitor',    playerB: 'Gustavo' },     // 7A → CAMPEÃO
          { playerA: 'Flavio',   playerB: 'Foguete' },     // 7B → 4º LUGAR
          { playerA: 'Vita',     playerB: 'Cláudio' },     // 7C → 5º LUGAR
          { playerA: 'Colonese', playerB: 'Vanzillota' },  // 7D → 6º LUGAR
          { playerA: 'Lincoln',  playerB: 'Edu Caetano' }, // 7E → 3º LUGAR
          { playerA: 'Aranha',   playerB: 'Fitipaldi' },   // 7F → VICE-CAMPEÃO
        ],
        games: [
          { pairAIndex: 0, pairBIndex: 1, scoreA: 5, scoreB: 3 }, // J1: 7A 5x3 7B
          { pairAIndex: 2, pairBIndex: 3, scoreA: 5, scoreB: 3 }, // J2: 7C 5x3 7D
          { pairAIndex: 0, pairBIndex: 4, scoreA: 5, scoreB: 2 }, // J3: 7A 5x2 7E
          { pairAIndex: 2, pairBIndex: 5, scoreA: 3, scoreB: 5 }, // J4: 7C 3x5 7F
          { pairAIndex: 1, pairBIndex: 3, scoreA: 5, scoreB: 2 }, // J5: 7B 5x2 7D
          { pairAIndex: 2, pairBIndex: 4, scoreA: 1, scoreB: 5 }, // J6: 7C 1x5 7E
          { pairAIndex: 0, pairBIndex: 5, scoreA: 5, scoreB: 4 }, // J7: 7A 5x4 7F
          { pairAIndex: 1, pairBIndex: 4, scoreA: 3, scoreB: 5 }, // J8: 7B 3x5 7E
          { pairAIndex: 4, pairBIndex: 5, scoreA: 3, scoreB: 5 }, // J9: 7E 3x5 7F
          { pairAIndex: 0, pairBIndex: 5, scoreA: 5, scoreB: 3 }, // J10: 7A 5x3 7F
        ],
      },
      {
        label: 'Estádio',
        pairs: [
          { playerA: 'Neco',          playerB: 'Michel' },        // 8A → 4º LUGAR
          { playerA: 'Luiz Henrique', playerB: 'Júlio Cesar' },   // 8B → 5º LUGAR
          { playerA: 'Edu Carneiro',  playerB: 'Bottino' },       // 8C → 6º LUGAR
          { playerA: 'Reco',          playerB: 'José Felipe' },   // 8D → VICE-CAMPEÃO
          { playerA: 'João Reis',     playerB: 'Fernando' },      // 8E → CAMPEÃO
          { playerA: 'Romulo',        playerB: 'Tuninho' },       // 8F → 3º LUGAR
        ],
        games: [
          { pairAIndex: 0, pairBIndex: 1, scoreA: 2, scoreB: 5 }, // J1: 8A 2x5 8B
          { pairAIndex: 2, pairBIndex: 3, scoreA: 0, scoreB: 5 }, // J2: 8C 0x5 8D
          { pairAIndex: 1, pairBIndex: 4, scoreA: 1, scoreB: 5 }, // J3: 8B 1x5 8E
          { pairAIndex: 3, pairBIndex: 5, scoreA: 5, scoreB: 2 }, // J4: 8D 5x2 8F
          { pairAIndex: 0, pairBIndex: 2, scoreA: 5, scoreB: 3 }, // J5: 8A 5x3 8C
          { pairAIndex: 1, pairBIndex: 5, scoreA: 4, scoreB: 5 }, // J6: 8B 4x5 8F
          { pairAIndex: 3, pairBIndex: 4, scoreA: 2, scoreB: 5 }, // J7: 8D 2x5 8E
          { pairAIndex: 0, pairBIndex: 5, scoreA: 2, scoreB: 5 }, // J8: 8A 2x5 8F
          { pairAIndex: 3, pairBIndex: 5, scoreA: 5, scoreB: 4 }, // J9: 8D 5x4 8F
          { pairAIndex: 3, pairBIndex: 4, scoreA: 5, scoreB: 1 }, // J10: 8D 5x1 8E
          { pairAIndex: 3, pairBIndex: 4, scoreA: 1, scoreB: 5 }, // J11: 8D 1x5 8E
        ],
      },
    ],
    sorteados: [],
  },
};

// ============================================================================
// HELPERS
// ============================================================================

async function api(method, path, { token, body } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${res.statusText}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

function computeDoubleLossPositions(n, games) {
  const losses = new Array(n).fill(0);
  const eliminationOrder = [];
  for (const { pairAIndex: a, pairBIndex: b, scoreA, scoreB } of games) {
    if (a == null || b == null || scoreA === scoreB) continue;
    const loser = scoreA < scoreB ? a : b;
    losses[loser]++;
    if (losses[loser] >= 2 && !eliminationOrder.includes(loser)) {
      eliminationOrder.push(loser);
    }
  }
  const winners = Array.from({ length: n }, (_, i) => i).filter(i => !eliminationOrder.includes(i));
  const positionMap = new Array(n).fill(null);
  let pos = 1;
  winners.forEach(i => { positionMap[i] = pos++; });
  for (let i = eliminationOrder.length - 1; i >= 0; i--) {
    positionMap[eliminationOrder[i]] = pos++;
  }
  return positionMap;
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

async function validate() {
  console.log(`\n[validate] Buscando participantes do torneio ${TOURNAMENT_SLUG}…`);
  const participants = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/participants`);
  const byNameLower = new Map();
  for (const p of participants) {
    if (!p.active) continue;
    byNameLower.set(p.name.toLowerCase().trim(), p);
  }

  const errors = [];

  function checkName(name, expectedGroup) {
    const p = byNameLower.get(String(name).toLowerCase().trim());
    if (!p) { errors.push(`Nome não encontrado: "${name}" (esperado grupo ${expectedGroup})`); return null; }
    if (p.group !== expectedGroup) { errors.push(`"${name}" está no grupo ${p.group}, esperado ${expectedGroup}`); return p; }
    return p;
  }

  for (const group of ['feminino', 'masculino']) {
    const expectedG = group === 'feminino' ? 'F' : 'M';
    for (const court of ETAPA[group].courts) {
      for (const pair of court.pairs) {
        checkName(pair.playerA, expectedG);
        checkName(pair.playerB, expectedG);
      }
    }
    for (const s of ETAPA[group].sorteados) {
      checkName(s.name, expectedG);
    }
  }

  if (errors.length) {
    console.error('\n❌ ERROS DE NOME:');
    for (const e of errors) console.error('  - ' + e);
    throw new Error('Validação falhou.');
  }
  console.log('  ✓ Todos os nomes resolvem para participantes ativos do grupo correto.');

  // Validar posições calculadas vs esperadas
  const POS_LABELS = { 1: 'CAMPEÃO', 2: 'VICE-CAMPEÃO', 3: '3º LUGAR', 4: '4º LUGAR', 5: '5º LUGAR', 6: '6º LUGAR' };

  console.log('\n[validate] Conferindo posições calculadas localmente vs PDF:');
  for (const group of ['feminino', 'masculino']) {
    for (const court of ETAPA[group].courts) {
      const positions = computeDoubleLossPositions(court.pairs.length, court.games);
      console.log(`  ${group.toUpperCase()} — ${court.label}:`);
      court.pairs.forEach((pair, i) => {
        console.log(`    ${i+1}. ${pair.playerA} & ${pair.playerB}  →  ${POS_LABELS[positions[i]] || `pos ${positions[i]}`}`);
      });
    }
  }

  console.log('\n[validate] Sorteados:');
  for (const group of ['feminino', 'masculino']) {
    for (const s of ETAPA[group].sorteados) console.log(`  ${group.toUpperCase()}: ${s.name} (${s.type})`);
  }

  // Calcular faltas (active não-em-quadra-nem-sorteio)
  console.log('\n[validate] Faltas calculadas (auto pelo backend):');
  for (const group of ['feminino', 'masculino']) {
    const expectedG = group === 'feminino' ? 'F' : 'M';
    const activeInGroup = participants.filter(p => p.active && p.group === expectedG).map(p => p.name);
    const used = new Set();
    for (const court of ETAPA[group].courts) {
      for (const pair of court.pairs) {
        used.add(pair.playerA.toLowerCase().trim());
        used.add(pair.playerB.toLowerCase().trim());
      }
    }
    for (const s of ETAPA[group].sorteados) used.add(s.name.toLowerCase().trim());
    const absent = activeInGroup.filter(n => !used.has(n.toLowerCase().trim()));
    console.log(`  ${group.toUpperCase()} (${absent.length}): ${absent.join(', ') || '(nenhuma)'}`);
  }

  // Buscar IDs das etapas
  const rounds = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/rounds`);
  const roundF = rounds.find(r => r.number === ROUND_NUMBER && r.group === 'F');
  const roundM = rounds.find(r => r.number === ROUND_NUMBER && r.group === 'M');
  if (!roundF || !roundM) throw new Error(`Etapa ${ROUND_NUMBER} não encontrada para algum dos grupos`);

  console.log(`\n[validate] Etapas-alvo:`);
  console.log(`  F: ${roundF.id}  data atual=${roundF.date}  status=${roundF.status}`);
  console.log(`  M: ${roundM.id}  data atual=${roundM.date}  status=${roundM.status}`);
  if (roundF.date !== ROUND_DATE) console.log(`  ⚠ data F será atualizada para ${ROUND_DATE}`);
  if (roundM.date !== ROUND_DATE) console.log(`  ⚠ data M será atualizada para ${ROUND_DATE}`);
  if (roundF.status === 'COMPLETED') console.log(`  ⚠ etapa F já está COMPLETED — court-results vai SUBSTITUIR resultados.`);
  if (roundM.status === 'COMPLETED') console.log(`  ⚠ etapa M já está COMPLETED — court-results vai SUBSTITUIR resultados.`);

  return { roundF, roundM };
}

// ============================================================================
// EXECUÇÃO (apply)
// ============================================================================

async function apply() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios em modo apply.');

  const { roundF, roundM } = await validate();

  console.log('\n[apply] Login…');
  const { token } = await api('POST', '/auth/login', { body: { email, password } });
  console.log('  ✓ token obtido');

  // Atualiza data se necessário
  if (roundF.date !== ROUND_DATE) {
    console.log(`\n[apply] Atualizando data Feminino → ${ROUND_DATE}…`);
    await api('PUT', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundF.id}`, { token, body: { date: ROUND_DATE } });
    console.log('  ✓');
  }
  if (roundM.date !== ROUND_DATE) {
    console.log(`\n[apply] Atualizando data Masculino → ${ROUND_DATE}…`);
    await api('PUT', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundM.id}`, { token, body: { date: ROUND_DATE } });
    console.log('  ✓');
  }

  // Submete Feminino
  console.log('\n[apply] Submetendo court-results Feminino…');
  const resF = await api('POST', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundF.id}/court-results`, {
    token,
    body: {
      courts: ETAPA.feminino.courts,
      sorteados: ETAPA.feminino.sorteados,
    },
  });
  console.log(`  ✓ ${resF.saved} resultados gravados, ${resF.absents.length} faltas: ${resF.absents.join(', ') || '(nenhuma)'}`);

  // Submete Masculino
  console.log('\n[apply] Submetendo court-results Masculino…');
  const resM = await api('POST', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundM.id}/court-results`, {
    token,
    body: {
      courts: ETAPA.masculino.courts,
      sorteados: ETAPA.masculino.sorteados,
    },
  });
  console.log(`  ✓ ${resM.saved} resultados gravados, ${resM.absents.length} faltas: ${resM.absents.join(', ') || '(nenhuma)'}`);

  // Verificação
  console.log('\n[apply] Verificação (GET results e standings)…');
  const resultsF = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundF.id}/results`);
  const resultsM = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/rounds/${roundM.id}/results`);
  console.log(`  Feminino: ${resultsF.length} resultados (esperado ${ETAPA.feminino.courts.flatMap(c=>c.pairs).length*2 + ETAPA.feminino.sorteados.length + resF.absents.length})`);
  console.log(`  Masculino: ${resultsM.length} resultados`);

  const standingsF = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/standings?group=F`);
  const standingsM = await api('GET', `/tournaments/${TOURNAMENT_SLUG}/standings?group=M`);

  console.log('\n=== STANDINGS FEMININO (após Abril) ===');
  for (const s of standingsF) console.log(`  ${s.position}º ${s.name.padEnd(20)}  ${s.pointsValid} pts  saldoSets=${s.saldoSets}  saldoGames=${s.saldoGames}`);
  console.log('\n=== STANDINGS MASCULINO (após Abril) ===');
  for (const s of standingsM) console.log(`  ${s.position}º ${s.name.padEnd(20)}  ${s.pointsValid} pts  saldoSets=${s.saldoSets}  saldoGames=${s.saldoGames}`);
}

// ============================================================================
// ENTRYPOINT
// ============================================================================

(async () => {
  try {
    console.log(`Modo: ${MODE}`);
    console.log(`API: ${API_BASE_URL}`);
    if (MODE === 'apply') {
      await apply();
      console.log('\n✅ APPLY concluído.');
    } else {
      await validate();
      console.log('\n✅ DRY-RUN concluído. Para aplicar, rode com MODE=apply.');
    }
  } catch (e) {
    console.error('\n❌ ERRO:', e.message);
    process.exit(1);
  }
})();
