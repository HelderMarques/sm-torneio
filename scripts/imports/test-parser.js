#!/usr/bin/env node
/**
 * Teste de regressão do parser do PDF de etapa.
 *
 * Verifica que o parser produz o mesmo resultado canônico para os PDFs reais
 * de Abril/2026 e Maio/2026 — protegendo contra regressões em mudanças futuras.
 *
 * Uso:  node scripts/imports/test-parser.js
 */

const path = require('path');
const fs = require('fs');
const { extractItems, parsePdf, canonicalCourtLabel } = require('./import-etapa-from-pdf.js');

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${msg}`);
  }
}

function group(label) {
  console.log(`\n— ${label}`);
}

async function parseToCanonical(pdfPath) {
  const items = await extractItems(pdfPath);
  const parsed = parsePdf(items);
  // Group by prefix → canonical label for downstream assertions
  const byPrefix = {};
  for (const pr of parsed.pairRows) {
    const prefix = pr.label[0];
    if (!byPrefix[prefix]) byPrefix[prefix] = { rawLabels: new Set(), labels: [] };
    byPrefix[prefix].rawLabels.add(pr.rawCourtLabel);
    byPrefix[prefix].labels.push(pr.label);
  }
  const courts = {};
  for (const [prefix, info] of Object.entries(byPrefix)) {
    const raw = [...info.rawLabels][0];
    courts[prefix] = {
      raw,
      canonical: canonicalCourtLabel(raw),
      duplas: info.labels.sort(),
    };
  }
  return { date: parsed.date, courts };
}

(async () => {
  group('canonicalCourtLabel — unitário');
  assert(canonicalCourtLabel('Q4') === 'Quadra 4', 'Q4 → Quadra 4');
  assert(canonicalCourtLabel('Q5') === 'Quadra 5', 'Q5 → Quadra 5');
  assert(canonicalCourtLabel('Est.') === 'Estádio', 'Est. → Estádio');
  assert(canonicalCourtLabel('EST.') === 'Estádio', 'EST. → Estádio');
  assert(canonicalCourtLabel('Estádio') === 'Estádio', 'Estádio → Estádio');
  assert(canonicalCourtLabel('4') === 'Quadra 4', '4 → Quadra 4');
  assert(canonicalCourtLabel('5') === 'Quadra 5', '5 → Quadra 5');
  assert(canonicalCourtLabel('Quadra 6') === 'Quadra 6', 'Quadra 6 → Quadra 6');
  assert(canonicalCourtLabel(null) === null, 'null → null');
  assert(canonicalCourtLabel('') === null, 'empty → null');

  const ABRIL = path.join(__dirname, '..', '..', 'RESULTADOS', 'Abril26', 'Resultados jogos Abril_2026.pdf');
  const MAIO = process.env.MAIO_PDF || '/Users/Helder/Downloads/Resultados jogos Maio_2026.pdf';

  if (fs.existsSync(ABRIL)) {
    group(`Abril/2026 (${ABRIL})`);
    const a = await parseToCanonical(ABRIL);
    assert(a.date === '2026-04-12', `data = 2026-04-12 (got ${a.date})`);
    assert(a.courts['6']?.canonical === 'Quadra 4', `prefix 6 → Quadra 4 (got raw="${a.courts['6']?.raw}", canon="${a.courts['6']?.canonical}")`);
    assert(a.courts['7']?.canonical === 'Quadra 5', `prefix 7 → Quadra 5 (got raw="${a.courts['7']?.raw}", canon="${a.courts['7']?.canonical}")`);
    assert(a.courts['8']?.canonical === 'Estádio', `prefix 8 → Estádio (got raw="${a.courts['8']?.raw}", canon="${a.courts['8']?.canonical}")`);
    assert(a.courts['6']?.duplas.length === 5, `Abril prefix 6 tem 5 duplas (got ${a.courts['6']?.duplas.length})`);
    assert(a.courts['7']?.duplas.length === 6, `Abril prefix 7 tem 6 duplas (got ${a.courts['7']?.duplas.length})`);
    assert(a.courts['8']?.duplas.length === 6, `Abril prefix 8 tem 6 duplas (got ${a.courts['8']?.duplas.length})`);
  } else {
    console.log(`(pulando Abril — arquivo não existe em ${ABRIL})`);
  }

  if (fs.existsSync(MAIO)) {
    group(`Maio/2026 (${MAIO})`);
    const m = await parseToCanonical(MAIO);
    assert(m.date === '2026-05-17', `data = 2026-05-17 (got ${m.date})`);
    assert(m.courts['6']?.canonical === 'Estádio', `prefix 6 → Estádio (got raw="${m.courts['6']?.raw}", canon="${m.courts['6']?.canonical}")`);
    assert(m.courts['7']?.canonical === 'Quadra 4', `prefix 7 → Quadra 4 (got raw="${m.courts['7']?.raw}", canon="${m.courts['7']?.canonical}")`);
    assert(m.courts['8']?.canonical === 'Quadra 5', `prefix 8 → Quadra 5 (got raw="${m.courts['8']?.raw}", canon="${m.courts['8']?.canonical}")`);
    assert(m.courts['6']?.duplas.length === 6, `Maio prefix 6 tem 6 duplas (got ${m.courts['6']?.duplas.length})`);
    assert(m.courts['7']?.duplas.length === 7, `Maio prefix 7 tem 7 duplas — inclui 7G (got ${m.courts['7']?.duplas.length}: ${m.courts['7']?.duplas.join(',')})`);
    assert(m.courts['8']?.duplas.length === 6, `Maio prefix 8 tem 6 duplas (got ${m.courts['8']?.duplas.length})`);
    assert(m.courts['7']?.duplas.includes('7G'), `Maio prefix 7 contém a dupla 7G`);
  } else {
    console.log(`(pulando Maio — arquivo não existe em ${MAIO})`);
  }

  if (process.exitCode) {
    console.error('\n❌ Testes falharam.');
  } else {
    console.log('\n✅ Todos os testes passaram.');
  }
})().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
