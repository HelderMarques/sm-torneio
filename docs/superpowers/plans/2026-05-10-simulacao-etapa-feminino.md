# Simulação de Etapa Feminino — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a página `/t/2026/simular` por uma nova versão F-only, com fluxo por duplas + sorteios + faltas, gating temporal (7h-19h dia da etapa), insight personalizado por LLM (Claude Haiku 4.5), e persistência local em sessionStorage.

**Architecture:** Frontend (React/Vite) chama 2 endpoints novos (`GET /simulacao/availability` e `POST /simulacao/simular`) que rodam no backend Node/Express. O endpoint de simular monta `simulatedResults` no formato esperado pelo `simulateStandings()` existente, chama a LLM via Anthropic SDK server-side, e devolve standings + insight. Estado da página persiste em `sessionStorage` enquanto a etapa do dia for a mesma.

**Tech Stack:** Node 20, Express, Prisma (sem mudança de schema), React 18, Vite, Tailwind, `@anthropic-ai/sdk` (nova dep), Anthropic Claude Haiku 4.5.

**Spec de referência:** `docs/superpowers/specs/2026-05-10-simulacao-etapa-feminino-design.md`

---

## File Structure

### Backend (criar)
- `backend/src/utils/timeWindow.js` — helper que diz se "agora" está dentro de janela horária em timezone informado.
- `backend/src/routes/simulacao.js` — 2 rotas: `GET /availability` e `POST /simular`.
- `backend/src/services/insightService.js` — wrapper para Anthropic SDK com prompt + caching.
- `backend/src/services/simulationMapper.js` — converte payload (duplas/absentees) em `simulatedResults` no formato do `simulateStandings()`.

### Backend (modificar)
- `backend/package.json` — adicionar `@anthropic-ai/sdk`.
- `backend/src/index.js` — registrar rota nova entre as tournament-scoped.

### Frontend (substituir conteúdo)
- `frontend/src/pages/SimularEtapa.jsx` — reescrita completa (F-only, novo fluxo).

### Frontend (criar)
- `frontend/src/hooks/useSimulationAvailability.js` — hook que consome GET /availability.
- `frontend/src/components/SimulacaoButton.jsx` — botão que aparece só se `available`.
- `frontend/src/components/simulacao/ViewerSelector.jsx` — select "Quem é você?".
- `frontend/src/components/simulacao/AusenciasSection.jsx` — checkboxes de FALTA/SORTEIO/SORTEIO_VOLUNTARIA.
- `frontend/src/components/simulacao/DuplasSection.jsx` — duplas dinâmicas + posições.
- `frontend/src/components/simulacao/SimulationResultView.jsx` — card da viewer destacado + insight + tabela.
- `frontend/src/components/simulacao/storage.js` — helpers de sessionStorage e hash de input.

### Frontend (modificar)
- `frontend/src/pages/Classificacao.jsx` — injetar `<SimulacaoButton>` quando `groupKey === 'F'`.
- `frontend/src/pages/Home.jsx` linhas 103-108 — remover botão "Simular Etapa".

### QA
- `qa/api-smoke-test.js` — adicionar cenários para os 2 novos endpoints.

---

## Task 1: Adicionar `@anthropic-ai/sdk` ao backend

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1.1: Instalar dependência**

Run:
```bash
cd /Users/Helder/Developer/sm-torneio/backend && npm install @anthropic-ai/sdk
```
Expected: pacote adicionado em `dependencies` no `package.json`, `node_modules` populado.

- [ ] **Step 1.2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add @anthropic-ai/sdk dependency"
```

---

## Task 2: Helper de janela horária

**Files:**
- Create: `backend/src/utils/timeWindow.js`

- [ ] **Step 2.1: Criar helper**

Arquivo `backend/src/utils/timeWindow.js`:
```javascript
/**
 * Retorna a data atual (YYYY-MM-DD) e a hora atual (0-23) no timezone informado.
 * Default: America/Sao_Paulo.
 */
function nowInTimezone(timezone = 'America/Sao_Paulo') {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parseInt(parts.hour, 10);
  return { date, hour };
}

/**
 * `hour` é 0-23 (sem minutos). Retorna true se hour ∈ [startHour, endHour).
 */
function isWithinWindow(hour, startHour, endHour) {
  return hour >= startHour && hour < endHour;
}

module.exports = { nowInTimezone, isWithinWindow };
```

- [ ] **Step 2.2: Teste manual rápido**

Run:
```bash
node -e "const {nowInTimezone, isWithinWindow} = require('./backend/src/utils/timeWindow'); const x = nowInTimezone(); console.log(x); console.log('within 7-19?', isWithinWindow(x.hour, 7, 19));"
```
Expected: imprime `{ date: 'YYYY-MM-DD', hour: <0-23> }` e um boolean.

- [ ] **Step 2.3: Commit**

```bash
git add backend/src/utils/timeWindow.js
git commit -m "feat(backend): add timezone-aware window helper"
```

---

## Task 3: Mapper de duplas para `simulatedResults`

**Files:**
- Create: `backend/src/services/simulationMapper.js`

- [ ] **Step 3.1: Criar mapper**

Arquivo `backend/src/services/simulationMapper.js`:
```javascript
/**
 * Converte payload da nova simulação em `simulatedResults` (formato esperado por simulateStandings).
 *
 * Input:
 *   absentees: [{ participantId, reason: 'FALTA'|'SORTEIO'|'SORTEIO_VOLUNTARIA' }]
 *   duplas:    [{ playerAId, playerBId, position: 1..7 }]
 *
 * Output:
 *   simulatedResults: [{ participantId, present, absentReason, position,
 *                         setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
 *                         uniformPenalty: 0 }]
 *
 * Importante: sets/games são zerados porque a simulação não tem dados de jogos
 * individuais — só posição final por dupla. Isso pode afetar tiebreaker em empates
 * — limitação aceita do MVP.
 */
function buildSimulatedResults({ absentees = [], duplas = [] }) {
  const results = [];
  const seen = new Set();

  for (const a of absentees) {
    if (!a.participantId) continue;
    if (seen.has(a.participantId)) {
      throw Object.assign(new Error(`Participante ${a.participantId} listado duas vezes`), { code: 400 });
    }
    seen.add(a.participantId);
    results.push({
      participantId: a.participantId,
      present: false,
      absentReason: a.reason || 'FALTA',
      position: null,
      setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
      uniformPenalty: 0,
    });
  }

  for (const d of duplas) {
    if (!d.playerAId || !d.playerBId) {
      throw Object.assign(new Error('Cada dupla precisa de 2 jogadoras'), { code: 400 });
    }
    if (d.playerAId === d.playerBId) {
      throw Object.assign(new Error('Os 2 jogadores da dupla precisam ser diferentes'), { code: 400 });
    }
    if (!d.position || d.position < 1 || d.position > 7) {
      throw Object.assign(new Error('Posição da dupla deve ser entre 1 e 7'), { code: 400 });
    }
    for (const pid of [d.playerAId, d.playerBId]) {
      if (seen.has(pid)) {
        throw Object.assign(new Error(`Participante ${pid} listado duas vezes`), { code: 400 });
      }
      seen.add(pid);
      results.push({
        participantId: pid,
        present: true,
        absentReason: 'NONE',
        position: d.position,
        setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
        uniformPenalty: 0,
      });
    }
  }

  return results;
}

module.exports = { buildSimulatedResults };
```

- [ ] **Step 3.2: Testar mapper standalone**

Run:
```bash
node -e "
const { buildSimulatedResults } = require('./backend/src/services/simulationMapper');
const r = buildSimulatedResults({
  absentees: [{ participantId: 'a1', reason: 'FALTA' }, { participantId: 'a2', reason: 'SORTEIO' }],
  duplas:    [{ playerAId: 'p1', playerBId: 'p2', position: 1 }, { playerAId: 'p3', playerBId: 'p4', position: 2 }],
});
console.log(JSON.stringify(r, null, 2));
"
```
Expected: 6 entradas, 2 com `present:false` e reason correto, 4 com `present:true` e position correta.

- [ ] **Step 3.3: Testar validação**

Run:
```bash
node -e "
const { buildSimulatedResults } = require('./backend/src/services/simulationMapper');
try { buildSimulatedResults({ duplas: [{ playerAId: 'p1', playerBId: 'p1', position: 1 }] }); }
catch(e) { console.log('OK:', e.message); }
"
```
Expected: imprime "OK: Os 2 jogadores da dupla precisam ser diferentes".

- [ ] **Step 3.4: Commit**

```bash
git add backend/src/services/simulationMapper.js
git commit -m "feat(backend): add simulation payload to simulatedResults mapper"
```

---

## Task 4: Endpoint `GET /simulacao/availability`

**Files:**
- Create: `backend/src/routes/simulacao.js`
- Modify: `backend/src/index.js`

- [ ] **Step 4.1: Criar arquivo de rotas com /availability**

Arquivo `backend/src/routes/simulacao.js`:
```javascript
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { nowInTimezone, isWithinWindow } = require('../utils/timeWindow');

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

const WINDOW_START = 7;
const WINDOW_END = 19;
const TIMEZONE = 'America/Sao_Paulo';

/**
 * GET /availability?group=F
 * Retorna { available, reason, etapa }.
 */
router.get('/availability', async (req, res) => {
  try {
    const group = (req.query.group || 'F').toUpperCase();
    if (!['F', 'M'].includes(group)) {
      return res.status(400).json({ error: 'group deve ser F ou M' });
    }

    const tournament = req.tournament;
    if (!tournament.simulateEnabled) {
      return res.json({ available: false, reason: 'desativado', etapa: null });
    }

    const { date, hour } = nowInTimezone(TIMEZONE);

    const etapa = await prisma.round.findFirst({
      where: { tournamentId: tournament.id, group, date },
      select: { id: true, number: true, date: true, status: true },
    });

    if (!etapa) {
      return res.json({ available: false, reason: 'sem_etapa_hoje', etapa: null });
    }
    if (etapa.status === 'COMPLETED') {
      return res.json({ available: false, reason: 'etapa_concluida', etapa });
    }
    if (!isWithinWindow(hour, WINDOW_START, WINDOW_END)) {
      return res.json({ available: false, reason: 'fora_da_janela', etapa });
    }
    return res.json({ available: true, reason: null, etapa });
  } catch (err) {
    console.error('Error in /simulacao/availability:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
```

- [ ] **Step 4.2: Registrar rota no index.js**

Modificar `backend/src/index.js`. Localizar este bloco (linhas 30-32):
```javascript
app.use('/api/tournaments/:tournamentSlug/participants', tournamentMiddleware, participantRoutes);
app.use('/api/tournaments/:tournamentSlug/rounds', tournamentMiddleware, roundRoutes);
app.use('/api/tournaments/:tournamentSlug/standings', tournamentMiddleware, standingsRoutes);
```

Adicionar logo abaixo:
```javascript
app.use('/api/tournaments/:tournamentSlug/simulacao', tournamentMiddleware, require('./routes/simulacao'));
```

- [ ] **Step 4.3: Testar localmente**

Run:
```bash
cd backend && (node src/index.js &) && sleep 2 && curl -s "http://localhost:3001/api/tournaments/demo/simulacao/availability?group=F" && echo "" && pkill -f "node src/index.js"
```
Expected: JSON `{ available: false, reason: 'desativado' | 'sem_etapa_hoje', etapa: ... }` (dependendo do estado da DB local).

- [ ] **Step 4.4: Commit**

```bash
git add backend/src/routes/simulacao.js backend/src/index.js
git commit -m "feat(backend): add GET /simulacao/availability endpoint"
```

---

## Task 5: Endpoint `POST /simulacao/simular` (sem LLM ainda)

**Files:**
- Modify: `backend/src/routes/simulacao.js`

- [ ] **Step 5.1: Adicionar POST /simular**

Adicionar no fim de `backend/src/routes/simulacao.js`, ANTES de `module.exports`:
```javascript
const { buildSimulatedResults } = require('../services/simulationMapper');
const { simulateStandings, getStandings } = require('../services/standingsService');

/**
 * POST /simular
 * Body: { viewerParticipantId, group, absentees, duplas }
 * Retorna: { standings, viewer: {...}, insight: null|string }
 */
router.post('/simular', async (req, res) => {
  try {
    const { viewerParticipantId, group, absentees, duplas } = req.body || {};
    const grp = (group || 'F').toUpperCase();
    if (!['F', 'M'].includes(grp)) return res.status(400).json({ error: 'group deve ser F ou M' });
    if (!viewerParticipantId) return res.status(400).json({ error: 'viewerParticipantId é obrigatório' });
    if (!Array.isArray(duplas) || duplas.length < 2) {
      return res.status(400).json({ error: 'pelo menos 2 duplas são necessárias' });
    }

    // Revalida janela
    const tournament = req.tournament;
    if (!tournament.simulateEnabled) return res.status(403).json({ error: 'Simulação desativada' });
    const { date, hour } = nowInTimezone(TIMEZONE);
    const etapa = await prisma.round.findFirst({
      where: { tournamentId: tournament.id, group: grp, date },
    });
    if (!etapa || etapa.status === 'COMPLETED' || !isWithinWindow(hour, WINDOW_START, WINDOW_END)) {
      return res.status(403).json({ error: 'Simulação fora da janela permitida' });
    }

    // Confirma viewer
    const viewer = await prisma.participant.findFirst({
      where: { id: viewerParticipantId, tournamentId: tournament.id, group: grp, active: true },
    });
    if (!viewer) return res.status(400).json({ error: 'Atleta selecionada (viewer) não encontrada' });

    // Posições únicas por dupla (Etapa F com 1 quadra → posições 1-5 distintas)
    const positions = duplas.map((d) => d.position);
    const dups = positions.filter((p, i) => positions.indexOf(p) !== i);
    if (dups.length > 0) return res.status(400).json({ error: 'Cada posição só pode ter uma dupla' });

    // Monta simulatedResults
    let simulatedResults;
    try {
      simulatedResults = buildSimulatedResults({ absentees, duplas });
    } catch (err) {
      return res.status(err.code === 400 ? 400 : 500).json({ error: err.message });
    }

    // Atletas ativas não listadas viram FALTA automática
    const allActive = await prisma.participant.findMany({
      where: { tournamentId: tournament.id, group: grp, active: true },
      select: { id: true },
    });
    const present = new Set(simulatedResults.map((r) => r.participantId));
    for (const p of allActive) {
      if (!present.has(p.id)) {
        simulatedResults.push({
          participantId: p.id, present: false, absentReason: 'FALTA',
          position: null, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, uniformPenalty: 0,
        });
      }
    }

    // Simula
    const standings = await simulateStandings(grp, tournament.id, simulatedResults);

    // Encontra a viewer no resultado
    const viewerStanding = standings.find((s) => s.participantId === viewerParticipantId);

    res.json({
      standings,
      viewer: viewerStanding ? {
        participantId: viewerStanding.participantId,
        name: viewerStanding.name,
        oldPosition: viewerStanding.oldPosition,
        newPosition: viewerStanding.position,
        delta: viewerStanding.positionDelta,
        oldPoints: viewerStanding.oldPointsValid,
        newPoints: viewerStanding.pointsValid,
      } : null,
      insight: null, // será adicionado na Task 7
    });
  } catch (err) {
    console.error('Error in /simulacao/simular:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
```

- [ ] **Step 5.2: Testar localmente (requer dia de etapa)**

Para testar, mude temporariamente a data de um round F no banco local para hoje, OU faça um teste de erro:

Run:
```bash
cd backend && (node src/index.js &) && sleep 2 && curl -s -X POST "http://localhost:3001/api/tournaments/demo/simulacao/simular" -H "Content-Type: application/json" -d '{"viewerParticipantId":"x","group":"F","absentees":[],"duplas":[]}' && echo "" && pkill -f "node src/index.js"
```
Expected: erro 400 ou 403 (dependendo do estado).

- [ ] **Step 5.3: Commit**

```bash
git add backend/src/routes/simulacao.js
git commit -m "feat(backend): add POST /simulacao/simular endpoint (no LLM yet)"
```

---

## Task 6: Insight service com Anthropic SDK

**Files:**
- Create: `backend/src/services/insightService.js`

- [ ] **Step 6.1: Antes de implementar, use o skill claude-api**

Invoque o skill `claude-api` (via Skill tool) para receber orientação sobre prompt caching com Claude Haiku 4.5. Siga as recomendações da skill para estruturar a chamada.

- [ ] **Step 6.2: Criar insightService**

Arquivo `backend/src/services/insightService.js`:
```javascript
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 300;
const TIMEOUT_MS = 8000;

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `Você é um assistente do Torneio Recreativo Secos & Molhados (Tijuca Tênis Clube), formato em duplas com double-loss. Pontuação por posição na etapa: 1º=100, 2º=80, 3º=70, 4º=60, 5º=50, 6º=40. Sorteio (sit-out): 80 pts. Sorteio voluntário: 60 pts. Falta: 0.

Você recebe o resultado SIMULADO de uma etapa do ponto de vista de uma atleta específica (a "viewer"). Gere um insight em 2-3 frases curtas, em português brasileiro, segunda pessoa ("você"), tom empolgado mas natural. SEM emojis. SEM markdown.

REGRAS:
- NÃO mencione número de sets, games, placares ou saldos. A simulação não tem dados de jogos individuais — apenas posição final das duplas.
- Foque em: variação de posição no ranking geral, pontos, distâncias para vizinhos no ranking, e dinâmica de quem ultrapassou quem.
- Seja específico: use nomes de outras atletas quando relevante (ex: "passaria à frente da Mariana").
- Se a posição não mudou, comente os pontos absolutos e o gap para a próxima posição.`;

function buildUserPrompt({ viewer, simulatedStandings }) {
  const top3 = simulatedStandings.slice(0, 3).map((s, i) => `${i+1}º ${s.name} (${s.pointsValid} pts)`).join(', ');

  // Quem ultrapassou ou foi ultrapassada
  let movement = '';
  if (viewer.delta > 0) {
    // Subiu — quem ficou pra trás
    const passados = simulatedStandings
      .filter((s) => s.oldPosition < viewer.oldPosition && s.position > viewer.newPosition)
      .map((s) => s.name);
    movement = passados.length ? `Ultrapassou: ${passados.join(', ')}` : 'Subiu sem ultrapassar nome específico.';
  } else if (viewer.delta < 0) {
    const passou = simulatedStandings
      .filter((s) => s.oldPosition > viewer.oldPosition && s.position < viewer.newPosition)
      .map((s) => s.name);
    movement = passou.length ? `Foi ultrapassada por: ${passou.join(', ')}` : 'Caiu sem alguém específico ultrapassar.';
  } else {
    movement = 'Posição mantida.';
  }

  // Gap até o pódio
  const podio = simulatedStandings.find((s) => s.position === 3);
  const gapPodio = podio && viewer.newPosition > 3 ? `Gap até o 3º lugar: ${podio.pointsValid - viewer.newPoints} pts.` : '';

  return `Atleta: ${viewer.name}
Posição anterior: ${viewer.oldPosition}º (${viewer.oldPoints} pts)
Nova posição simulada: ${viewer.newPosition}º (${viewer.newPoints} pts)
Delta: ${viewer.delta > 0 ? '+' : ''}${viewer.delta}
${movement}
Top 3 simulado: ${top3}
${gapPodio}`.trim();
}

async function generateInsight({ viewer, simulatedStandings }) {
  const c = getClient();
  if (!c) {
    console.warn('[insightService] ANTHROPIC_API_KEY não configurada — retornando insight null');
    return null;
  }
  try {
    const userPrompt = buildUserPrompt({ viewer, simulatedStandings });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    }, { signal: controller.signal });

    clearTimeout(timer);
    const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text.trim() : null;
    return text || null;
  } catch (err) {
    console.error('[insightService] Erro ao gerar insight:', err.message);
    return null;
  }
}

module.exports = { generateInsight };
```

- [ ] **Step 6.3: Teste manual (sem API key → retorna null)**

Run:
```bash
node -e "
const { generateInsight } = require('./backend/src/services/insightService');
(async () => {
  const r = await generateInsight({
    viewer: { name: 'Natalia', oldPosition: 1, newPosition: 1, delta: 0, oldPoints: 200, newPoints: 300 },
    simulatedStandings: [
      { participantId: 'a', name: 'Natalia', position: 1, oldPosition: 1, pointsValid: 300, positionDelta: 0 },
      { participantId: 'b', name: 'Giovana', position: 2, oldPosition: 2, pointsValid: 240, positionDelta: 0 },
      { participantId: 'c', name: 'Núbia', position: 3, oldPosition: 3, pointsValid: 200, positionDelta: 0 },
    ],
  });
  console.log('result:', r);
})();
"
```
Expected: `result: null` (sem API key) ou texto real (com API key configurada).

- [ ] **Step 6.4: Commit**

```bash
git add backend/src/services/insightService.js
git commit -m "feat(backend): add Anthropic-based insight generator"
```

---

## Task 7: Integrar insight no POST /simular

**Files:**
- Modify: `backend/src/routes/simulacao.js`

- [ ] **Step 7.1: Importar e chamar insightService**

No topo de `backend/src/routes/simulacao.js`, após os outros requires, adicionar:
```javascript
const { generateInsight } = require('../services/insightService');
```

Localizar a linha `insight: null, // será adicionado na Task 7` no handler do POST /simular e substituir o bloco final por:
```javascript
    // Gera insight (não bloqueia em caso de erro)
    let insight = null;
    if (viewerStanding) {
      try {
        insight = await generateInsight({
          viewer: {
            name: viewerStanding.name,
            oldPosition: viewerStanding.oldPosition,
            newPosition: viewerStanding.position,
            delta: viewerStanding.positionDelta,
            oldPoints: viewerStanding.oldPointsValid,
            newPoints: viewerStanding.pointsValid,
          },
          simulatedStandings: standings,
        });
      } catch (err) {
        console.error('[POST /simular] Erro no insight:', err.message);
      }
    }

    res.json({
      standings,
      viewer: viewerStanding ? {
        participantId: viewerStanding.participantId,
        name: viewerStanding.name,
        oldPosition: viewerStanding.oldPosition,
        newPosition: viewerStanding.position,
        delta: viewerStanding.positionDelta,
        oldPoints: viewerStanding.oldPointsValid,
        newPoints: viewerStanding.pointsValid,
      } : null,
      insight,
    });
```

(remove o `res.json` antigo com `insight: null`).

- [ ] **Step 7.2: Commit**

```bash
git add backend/src/routes/simulacao.js
git commit -m "feat(backend): wire insight generation into POST /simular"
```

---

## Task 8: Extender QA smoke tests

**Files:**
- Modify: `qa/api-smoke-test.js`

- [ ] **Step 8.1: Adicionar cenários**

No final do bloco de testes (antes do summary final, procure por onde os outros `test(...)` são registrados), adicionar:
```javascript
test('SIM-1', 'GET /simulacao/availability retorna estrutura esperada', async () => {
  const res = await get(`/api/tournaments/${TEST_SLUG}/simulacao/availability?group=F`);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  if (typeof res.body.available !== 'boolean') throw new Error('available não é boolean');
  if (res.body.available === false && !res.body.reason) throw new Error('reason ausente quando indisponível');
});

test('SIM-2', 'GET /simulacao/availability rejeita group inválido', async () => {
  const res = await get(`/api/tournaments/${TEST_SLUG}/simulacao/availability?group=X`);
  if (res.status !== 400) throw new Error(`esperado 400, recebido ${res.status}`);
});

test('SIM-3', 'POST /simulacao/simular rejeita body vazio com 400', async () => {
  const res = await post(`/api/tournaments/${TEST_SLUG}/simulacao/simular`, {});
  if (![400, 403].includes(res.status)) throw new Error(`esperado 400 ou 403, recebido ${res.status}`);
});
```

- [ ] **Step 8.2: Rodar smoke tests**

Run:
```bash
cd backend && (node src/index.js &) && sleep 2 && cd .. && node qa/api-smoke-test.js && pkill -f "node src/index.js"
```
Expected: todos os SIM-* aparecem como PASS.

- [ ] **Step 8.3: Commit**

```bash
git add qa/api-smoke-test.js
git commit -m "test(qa): add smoke tests for simulacao endpoints"
```

---

## Task 9: Hook useSimulationAvailability

**Files:**
- Create: `frontend/src/hooks/useSimulationAvailability.js`

- [ ] **Step 9.1: Criar hook**

Arquivo `frontend/src/hooks/useSimulationAvailability.js`:
```javascript
import { useEffect, useState } from 'react';
import { useTournament } from './useTournament';

/**
 * Consulta GET /simulacao/availability para o torneio atual.
 */
export function useSimulationAvailability(group = 'F') {
  const { tApi, slug } = useTournament();
  const [state, setState] = useState({ loading: true, available: false, reason: null, etapa: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, available: false, reason: null, etapa: null });
    tApi.get(`/simulacao/availability?group=${group}`)
      .then((res) => {
        if (cancelled) return;
        setState({
          loading: false,
          available: !!res.data.available,
          reason: res.data.reason || null,
          etapa: res.data.etapa || null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, available: false, reason: 'erro', etapa: null });
      });
    return () => { cancelled = true; };
  }, [slug, group]);

  return state;
}
```

- [ ] **Step 9.2: Commit**

```bash
git add frontend/src/hooks/useSimulationAvailability.js
git commit -m "feat(frontend): add useSimulationAvailability hook"
```

---

## Task 10: Componente SimulacaoButton

**Files:**
- Create: `frontend/src/components/SimulacaoButton.jsx`

- [ ] **Step 10.1: Criar componente**

Arquivo `frontend/src/components/SimulacaoButton.jsx`:
```jsx
import { Link } from 'react-router-dom';
import { useSimulationAvailability } from '../hooks/useSimulationAvailability';
import { useTournament } from '../hooks/useTournament';

export default function SimulacaoButton({ group = 'F' }) {
  const { slug } = useTournament();
  const { loading, available } = useSimulationAvailability(group);

  if (loading || !available) return null;

  return (
    <Link
      to={`/t/${slug}/simular`}
      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 transition-colors"
    >
      🎯 Simular Etapa
    </Link>
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
git add frontend/src/components/SimulacaoButton.jsx
git commit -m "feat(frontend): add SimulacaoButton component"
```

---

## Task 11: Injetar botão na Classificação F

**Files:**
- Modify: `frontend/src/pages/Classificacao.jsx`

- [ ] **Step 11.1: Importar e renderizar**

No topo de `frontend/src/pages/Classificacao.jsx`, adicionar import:
```jsx
import SimulacaoButton from '../components/SimulacaoButton';
```

Localizar o bloco de cabeçalho (`<div className="mb-8 flex items-end justify-between flex-wrap gap-4">` ... `</div>` que envolve título + tabs). Imediatamente após esse bloco fechado (`</div>` do header), adicionar:
```jsx
      {groupKey === 'F' && (
        <div className="mb-6 flex justify-end">
          <SimulacaoButton group="F" />
        </div>
      )}
```

- [ ] **Step 11.2: Commit**

```bash
git add frontend/src/pages/Classificacao.jsx
git commit -m "feat(frontend): inject SimulacaoButton on female standings page"
```

---

## Task 12: storage helper (sessionStorage + hash)

**Files:**
- Create: `frontend/src/components/simulacao/storage.js`

- [ ] **Step 12.1: Criar helpers**

Arquivo `frontend/src/components/simulacao/storage.js`:
```javascript
const PREFIX = 'simulacao-';

export function storageKey(etapaId) {
  return PREFIX + etapaId;
}

export function loadState(etapaId) {
  if (!etapaId || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(etapaId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveState(etapaId, state) {
  if (!etapaId || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey(etapaId), JSON.stringify(state));
  } catch { /* quota — ignore */ }
}

export function clearState(etapaId) {
  if (!etapaId || typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(storageKey(etapaId)); } catch {}
}

/**
 * Hash estável (sha-256 não nativo — usa string canônica). Suficiente para
 * detectar mudanças no input do form.
 */
export function hashInput({ viewerId, absentees, duplas }) {
  const norm = {
    viewerId: viewerId || null,
    absentees: [...(absentees || [])].sort((a, b) => (a.participantId || '').localeCompare(b.participantId || ''))
      .map((a) => `${a.participantId}:${a.reason}`),
    duplas: [...(duplas || [])].sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((d) => `${d.position}:${[d.playerAId, d.playerBId].sort().join(',')}`),
  };
  return JSON.stringify(norm);
}
```

- [ ] **Step 12.2: Commit**

```bash
git add frontend/src/components/simulacao/storage.js
git commit -m "feat(frontend): add sessionStorage helpers for simulation"
```

---

## Task 13: Componente ViewerSelector

**Files:**
- Create: `frontend/src/components/simulacao/ViewerSelector.jsx`

- [ ] **Step 13.1: Criar componente**

Arquivo `frontend/src/components/simulacao/ViewerSelector.jsx`:
```jsx
export default function ViewerSelector({ participants, value, onChange }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <label className="block text-sm font-semibold text-neutral-900 mb-2">
        Quem é você?
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
      >
        <option value="">Selecione…</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <p className="text-xs text-neutral-500 mt-2">
        A simulação destaca o seu novo ranking e gera um insight personalizado para você.
      </p>
    </section>
  );
}
```

- [ ] **Step 13.2: Commit**

```bash
git add frontend/src/components/simulacao/ViewerSelector.jsx
git commit -m "feat(frontend): add ViewerSelector component"
```

---

## Task 14: Componente AusenciasSection

**Files:**
- Create: `frontend/src/components/simulacao/AusenciasSection.jsx`

- [ ] **Step 14.1: Criar componente**

Arquivo `frontend/src/components/simulacao/AusenciasSection.jsx`:
```jsx
const REASONS = [
  { value: 'FALTA', label: 'Faltou' },
  { value: 'SORTEIO', label: 'Sorteada' },
  { value: 'SORTEIO_VOLUNTARIA', label: 'Sorteio voluntário' },
];

export default function AusenciasSection({ participants, absentees, onChange }) {
  const byId = Object.fromEntries((absentees || []).map((a) => [a.participantId, a.reason]));

  function toggle(participantId, reason) {
    const current = byId[participantId];
    if (current === reason) {
      onChange((absentees || []).filter((a) => a.participantId !== participantId));
    } else {
      const others = (absentees || []).filter((a) => a.participantId !== participantId);
      onChange([...others, { participantId, reason }]);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900 mb-3">Ausências</h2>
      <p className="text-xs text-neutral-500 mb-4">
        Marque quem não vai jogar a etapa. Quem você não marcar nem incluir em uma dupla é considerada falta automática.
      </p>
      <div className="space-y-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-neutral-700">{p.name}</span>
            <div className="flex gap-1">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggle(p.id, r.value)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    byId[p.id] === r.value
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-neutral-50 text-neutral-500 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 14.2: Commit**

```bash
git add frontend/src/components/simulacao/AusenciasSection.jsx
git commit -m "feat(frontend): add AusenciasSection component"
```

---

## Task 15: Componente DuplasSection

**Files:**
- Create: `frontend/src/components/simulacao/DuplasSection.jsx`

- [ ] **Step 15.1: Criar componente**

Arquivo `frontend/src/components/simulacao/DuplasSection.jsx`:
```jsx
const POSITION_LABELS = {
  1: 'CAMPEÃ',
  2: 'VICE-CAMPEÃ',
  3: '3º lugar',
  4: '4º lugar',
  5: '5º lugar',
  6: '6º lugar',
};

export default function DuplasSection({ participants, absentees, duplas, onChange }) {
  const absentIds = new Set((absentees || []).map((a) => a.participantId));
  const usedInDuplas = new Set();
  (duplas || []).forEach((d) => {
    if (d.playerAId) usedInDuplas.add(d.playerAId);
    if (d.playerBId) usedInDuplas.add(d.playerBId);
  });
  const usedPositions = new Set((duplas || []).filter((d) => d.position).map((d) => d.position));

  const available = (excludeId) => participants.filter((p) =>
    !absentIds.has(p.id) && (!usedInDuplas.has(p.id) || p.id === excludeId)
  );

  function updateDupla(idx, patch) {
    const next = (duplas || []).map((d, i) => i === idx ? { ...d, ...patch } : d);
    onChange(next);
  }

  function removeDupla(idx) {
    onChange((duplas || []).filter((_, i) => i !== idx));
  }

  function addDupla() {
    onChange([...(duplas || []), { playerAId: null, playerBId: null, position: null }]);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900 mb-3">Duplas e posições</h2>
      <p className="text-xs text-neutral-500 mb-4">
        Monte cada dupla e escolha a posição que ela terminaria na etapa.
      </p>
      <div className="space-y-3">
        {(duplas || []).map((d, idx) => (
          <div key={idx} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              <select
                value={d.playerAId || ''}
                onChange={(e) => updateDupla(idx, { playerAId: e.target.value || null })}
                className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
              >
                <option value="">Jogadora 1…</option>
                {available(d.playerAId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={d.playerBId || ''}
                onChange={(e) => updateDupla(idx, { playerBId: e.target.value || null })}
                className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
              >
                <option value="">Jogadora 2…</option>
                {available(d.playerBId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex gap-2 items-center">
                <select
                  value={d.position || ''}
                  onChange={(e) => updateDupla(idx, { position: e.target.value ? Number(e.target.value) : null })}
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm"
                >
                  <option value="">Posição…</option>
                  {[1,2,3,4,5,6].map((pos) => (
                    <option key={pos} value={pos} disabled={usedPositions.has(pos) && d.position !== pos}>
                      {POSITION_LABELS[pos]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeDupla(idx)}
                  className="text-neutral-400 hover:text-rose-600 text-xs px-2 py-1"
                  aria-label="Remover dupla"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addDupla}
        className="mt-3 inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
      >
        + Adicionar dupla
      </button>
    </section>
  );
}
```

- [ ] **Step 15.2: Commit**

```bash
git add frontend/src/components/simulacao/DuplasSection.jsx
git commit -m "feat(frontend): add DuplasSection component"
```

---

## Task 16: Componente SimulationResultView

**Files:**
- Create: `frontend/src/components/simulacao/SimulationResultView.jsx`

- [ ] **Step 16.1: Criar componente**

Arquivo `frontend/src/components/simulacao/SimulationResultView.jsx`:
```jsx
function DeltaBadge({ delta }) {
  if (delta == null || delta === 0) {
    return <span className="inline-flex items-center gap-1 text-neutral-500 text-sm font-medium">— manteve</span>;
  }
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{delta}
    </span>
  );
}

export default function SimulationResultView({ standings, viewer, insight }) {
  return (
    <div className="space-y-4">
      {viewer && (
        <section className="rounded-xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-rose-600 font-semibold">Você</p>
              <h2 className="text-xl font-bold text-neutral-900">{viewer.name}</h2>
              <p className="text-sm text-neutral-600 mt-1">
                {viewer.oldPosition}º → <strong>{viewer.newPosition}º</strong>
                <span className="ml-2 text-neutral-500">({viewer.oldPoints} → {viewer.newPoints} pts)</span>
              </p>
            </div>
            <DeltaBadge delta={viewer.delta} />
          </div>
          {insight && (
            <p className="mt-4 text-sm text-neutral-700 leading-relaxed bg-white rounded-md p-3 border border-neutral-200">
              {insight}
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <h3 className="text-sm font-semibold text-neutral-900 px-5 py-3 border-b border-neutral-200">
          Ranking simulado
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Pos</th>
              <th className="px-3 py-2 text-left">Atleta</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const isViewer = viewer && s.participantId === viewer.participantId;
              return (
                <tr key={s.participantId} className={`border-t border-neutral-100 ${isViewer ? 'bg-rose-50 font-semibold' : ''}`}>
                  <td className="px-3 py-2">{s.position}º</td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-right">{s.pointsValid}</td>
                  <td className="px-3 py-2 text-right"><DeltaBadge delta={s.positionDelta} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 16.2: Commit**

```bash
git add frontend/src/components/simulacao/SimulationResultView.jsx
git commit -m "feat(frontend): add SimulationResultView component"
```

---

## Task 17: Página SimularEtapa (substituir conteúdo antigo)

**Files:**
- Modify: `frontend/src/pages/SimularEtapa.jsx` (substituição completa)

- [ ] **Step 17.1: Substituir conteúdo inteiro do arquivo**

Substituir TUDO em `frontend/src/pages/SimularEtapa.jsx` por:
```jsx
import { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../hooks/useTournament';
import { useSimulationAvailability } from '../hooks/useSimulationAvailability';
import ViewerSelector from '../components/simulacao/ViewerSelector';
import AusenciasSection from '../components/simulacao/AusenciasSection';
import DuplasSection from '../components/simulacao/DuplasSection';
import SimulationResultView from '../components/simulacao/SimulationResultView';
import { loadState, saveState, clearState, hashInput } from '../components/simulacao/storage';

const GROUP = 'F';

export default function SimularEtapa() {
  const { tApi, tournament } = useTournament();
  const { loading: availLoading, available, reason, etapa } = useSimulationAvailability(GROUP);

  const [participants, setParticipants] = useState([]);
  const [viewerId, setViewerId] = useState(null);
  const [absentees, setAbsentees] = useState([]);
  const [duplas, setDuplas] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Carrega atletas F ativas
  useEffect(() => {
    tApi.get('/participants').then((res) => {
      setParticipants((res.data || []).filter((p) => p.group === GROUP && p.active).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  // Restaura do sessionStorage quando a etapa estiver pronta
  useEffect(() => {
    if (!etapa?.id) return;
    const saved = loadState(etapa.id);
    if (saved?.form) {
      setViewerId(saved.form.viewerId || null);
      setAbsentees(saved.form.absentees || []);
      setDuplas(saved.form.duplas || []);
    }
    if (saved?.result) setResult(saved.result);
  }, [etapa?.id]);

  const inputHash = useMemo(() => hashInput({ viewerId, absentees, duplas }), [viewerId, absentees, duplas]);

  // Salva no storage quando o form muda
  useEffect(() => {
    if (!etapa?.id) return;
    saveState(etapa.id, { form: { viewerId, absentees, duplas }, result, inputHash });
  }, [etapa?.id, viewerId, absentees, duplas, result, inputHash]);

  // Validação básica
  const canSubmit = viewerId && duplas.length >= 2 && duplas.every((d) => d.playerAId && d.playerBId && d.position);

  async function handleSimulate() {
    setError(null);
    setSubmitting(true);
    try {
      // Se o input não mudou e já temos resultado, evita chamada
      if (result?._hash === inputHash) {
        setSubmitting(false);
        return;
      }
      const res = await tApi.post('/simulacao/simular', {
        viewerParticipantId: viewerId,
        group: GROUP,
        absentees,
        duplas,
      });
      setResult({ ...res.data, _hash: inputHash });
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao simular');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    if (etapa?.id) clearState(etapa.id);
    setViewerId(null);
    setAbsentees([]);
    setDuplas([]);
    setResult(null);
    setError(null);
  }

  if (availLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-neutral-500 text-sm">Carregando…</div>;
  }

  if (!available) {
    const messages = {
      desativado: 'A simulação está desativada pelo admin.',
      sem_etapa_hoje: 'A simulação só fica disponível no dia de uma etapa do Feminino.',
      fora_da_janela: 'A simulação só funciona entre 7h e 19h no dia da etapa.',
      etapa_concluida: 'A etapa de hoje já foi finalizada.',
    };
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Simular Etapa</h1>
        <p className="mt-4 text-neutral-600">{messages[reason] || 'Simulação indisponível.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">🎯 Simular Etapa</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Etapa de {etapa?.date && new Date(etapa.date + 'T12:00').toLocaleDateString('pt-BR')} — Feminino
        </p>
      </header>

      {result ? (
        <>
          <SimulationResultView standings={result.standings} viewer={result.viewer} insight={result.insight} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Nova simulação
            </button>
            <button
              type="button"
              onClick={handleSimulate}
              disabled={submitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? 'Recalculando…' : 'Recalcular insight'}
            </button>
          </div>
        </>
      ) : (
        <>
          <ViewerSelector participants={participants} value={viewerId} onChange={setViewerId} />
          <AusenciasSection participants={participants} absentees={absentees} onChange={setAbsentees} />
          <DuplasSection participants={participants} absentees={absentees} duplas={duplas} onChange={setDuplas} />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleSimulate}
            disabled={!canSubmit || submitting}
            className="w-full rounded-lg bg-rose-600 px-4 py-3 text-base font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Simulando…' : 'Simular'}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 17.2: Commit**

```bash
git add frontend/src/pages/SimularEtapa.jsx
git commit -m "feat(frontend): rewrite SimularEtapa page (F-only, pair-based, LLM insight)"
```

---

## Task 18: Remover botão antigo no Home

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 18.1: Localizar e remover o botão**

Em `frontend/src/pages/Home.jsx`, localizar o bloco que renderiza condicionalmente o link "Simular Etapa" (aproximadamente linhas 103-108, dentro do bloco `tournament?.simulateEnabled &&`). Remover esse bloco inteiro. Se o `tournament?.simulateEnabled` não for usado em mais nada nesse arquivo, remover também a referência.

Verificar antes:
```bash
grep -n "simulateEnabled\|Simular" frontend/src/pages/Home.jsx
```

Após edição, conferir que o arquivo continua compilando (rodar `npm run dev` ou `npm run build` no frontend).

- [ ] **Step 18.2: Verificar build**

Run:
```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: build OK, sem erros.

- [ ] **Step 18.3: Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "chore(frontend): remove old Simular Etapa button from Home"
```

---

## Task 19: Verificação visual end-to-end (preview)

**Files:** nenhum

- [ ] **Step 19.1: Iniciar backend e frontend**

Run em terminais separados:
```bash
cd /Users/Helder/Developer/sm-torneio/backend && node src/index.js
cd /Users/Helder/Developer/sm-torneio/frontend && npm run dev
```

- [ ] **Step 19.2: Ajustar DB local para que hoje seja dia de etapa F**

```bash
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const today = new Date().toISOString().slice(0,10);
  const r = await p.round.updateMany({
    where: { group: 'F', status: 'SCHEDULED' },
    data: { date: today }
  });
  console.log('updated', r.count);
  await p.tournament.updateMany({ where: { slug: 'demo' }, data: { simulateEnabled: true } });
  console.log('tournament toggled');
  await p.\$disconnect();
})();
"
```

- [ ] **Step 19.3: Navegar e validar**

Abra `http://localhost:5173/t/demo/classificacao/feminino` no navegador:
- Botão "🎯 Simular Etapa" deve aparecer no topo
- Botão NÃO deve aparecer em `/t/demo/classificacao/masculino`

Clicar no botão → cair em `/t/demo/simular`:
- Ver "Quem é você?" select
- Ver seção Ausências
- Ver seção Duplas (vazia, com botão "+ Adicionar dupla")
- Botão "Simular" desabilitado se faltam campos

Preencher (escolher viewer, marcar 1 falta, adicionar 2 duplas com posições) → Simular:
- Card grande com viewer destacada e delta
- Insight texto (se ANTHROPIC_API_KEY configurada) ou ausente (se não)
- Tabela completa com ↑/↓

Botão "Nova simulação" → reset.
Reload da página → estado deve ser restaurado.

- [ ] **Step 19.4: Reverter DB local**

```bash
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // restaurar datas originais ou marcar manualmente como SCHEDULED — apenas reset local
  console.log('reset manual no DB se necessário');
  await p.\$disconnect();
})();
"
```

(Sem commit nesta task — só verificação.)

---

## Task 20: Configurar ANTHROPIC_API_KEY no Railway

**Files:** nenhum (configuração externa)

- [ ] **Step 20.1: Pegar a API key**

Acessar [console.anthropic.com](https://console.anthropic.com/) → API Keys → Create Key. Nome sugerido: "SM Torneio production".

- [ ] **Step 20.2: Configurar no Railway**

Railway → projeto sm-torneio → serviço → Variables → New Variable:
- Nome: `ANTHROPIC_API_KEY`
- Valor: a key gerada

- [ ] **Step 20.3: Redeploy**

Aguardar redeploy automático ou trigger manual.

- [ ] **Step 20.4: Verificar em produção**

(Apenas dia de etapa F entre 7h-19h:)
```bash
curl -s "https://www.sm-ttc.com.br/api/tournaments/2026/simulacao/availability?group=F"
```
Expected: `{ available: true, etapa: {...} }` no dia de etapa F após admin ligar o flag.

---

## Self-Review (preencher após escrever todas as tasks)

**Spec coverage:**
- [x] Substituir SimularEtapa antiga → Task 17
- [x] LLM real Anthropic Haiku 4.5 → Task 6
- [x] Tela única scrollável (viewer + ausências + duplas) → Tasks 13-17
- [x] Personalização viewer destacada → Task 16
- [x] Acesso só na Classificação F → Tasks 10-11
- [x] Janela 7-19h dia da etapa → Tasks 2, 4
- [x] sessionStorage com hash → Tasks 12, 17
- [x] LLM não fala de sets/games → Task 6 (system prompt)
- [x] Manter POST /standings/simulate antigo → confirmado, nenhum delete
- [x] Remover botão Home → Task 18
- [x] Smoke tests → Task 8
- [x] Variável ANTHROPIC_API_KEY → Task 20

**Placeholder scan:** sem TBDs ou TODOs.

**Type consistency:** o payload do POST /simular em Task 5 (`viewerParticipantId, group, absentees, duplas`) bate com o usado no frontend Task 17. Os componentes Task 13-15 emitem o mesmo shape.

**Fora de escopo (não fazer agora):** simulação para M, persistência server-side, histórico, compartilhamento por link, notificação push.
