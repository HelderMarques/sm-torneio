// backend/test/chancesTitulo.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { projectFinalPoints } = require('../src/services/chancesTituloService');

const OPTS = { totalRounds: 9, discardStartsAfter: 5, bonusValue: 20 };

test('projectFinalPoints: soma menos descarte do menor positivo', () => {
  const scores = [100, 80, 70, 60, 50, 40, 30, 100];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 9, presentAllRounds: false, penalty: 0 });
  assert.strictEqual(r, 500);
});

test('projectFinalPoints: aplica bônus com presença total', () => {
  const scores = [100, 80, 70, 60, 50, 40, 30, 100, 100];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 9, presentAllRounds: true, penalty: 0 });
  assert.strictEqual(r, 620);
});

test('projectFinalPoints: zeros não mudam descarte e não dão bônus', () => {
  const scores = [100, 80, 0];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 9, presentAllRounds: false, penalty: 0 });
  assert.strictEqual(r, 100);
});

test('projectFinalPoints: sem descarte antes da 5a etapa', () => {
  const scores = [100, 80];
  const r = projectFinalPoints(scores, { ...OPTS, completedCount: 2, presentAllRounds: false, penalty: 0 });
  assert.strictEqual(r, 180);
});

const { deriveStatuses } = require('../src/services/chancesTituloService');

test('deriveStatuses: líder destacado é campeão garantido', () => {
  const athletes = [
    { id: 'A', floor: 500, ceil: 520 },
    { id: 'B', floor: 200, ceil: 300 },
  ];
  const r = deriveStatuses(athletes, 1);
  assert.strictEqual(r.find((x) => x.id === 'A').titulo, 'garantido');
});

test('deriveStatuses: quem não alcança o top K sai fora do troféu', () => {
  const athletes = [
    { id: 'A', floor: 500, ceil: 520 },
    { id: 'B', floor: 480, ceil: 500 },
    { id: 'C', floor: 100, ceil: 120 },
  ];
  const r = deriveStatuses(athletes, 2);
  assert.strictEqual(r.find((x) => x.id === 'C').trofeu, 'fora');
});

test('deriveStatuses: quem pode alcançar fica vivo pro troféu', () => {
  const athletes = [
    { id: 'A', floor: 300, ceil: 400 },
    { id: 'B', floor: 290, ceil: 390 },
    { id: 'C', floor: 280, ceil: 395 },
  ];
  const r = deriveStatuses(athletes, 2);
  assert.strictEqual(r.find((x) => x.id === 'C').trofeu, 'vivo');
});

test('deriveStatuses: fronteira vira depende_desempate (título)', () => {
  const athletes = [
    { id: 'A', floor: 300, ceil: 400 },
    { id: 'B', floor: 400, ceil: 420 },
  ];
  const r = deriveStatuses(athletes, 1);
  assert.strictEqual(r.find((x) => x.id === 'A').titulo, 'depende_desempate');
});

const { monteCarloProbabilities } = require('../src/services/chancesTituloService');

test('monteCarloProbabilities: invariantes de coerência', () => {
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

test('buildCondicoes: líder viva não manda alcançar a si mesma', () => {
  const r = buildCondicoes(
    { participantId: 'X', name: 'Eduarda', titulo: 'vivo', trofeu: 'vivo', currentPoints: 230, maxPoints: 800 },
    { leaderName: 'Eduarda', leaderPoints: 230, leaderId: 'X' }
  );
  const txt = r.join(' ');
  assert.ok(!txt.toLowerCase().includes('alcançar'), 'líder não deve ser mandada alcançar alguém');
  assert.ok(txt.toLowerCase().includes('lidera'), 'deve reconhecer que ela lidera');
});
