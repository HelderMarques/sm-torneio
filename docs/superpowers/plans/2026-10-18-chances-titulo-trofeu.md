# Chances de Título e Troféu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, por atleta, se ainda pode ser campeã/ganhar troféu (status determinístico pelo regulamento) + probabilidade estimada (Monte Carlo), na Classificação (selo) e na página da atleta (seção detalhada).

**Architecture:** Backend puro calcula tudo reusando o motor de pontuação (descarte/bônus). Funções puras testáveis (`node --test`) + orquestrador Prisma + rota pública. Frontend busca `/chances` e renderiza selo + seção; IA só redige os fatos já calculados.

**Tech Stack:** Node 20 (`node:test`/`node:assert`), Express, Prisma, React 18 + Vite + Tailwind, `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-10-18-chances-titulo-trofeu-design.md`

---

## Estrutura de arquivos

- Create `backend/src/services/chancesTituloService.js` — funções puras (`projectFinalPoints`, `deriveStatuses`, `monteCarloProbabilities`, `buildCondicoes`) + orquestrador `computeChances`.
- Create `backend/test/chancesTitulo.test.js` — testes unitários das funções puras.
- Create `backend/src/routes/chances.js` — rota `GET /chances`.
- Modify `backend/src/index.js` — registrar rota.
- Modify `backend/src/services/insightService.js` — `generateChancesText` (IA só redige).
- Modify `qa/api-smoke-test.js` — CHA-1, CHA-2.
- Create `frontend/src/hooks/useChances.js`.
- Create `frontend/src/components/ChancesTitulo.jsx`.
- Modify `frontend/src/pages/Participante.jsx` — seção.
- Modify `frontend/src/components/StandingsTable.jsx` — selo via prop.
- Modify `frontend/src/pages/Home.jsx` e `frontend/src/pages/Classificacao.jsx` — buscar `/chances`, passar Map.

> Todos os commits desta branch terminam com:
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
> Se o git do sistema falhar pedindo licença do Xcode, prefixe os comandos git com `DEVELOPER_DIR=/Library/Developer/CommandLineTools`.

---

### Task 1: `projectFinalPoints` (projeção de pontos final)

**Files:**
- Create: `backend/src/services/chancesTituloService.js`
- Test: `backend/test/chancesTitulo.test.js`

- [ ] **Step 1: Write the failing test**

```js
// backend/test/chancesTitulo.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { projectFinalPoints } = require('../src/services/chancesTituloService');

const OPTS = { totalRounds: 9, discardStartsAfter: 5, bonusValue: 20 };

test('projectFinalPoints: soma menos descarte do menor positivo', () => {
  // 8 pontuações, descarte ativo (completedCount=9), sem presença total
  const scores = [100, 80, 70, 60, 50, 40, 30, 100];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 9, presentAllRounds: false, penalty: 0 });
  // soma=530, descarte=30 → 500
  assert.strictEqual(r, 500);
});

test('projectFinalPoints: aplica bônus com presença total', () => {
  const scores = [100, 80, 70, 60, 50, 40, 30, 100, 100];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 9, presentAllRounds: true, penalty: 0 });
  // soma=630, descarte=30, bônus=20 → 620
  assert.strictEqual(r, 620);
});

test('projectFinalPoints: zeros não mudam descarte e não dão bônus', () => {
  const scores = [100, 80, 0]; // uma falta
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 9, presentAllRounds: false, penalty: 0 });
  // soma=180, descarte=80 (menor positivo) → 100
  assert.strictEqual(r, 100);
});

test('projectFinalPoints: sem descarte antes da 5a etapa', () => {
  const scores = [100, 80];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 2, presentAllRounds: false, penalty: 0 });
  assert.strictEqual(r, 180);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: FAIL — `projectFinalPoints is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/services/chancesTituloService.js

/**
 * Projeta a pontuação final de uma atleta aplicando as mesmas regras do
 * standingsService (descarte do menor positivo, bônus de presença total).
 * @param {number[]} perRoundPoints pontos por etapa (reais + projetados)
 * @param {object} opts { totalRounds, completedCount, discardStartsAfter, bonusValue, presentAllRounds, penalty }
 */
function projectFinalPoints(perRoundPoints, opts) {
  const raw = perRoundPoints.reduce((a, b) => a + b, 0);
  let discard = 0;
  if (opts.completedCount >= opts.discardStartsAfter) {
    const positives = perRoundPoints.filter((p) => p > 0);
    if (positives.length > 0) discard = Math.min(...positives);
  }
  const bonus = opts.completedCount === opts.totalRounds && opts.presentAllRounds ? opts.bonusValue : 0;
  return raw - discard + bonus - (opts.penalty || 0);
}

module.exports = { projectFinalPoints };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/chancesTituloService.js backend/test/chancesTitulo.test.js
git commit -m "feat(chances): projectFinalPoints com descarte e bônus"
```

---

### Task 2: `deriveStatuses` (status determinístico título/troféu)

**Files:**
- Modify: `backend/src/services/chancesTituloService.js`
- Test: `backend/test/chancesTitulo.test.js`

- [ ] **Step 1: Write the failing test**

```js
// append em backend/test/chancesTitulo.test.js
const { deriveStatuses } = require('../src/services/chancesTituloService');

// atletas: { id, floor, ceil }
test('deriveStatuses: líder destacado é campeão garantido', () => {
  const athletes = [
    { id: 'A', floor: 500, ceil: 520 },
    { id: 'B', floor: 200, ceil: 300 }, // ceil < A.floor → não alcança A
  ];
  const r = deriveStatuses(athletes, 1);
  assert.strictEqual(r.find((x) => x.id === 'A').titulo, 'garantido');
});

test('deriveStatuses: quem não alcança o top K sai fora do troféu', () => {
  const athletes = [
    { id: 'A', floor: 500, ceil: 520 },
    { id: 'B', floor: 480, ceil: 500 },
    { id: 'C', floor: 100, ceil: 120 }, // mesmo no teto, abaixo de A e B (floor)
  ];
  const r = deriveStatuses(athletes, 2); // top 2 premiado
  assert.strictEqual(r.find((x) => x.id === 'C').trofeu, 'fora');
});

test('deriveStatuses: quem pode alcançar fica vivo pro troféu', () => {
  const athletes = [
    { id: 'A', floor: 300, ceil: 400 },
    { id: 'B', floor: 290, ceil: 390 },
    { id: 'C', floor: 280, ceil: 395 }, // ceil passa floor de A e B
  ];
  const r = deriveStatuses(athletes, 2);
  assert.strictEqual(r.find((x) => x.id === 'C').trofeu, 'vivo');
});

test('deriveStatuses: fronteira vira depende_desempate (título)', () => {
  const athletes = [
    { id: 'A', floor: 300, ceil: 400 },
    { id: 'B', floor: 400, ceil: 420 }, // maxFloorOthers = 400 == A.ceil
  ];
  const r = deriveStatuses(athletes, 1);
  assert.strictEqual(r.find((x) => x.id === 'A').titulo, 'depende_desempate');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: FAIL — `deriveStatuses is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// adicionar a backend/src/services/chancesTituloService.js

/**
 * Deriva status determinístico de título e troféu por atleta.
 * @param {{id:string, floor:number, ceil:number}[]} athletes
 * @param {number} K posições premiadas (troféu)
 * @returns {{id:string, titulo:string, trofeu:string}[]} status ∈ garantido|vivo|depende_desempate|fora
 */
function deriveStatuses(athletes, K) {
  return athletes.map((a) => {
    const others = athletes.filter((j) => j.id !== a.id);
    const beatA = others.filter((j) => j.ceil > a.floor).length;         // podem passar A
    const maxFloorOthers = others.length ? Math.max(...others.map((j) => j.floor)) : -Infinity;
    const strictlyAbove = others.filter((j) => j.floor > a.ceil).length;  // garantidamente acima de A
    const weaklyAbove = others.filter((j) => j.floor >= a.ceil).length;

    // título (K = 1)
    let titulo;
    if (beatA === 0) titulo = 'garantido';
    else if (a.ceil > maxFloorOthers) titulo = 'vivo';
    else if (a.ceil === maxFloorOthers) titulo = 'depende_desempate';
    else titulo = 'fora';

    // troféu (top K)
    let trofeu;
    if (beatA < K) trofeu = 'garantido';
    else if (strictlyAbove >= K) trofeu = 'fora';
    else if (weaklyAbove >= K) trofeu = 'depende_desempate';
    else trofeu = 'vivo';

    return { id: a.id, titulo, trofeu };
  });
}

module.exports = { projectFinalPoints, deriveStatuses };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/chancesTituloService.js backend/test/chancesTitulo.test.js
git commit -m "feat(chances): deriveStatuses (título/troféu determinístico)"
```

---

### Task 3: `monteCarloProbabilities` (probabilidade estimada)

**Files:**
- Modify: `backend/src/services/chancesTituloService.js`
- Test: `backend/test/chancesTitulo.test.js`

- [ ] **Step 1: Write the failing test**

```js
// append em backend/test/chancesTitulo.test.js
const { monteCarloProbabilities } = require('../src/services/chancesTituloService');

test('monteCarloProbabilities: invariantes de coerência', () => {
  // 3 atletas, 1 etapa restante, descarte/bônus padrão
  const athletes = [
    { id: 'A', scores: [100, 100, 100], presentCompleted: 3, penalty: 0 },
    { id: 'B', scores: [80, 80, 80], presentCompleted: 3, penalty: 0 },
    { id: 'C', scores: [60, 60, 60], presentCompleted: 3, penalty: 0 },
  ];
  const cfg = { totalRounds: 4, remaining: 1, discardStartsAfter: 5, bonusValue: 20,
    pointsTable: [100, 80, 70, 60, 50, 40, 30], trophyPositions: 2, iterations: 5000, seed: 42 };
  const probs = monteCarloProbabilities(athletes, cfg);

  const total = probs.reduce((s, p) => s + p.probTitulo, 0);
  assert.ok(Math.abs(total - 1) < 0.02, `soma probTitulo ≈ 1, got ${total}`);
  for (const p of probs) {
    assert.ok(p.probTitulo >= 0 && p.probTitulo <= 1);
    assert.ok(p.probTrofeu >= p.probTitulo - 1e-9, 'probTrofeu >= probTitulo');
  }
  // A (líder) tem a maior probTitulo
  const pa = probs.find((p) => p.id === 'A').probTitulo;
  const pc = probs.find((p) => p.id === 'C').probTitulo;
  assert.ok(pa > pc, 'líder tem mais chance que lanterna');
});

test('monteCarloProbabilities: determinístico com mesma seed', () => {
  const athletes = [
    { id: 'A', scores: [100], presentCompleted: 1, penalty: 0 },
    { id: 'B', scores: [80], presentCompleted: 1, penalty: 0 },
  ];
  const cfg = { totalRounds: 2, remaining: 1, discardStartsAfter: 5, bonusValue: 20,
    pointsTable: [100, 80, 70, 60, 50, 40, 30], trophyPositions: 1, iterations: 1000, seed: 7 };
  const a = monteCarloProbabilities(athletes, cfg);
  const b = monteCarloProbabilities(athletes, cfg);
  assert.deepStrictEqual(a, b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: FAIL — `monteCarloProbabilities is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// adicionar a backend/src/services/chancesTituloService.js

// RNG determinístico (mulberry32) para simulações reproduzíveis
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Estima P(campeã) e P(troféu) por atleta via Monte Carlo com modelo UNIFORME:
 * em cada etapa restante, cada atleta sorteia pontos uniformemente da pointsTable.
 * @param {{id,scores:number[],presentCompleted:number,penalty:number}[]} athletes
 * @param {object} cfg { totalRounds, remaining, discardStartsAfter, bonusValue, pointsTable, trophyPositions, iterations, seed }
 */
function monteCarloProbabilities(athletes, cfg) {
  const rng = mulberry32(cfg.seed || 1);
  const table = cfg.pointsTable;
  const titleWins = new Map(athletes.map((a) => [a.id, 0]));
  const trophyWins = new Map(athletes.map((a) => [a.id, 0]));
  const N = cfg.iterations;

  for (let it = 0; it < N; it++) {
    const finals = athletes.map((a) => {
      const future = [];
      for (let r = 0; r < cfg.remaining; r++) {
        future.push(table[Math.floor(rng() * table.length)]);
      }
      const scores = a.scores.concat(future);
      const presentAll = a.presentCompleted + cfg.remaining === cfg.totalRounds;
      const pts = projectFinalPoints(scores, {
        totalRounds: cfg.totalRounds,
        completedCount: cfg.totalRounds,
        discardStartsAfter: cfg.discardStartsAfter,
        bonusValue: cfg.bonusValue,
        presentAllRounds: presentAll,
        penalty: a.penalty,
      });
      return { id: a.id, pts, tie: rng() };
    });
    // ranqueia por pontos desc; desempate aleatório estável (tie)
    finals.sort((x, y) => (y.pts - x.pts) || (y.tie - x.tie));
    titleWins.set(finals[0].id, titleWins.get(finals[0].id) + 1);
    for (let i = 0; i < Math.min(cfg.trophyPositions, finals.length); i++) {
      trophyWins.set(finals[i].id, trophyWins.get(finals[i].id) + 1);
    }
  }

  return athletes.map((a) => ({
    id: a.id,
    probTitulo: titleWins.get(a.id) / N,
    probTrofeu: trophyWins.get(a.id) / N,
  }));
}

module.exports = { projectFinalPoints, deriveStatuses, monteCarloProbabilities };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/chancesTituloService.js backend/test/chancesTitulo.test.js
git commit -m "feat(chances): monteCarloProbabilities (modelo uniforme)"
```

---

### Task 4: `buildCondicoes` (texto "o que precisa acontecer")

**Files:**
- Modify: `backend/src/services/chancesTituloService.js`
- Test: `backend/test/chancesTitulo.test.js`

- [ ] **Step 1: Write the failing test**

```js
// append em backend/test/chancesTitulo.test.js
const { buildCondicoes } = require('../src/services/chancesTituloService');

test('buildCondicoes: garantido retorna frase de garantido', () => {
  const r = buildCondicoes({ name: 'Ana', titulo: 'garantido', trofeu: 'garantido' }, {});
  assert.ok(r[0].toLowerCase().includes('garantid'));
});

test('buildCondicoes: fora de tudo retorna frase sem chance', () => {
  const r = buildCondicoes({ name: 'Ana', titulo: 'fora', trofeu: 'fora' }, {});
  assert.ok(r.join(' ').toLowerCase().includes('sem chance'));
});

test('buildCondicoes: título vivo cita o alvo de pontos', () => {
  const r = buildCondicoes(
    { name: 'Natalia', titulo: 'vivo', trofeu: 'garantido', currentPoints: 260, maxPoints: 360 },
    { leaderName: 'Giovana', leaderPoints: 340 }
  );
  const txt = r.join(' ');
  assert.ok(txt.includes('360'));
  assert.ok(txt.includes('Giovana'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: FAIL — `buildCondicoes is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// adicionar a backend/src/services/chancesTituloService.js

/**
 * Monta 1-2 frases de template a partir dos fatos já calculados.
 * @param {object} a atleta { name, titulo, trofeu, currentPoints, maxPoints }
 * @param {object} ctx { leaderName, leaderPoints }
 */
function buildCondicoes(a, ctx) {
  if (a.titulo === 'garantido') return ['Título já garantido matematicamente.'];
  if (a.trofeu === 'garantido' && (a.titulo === 'fora' || a.titulo === 'depende_desempate')) {
    const base = ['Troféu já garantido.'];
    if (a.titulo === 'depende_desempate') base.push('O título ainda depende de critérios de desempate.');
    return base;
  }
  if (a.titulo === 'fora' && a.trofeu === 'fora') {
    return ['Sem chance matemática de troféu nesta temporada.'];
  }
  const out = [];
  if (a.titulo === 'vivo' && ctx.leaderName) {
    out.push(`Você tem ${a.currentPoints} pts. No melhor caso chega a ${a.maxPoints} pts.`);
    out.push(`Para alcançar ${ctx.leaderName} (${ctx.leaderPoints} pts) e ser campeã, precisa pontuar o máximo e torcer por tropeços da líder.`);
  } else if (a.titulo === 'depende_desempate') {
    out.push(`No melhor caso você empata na liderança (${a.maxPoints} pts); o título sairia em critério de desempate.`);
  }
  if (a.trofeu === 'vivo') {
    out.push(`Para entrar na zona de troféu, pontue o máximo nas etapas restantes.`);
  } else if (a.trofeu === 'depende_desempate' && out.length === 0) {
    out.push('A vaga de troféu depende de critérios de desempate.');
  }
  return out.length ? out : ['Situação em aberto.'];
}

module.exports = { projectFinalPoints, deriveStatuses, monteCarloProbabilities, buildCondicoes };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/chancesTituloService.js backend/test/chancesTitulo.test.js
git commit -m "feat(chances): buildCondicoes (texto o que precisa acontecer)"
```

---

### Task 5: `computeChances` (orquestrador Prisma)

**Files:**
- Modify: `backend/src/services/chancesTituloService.js`

- [ ] **Step 1: Write the orchestrator (sem teste unitário — depende do banco; validado pela rota na Task 6)**

```js
// adicionar ao topo de backend/src/services/chancesTituloService.js
const { PrismaClient } = require('@prisma/client');
const { loadSettings } = require('../utils/settings');
const { getPointsForResult, getStandings } = require('./standingsService');

const prisma = new PrismaClient();

// --- helper de ordinal para as chaves de settings (points_first_place, ...) ---
function ordinal(n) {
  return ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n];
}

// adicionar antes do module.exports

/** Reúne dados do banco, projeta piso/teto, deriva status, estima probabilidade. */
async function computeChances(group, tournamentId) {
  const [tournament, settings, standings] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    loadSettings(),
    getStandings(group, tournamentId),
  ]);
  if (!tournament) throw new Error('Torneio não encontrado');

  const totalRounds = tournament.totalRounds;
  const discardStartsAfter = settings.int('discard_starts_after_round');
  const bonusValue = settings.int('bonus_full_attendance');
  const trophyPositions = settings.int(group === 'M' ? 'trophy_positions_masculino' : 'trophy_positions_feminino');
  const pointsTable = [1, 2, 3, 4, 5, 6, 7].map((n) => settings.int(`points_${ordinal(n)}_place`));

  const completedRounds = await prisma.round.findMany({
    where: { group, status: 'COMPLETED', tournamentId },
  });
  const completedCount = completedRounds.length;
  const remaining = totalRounds - completedCount;

  const participants = await prisma.participant.findMany({
    where: { group, active: true, tournamentId },
    include: {
      results: { include: { round: true }, where: { round: { group, status: 'COMPLETED', tournamentId } } },
    },
  });

  // monta scores/presença/penalty por atleta
  const base = participants.map((p) => {
    const scores = p.results.map((r) => getPointsForResult(r, settings));
    const presentCompleted = p.results.filter(
      (r) => r.present || r.absentReason === 'SORTEIO' || r.absentReason === 'SORTEIO_VOLUNTARIA'
    ).length;
    const penalty = p.results.reduce((s, r) => s + Math.abs(r.uniformPenalty), 0);
    const presentAllCompleted = presentCompleted === completedCount;
    return { id: p.id, name: p.name, scores, presentCompleted, penalty, presentAllCompleted };
  });

  // piso (ausente nas restantes) e teto (vence todas as restantes)
  const withBounds = base.map((a) => {
    const floor = projectFinalPoints(a.scores.concat(Array(remaining).fill(0)), {
      totalRounds, completedCount: totalRounds, discardStartsAfter, bonusValue,
      presentAllRounds: false, penalty: a.penalty,
    });
    const ceil = projectFinalPoints(a.scores.concat(Array(remaining).fill(pointsTable[0])), {
      totalRounds, completedCount: totalRounds, discardStartsAfter, bonusValue,
      presentAllRounds: a.presentAllCompleted, penalty: a.penalty,
    });
    return { ...a, floor, ceil };
  });

  const statuses = deriveStatuses(withBounds.map((a) => ({ id: a.id, floor: a.floor, ceil: a.ceil })), trophyPositions);
  const statusById = new Map(statuses.map((s) => [s.id, s]));

  const probs = monteCarloProbabilities(
    base.map((a) => ({ id: a.id, scores: a.scores, presentCompleted: a.presentCompleted, penalty: a.penalty })),
    { totalRounds, remaining, discardStartsAfter, bonusValue, pointsTable, trophyPositions, iterations: 20000, seed: 12345 }
  );
  const probById = new Map(probs.map((p) => [p.id, p]));

  const posById = new Map(standings.map((s) => [s.participantId, s.position]));
  const ptsById = new Map(standings.map((s) => [s.participantId, s.pointsValid]));
  const leader = standings[0] || null;

  const athletes = withBounds
    .map((a) => {
      const st = statusById.get(a.id);
      const pr = probById.get(a.id);
      const item = {
        participantId: a.id,
        name: a.name,
        currentPosition: posById.get(a.id) ?? null,
        currentPoints: ptsById.get(a.id) ?? a.floor,
        maxPoints: a.ceil,
        titulo: st.titulo,
        trofeu: st.trofeu,
        probTitulo: pr.probTitulo,
        probTrofeu: pr.probTrofeu,
      };
      item.condicoes = buildCondicoes(item, {
        leaderName: leader ? leader.name : null,
        leaderPoints: leader ? leader.pointsValid : null,
      });
      return item;
    })
    .sort((x, y) => (x.currentPosition ?? 999) - (y.currentPosition ?? 999));

  return { group, totalRounds, remaining, trophyPositions, athletes };
}

module.exports = { projectFinalPoints, deriveStatuses, monteCarloProbabilities, buildCondicoes, computeChances };
```

- [ ] **Step 2: Sanity — carrega o módulo sem erro**

Run: `cd backend && node -e "require('./src/services/chancesTituloService'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Rodar os testes unitários (não podem ter quebrado)**

Run: `cd backend && node --test test/chancesTitulo.test.js`
Expected: PASS (13 tests).

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/chancesTituloService.js
git commit -m "feat(chances): computeChances (orquestrador Prisma)"
```

---

### Task 6: Rota `GET /chances` + smoke tests

**Files:**
- Create: `backend/src/routes/chances.js`
- Modify: `backend/src/index.js` (após a linha do `aproveitamento`)
- Modify: `qa/api-smoke-test.js` (antes do bloco `// ── Run ──`)

- [ ] **Step 1: Criar a rota**

```js
// backend/src/routes/chances.js
const express = require('express');
const { computeChances } = require('../services/chancesTituloService');

const router = express.Router({ mergeParams: true });

// GET /?group=F - chances de título e troféu (público)
router.get('/', async (req, res) => {
  try {
    const group = (req.query.group || 'F').toUpperCase();
    if (!['F', 'M'].includes(group)) {
      return res.status(400).json({ error: 'group deve ser F ou M' });
    }
    const data = await computeChances(group, req.tournament.id);
    res.json(data);
  } catch (error) {
    console.error('Error computing chances:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Registrar em `index.js`**

Localize a linha:
```js
app.use('/api/tournaments/:tournamentSlug/aproveitamento', tournamentMiddleware, require('./routes/aproveitamento'));
```
Adicione logo abaixo:
```js
app.use('/api/tournaments/:tournamentSlug/chances', tournamentMiddleware, require('./routes/chances'));
```

- [ ] **Step 3: Adicionar smoke tests** (antes de `// ── Run ──` em `qa/api-smoke-test.js`)

```js
test('CHA-1', 'GET /chances retorna estrutura { athletes[] } com status e probabilidades', async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/chances?group=F`);
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(Array.isArray(r.body.athletes), 'athletes não é array');
  assert(typeof r.body.trophyPositions === 'number', 'trophyPositions ausente');
  if (r.body.athletes.length > 0) {
    const a = r.body.athletes[0];
    assert(a.participantId && a.name, 'athlete sem participantId/name');
    assert(['garantido', 'vivo', 'depende_desempate', 'fora'].includes(a.titulo), `titulo inválido: ${a.titulo}`);
    assert(['garantido', 'vivo', 'depende_desempate', 'fora'].includes(a.trofeu), `trofeu inválido: ${a.trofeu}`);
    assert(a.probTitulo >= 0 && a.probTitulo <= 1, `probTitulo fora de [0,1]: ${a.probTitulo}`);
    assert(a.probTrofeu >= a.probTitulo - 1e-9, 'probTrofeu < probTitulo');
    assert(Array.isArray(a.condicoes), 'condicoes não é array');
  }
});

test('CHA-2', 'GET /chances rejeita group inválido', async () => {
  const r = await get(`/api/tournaments/${TEST_SLUG}/chances?group=X`);
  assert(r.status === 400, `esperado 400, recebido ${r.status}`);
});
```

- [ ] **Step 4: Validar sintaxe**

Run: `cd backend && node -c src/routes/chances.js && node -c src/index.js && echo SYNTAX_OK`
Expected: `SYNTAX_OK`

- [ ] **Step 5: Subir backend e rodar smoke**

```bash
cd backend && (NODE_ENV=development node src/index.js > /tmp/chances.log 2>&1 &) && sleep 2
cd /Users/Helder/Developer/sm-torneio && TEST_SLUG=demo node qa/api-smoke-test.js 2>&1 | grep -E "CHA-|Resultado"
pkill -f "node src/index.js"
```
Expected: `CHA-1` e `CHA-2` PASS; `Resultado: ... 0 FAIL`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/chances.js backend/src/index.js qa/api-smoke-test.js
git commit -m "feat(chances): rota pública GET /chances + smoke CHA-1/CHA-2"
```

---

### Task 7: Redação por IA (`generateChancesText`) com fallback

**Files:**
- Modify: `backend/src/services/insightService.js`
- Modify: `backend/src/services/chancesTituloService.js` (usar a redação no orquestrador)

- [ ] **Step 1: Adicionar `generateChancesText` ao insightService**

```js
// adicionar em backend/src/services/insightService.js, antes do module.exports

const CHANCES_SYSTEM = `Você é um assistente do Torneio Secos & Molhados. Recebe FATOS já calculados sobre as chances de uma atleta (título e troféu) e deve reescrevê-los em 1-2 frases curtas, português brasileiro, segunda pessoa ("você"), tom encorajador e natural. SEM emojis, SEM markdown.

REGRAS ABSOLUTAS:
- NÃO altere, invente ou recalcule nenhum número, nome ou colocação. Use exatamente os valores recebidos.
- NÃO adicione fatos novos. Apenas reescreva com clareza o que recebeu.
- Se os fatos disserem "garantido" ou "sem chance", mantenha esse significado.`;

async function generateChancesText({ name, facts }) {
  const c = getClient();
  if (!c) return null;
  try {
    const userPrompt = `Atleta: ${name}\nFatos (não altere números):\n- ${facts.join('\n- ')}`;
    const sdkCall = c.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: CHANCES_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`chances timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    );
    const resp = await Promise.race([sdkCall, timeoutPromise]);
    const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text.trim() : null;
    return text || null;
  } catch (err) {
    console.error('[insightService] Erro em generateChancesText:', err.message);
    return null;
  }
}

module.exports = { generateInsight, generateChancesText };
```

- [ ] **Step 2: Usar a redação no orquestrador (campo `resumo`, com fallback)**

Em `computeChances` (chancesTituloService.js), após montar `athletes`, antes do `return`, adicione:

```js
  const { generateChancesText } = require('./insightService');
  await Promise.all(
    athletes.map(async (a) => {
      const ai = await generateChancesText({ name: a.name, facts: a.condicoes });
      a.resumo = ai || a.condicoes.join(' '); // fallback = template puro
    })
  );
```

- [ ] **Step 3: Sanity + testes unitários continuam passando**

Run: `cd backend && node -e "require('./src/services/chancesTituloService'); require('./src/services/insightService'); console.log('OK')" && node --test test/chancesTitulo.test.js`
Expected: `OK` e 13 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/insightService.js backend/src/services/chancesTituloService.js
git commit -m "feat(chances): redação por IA com fallback para template"
```

---

### Task 8: Hook `useChances` (frontend)

**Files:**
- Create: `frontend/src/hooks/useChances.js`

- [ ] **Step 1: Criar o hook**

```jsx
// frontend/src/hooks/useChances.js
import { useEffect, useState } from 'react';
import { useTournament } from './useTournament';

/** GET /chances?group=F do torneio atual. { data, loading, error }. */
export function useChances(group = 'F') {
  const { tApi, slug } = useTournament();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    tApi.get(`/chances?group=${group}`)
      .then((res) => { if (!cancelled) setState({ data: res.data, loading: false, error: null }); })
      .catch((err) => { if (!cancelled) setState({ data: null, loading: false, error: err }); });
    return () => { cancelled = true; };
  }, [slug, group]);

  return state;
}
```

- [ ] **Step 2: Build sanity**

Run: `cd frontend && npm run build 2>&1 | tail -2`
Expected: `✓ built`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useChances.js
git commit -m "feat(chances): hook useChances"
```

---

### Task 9: Seção `ChancesTitulo` na página da atleta

**Files:**
- Create: `frontend/src/components/ChancesTitulo.jsx`
- Modify: `frontend/src/pages/Participante.jsx`

- [ ] **Step 1: Criar o componente**

```jsx
// frontend/src/components/ChancesTitulo.jsx
import { useChances } from '../hooks/useChances';

function statusLabel(titulo, trofeu) {
  if (titulo === 'garantido') return { txt: 'Título garantido', cls: 'bg-amber-100 text-amber-800' };
  if (titulo === 'vivo') return { txt: 'Ainda pode ser campeã', cls: 'bg-emerald-100 text-emerald-700' };
  if (titulo === 'depende_desempate') return { txt: 'Título depende de desempate', cls: 'bg-amber-50 text-amber-700' };
  if (trofeu === 'garantido') return { txt: 'Troféu garantido', cls: 'bg-emerald-50 text-emerald-700' };
  if (trofeu === 'vivo') return { txt: 'Na disputa pelo troféu', cls: 'bg-sky-100 text-sky-700' };
  if (trofeu === 'depende_desempate') return { txt: 'Troféu depende de desempate', cls: 'bg-sky-50 text-sky-700' };
  return { txt: 'Sem chance de troféu', cls: 'bg-neutral-100 text-neutral-500' };
}

function Bar({ label, value }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-neutral-600">{label}</span>
        <span className="text-neutral-500">{pct}% <span className="text-neutral-400">(estimativa)</span></span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#9B2D3E] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ChancesTitulo({ participantId, group }) {
  const { data, loading, error } = useChances(group);

  if (loading) {
    return <div className="bg-white rounded-xl border border-neutral-200/80 p-5 animate-pulse h-28" />;
  }
  if (error || !data) {
    return <p className="text-sm text-neutral-400">Não foi possível calcular as chances.</p>;
  }
  const me = data.athletes.find((a) => a.participantId === participantId);
  if (!me) return null;

  const st = statusLabel(me.titulo, me.trofeu);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
        <h2 className="font-semibold text-neutral-900">Chances de título e troféu</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          {data.remaining > 0 ? `${data.remaining} etapa(s) restante(s)` : 'Temporada encerrada'} · troféu = top {data.trophyPositions}
        </p>
      </div>
      <div className="p-5 space-y-4">
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.txt}</span>

        {/* Fato (regulamento) */}
        <div className="text-sm text-neutral-700 leading-relaxed">
          {me.resumo || (me.condicoes || []).join(' ')}
        </div>

        {/* Estimativa */}
        <div className="space-y-3 pt-1">
          <Bar label="Chance de título" value={me.probTitulo} />
          <Bar label="Chance de troféu" value={me.probTrofeu} />
        </div>

        <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-3">
          A porcentagem é uma <strong>estimativa</strong> (assume chances iguais entre as atletas). As condições acima são exatas pelo regulamento.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrar em `Participante.jsx`**

Adicione o import no topo (junto do import de `AproveitamentoMini`):
```jsx
import ChancesTitulo from '../components/ChancesTitulo';
```
Localize a seção de Aproveitamento (`{/* ── 2b. APROVEITAMENTO (mini-rankings) ─────────────────── */}`) e **antes** dela, insira:
```jsx
      {/* ── 2a. CHANCES DE TÍTULO E TROFÉU ─────────────────────── */}
      <section className="mb-5">
        <ChancesTitulo participantId={id} group={participant.group} />
      </section>

```

- [ ] **Step 3: Build + verificação visual**

Run: `cd frontend && npm run build 2>&1 | tail -2`
Expected: `✓ built`

Depois subir backend + preview (`.claude/launch.json` → "Frontend (Vite)"), navegar a `/t/demo/participante/<id>` e confirmar que a seção renderiza com status, barras "(estimativa)" e texto. Checar console sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChancesTitulo.jsx frontend/src/pages/Participante.jsx
git commit -m "feat(chances): seção Chances de título e troféu na página da atleta"
```

---

### Task 10: Selo 👑/🏆 na Classificação

**Files:**
- Modify: `frontend/src/components/StandingsTable.jsx`
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/pages/Classificacao.jsx`

- [ ] **Step 1: StandingsTable aceita `chancesByParticipant` e renderiza o selo**

Em `frontend/src/components/StandingsTable.jsx`, altere a assinatura:
```jsx
export default function StandingsTable({ standings, showDetails = true, chancesByParticipant = null }) {
```
Adicione helper abaixo de `positionBadge`:
```jsx
function chanceIcon(ch) {
  if (!ch) return null;
  if (ch.titulo === 'vivo' || ch.titulo === 'garantido') return { emoji: '👑', title: 'Ainda pode ser campeã' };
  if (ch.titulo === 'fora' && ch.trofeu === 'vivo') return { emoji: '🏆', title: 'Ainda pode ganhar troféu' };
  return null;
}
```
Na célula `#` (a que tem o `positionBadge`), troque o conteúdo para prefixar o ícone. Substitua:
```jsx
              <td className={`sticky left-0 z-10 w-14 px-2 py-3 text-center border-b border-neutral-100 ${rowBg}`}>
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base ${positionBadge(s.position)}`} title={`${s.position}º lugar`}>
                  {POSITION_EMOJI[s.position] ?? s.position}
                </span>
              </td>
```
por:
```jsx
              <td className={`sticky left-0 z-10 px-2 py-3 text-center border-b border-neutral-100 ${rowBg}`}>
                {(() => {
                  const ic = chanceIcon(chancesByParticipant ? chancesByParticipant.get(s.participantId) : null);
                  return (
                    <span className="inline-flex items-center gap-1">
                      {ic && <span className="text-sm" title={ic.title}>{ic.emoji}</span>}
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base ${positionBadge(s.position)}`} title={`${s.position}º lugar`}>
                        {POSITION_EMOJI[s.position] ?? s.position}
                      </span>
                    </span>
                  );
                })()}
              </td>
```
E remova o `w-14 ` do `<th>` do cabeçalho `#` (primeira `<th>` do thead), já que o ícone pode alargar a célula.

> Observação: a coluna `Nome` usa `left-14` (sticky). Com a largura do `#` agora variável, pode haver um pequeno desalinhamento do sticky quando houver ícone — aceitável na v1. Não alterar `left-14`.

- [ ] **Step 2: `Classificacao.jsx` busca chances e passa o Map**

Adicione o import:
```jsx
import { useChances } from '../hooks/useChances';
```
Dentro do componente, após os hooks existentes:
```jsx
  const { data: chancesData } = useChances(groupKey);
  const chancesMap = chancesData
    ? new Map(chancesData.athletes.map((a) => [a.participantId, { titulo: a.titulo, trofeu: a.trofeu }]))
    : null;
```
No render de pontuação, troque:
```jsx
          <StandingsTable standings={standings} />
```
por:
```jsx
          <StandingsTable standings={standings} chancesByParticipant={chancesMap} />
```

- [ ] **Step 3: `Home.jsx` idem**

Adicione o import:
```jsx
import { useChances } from '../hooks/useChances';
```
Após os states, adicione (usa o `group` local da Home):
```jsx
  const { data: chancesData } = useChances(group);
  const chancesMap = chancesData
    ? new Map(chancesData.athletes.map((a) => [a.participantId, { titulo: a.titulo, trofeu: a.trofeu }]))
    : null;
```
Troque:
```jsx
          <StandingsTable standings={standings} showDetails={true} />
```
por:
```jsx
          <StandingsTable standings={standings} showDetails={true} chancesByParticipant={chancesMap} />
```

- [ ] **Step 4: Build + verificação visual**

Run: `cd frontend && npm run build 2>&1 | tail -2`
Expected: `✓ built`

Subir backend + preview, abrir `/t/demo/classificacao/feminino` e `/t/demo` e confirmar: 👑 aparece antes da medalha/posição de quem está vivo pro título; 🏆 para quem briga só pelo troféu; sem ícone para o resto. Console sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StandingsTable.jsx frontend/src/pages/Home.jsx frontend/src/pages/Classificacao.jsx
git commit -m "feat(chances): selo 👑/🏆 na Classificação (Home e página)"
```

---

### Task 11: Deploy + verificação em produção

**Files:** nenhum (deploy).

- [ ] **Step 1: Rodar todos os testes unitários e smoke uma última vez**

```bash
cd backend && node --test test/chancesTitulo.test.js
cd backend && (NODE_ENV=development node src/index.js > /tmp/chances.log 2>&1 &) && sleep 2
cd /Users/Helder/Developer/sm-torneio && TEST_SLUG=demo node qa/api-smoke-test.js 2>&1 | grep -E "CHA-|Resultado"
pkill -f "node src/index.js"
```
Expected: 13 unit PASS; CHA-1/CHA-2 PASS; 0 FAIL.

- [ ] **Step 2: Merge na main e push** (padrão da sessão: commits diretos em main)

```bash
git push origin main
```
(Se estiver numa feature branch: `git checkout main && git merge --no-ff <branch> -m "merge: chances de título e troféu" && git push origin main`.)

- [ ] **Step 3: Aguardar deploy e verificar produção**

```bash
curl -s "https://www.sm-ttc.com.br/api/tournaments/2026/chances?group=F" | head -c 400
```
Expected: JSON com `athletes[]`, `trophyPositions: 4`.

Checks E2E:
- `curl .../chances?group=F` e `?group=M` retornam estrutura correta.
- Spot-check determinístico: líder sai `titulo` coerente; quem está fora do top 4 (F) sai `trofeu: fora`.
- Coerência: quem é `titulo:fora` tem `probTitulo` 0; quem é `trofeu:garantido` tem `probTrofeu` 1.
- Abrir `/t/2026/classificacao/feminino`: 👑/🏆 aparecem corretos.
- Abrir perfil da Natalia: seção "Chances de título e troféu" com status, barras "(estimativa)" e texto.

- [ ] **Step 4: Confirmar fallback se a `ANTHROPIC_API_KEY` não estiver no Railway**

O texto deve cair no template (`condicoes.join(' ')`) sem quebrar. (Config da chave é ação do usuário.)

---

## Notas de execução

- **Confiabilidade:** números só do backend; a IA nunca recalcula (prompt proíbe e há fallback).
- **Performance:** `iterations: 20000` é barato para ~15–30 atletas e 1 etapa; se ficar lento com R maior em temporadas futuras, reduzir iterações ou cachear.
- **Determinismo:** Monte Carlo usa seed fixa (`12345`) → resultados estáveis entre requests (bom para não "piscar" a % a cada reload).
- **Ordem de execução (dependências):** Tasks 1→5 são sequenciais (mesmo arquivo). Task 6 depende de 5. Task 7 depende de 5. Tasks 8→10 dependem de 6 (endpoint). Task 11 por último.
