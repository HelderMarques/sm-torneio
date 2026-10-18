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
