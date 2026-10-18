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
