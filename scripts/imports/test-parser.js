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
  // Agrupa por rawCourtLabel — funciona tanto para PDFs com coluna "Dupla"
  // (Abril/Maio) quanto sem (Junho+).
  const byRawCourt = {};
  for (const pr of parsed.pairRows) {
    const key = pr.rawCourtLabel;
    if (!byRawCourt[key]) byRawCourt[key] = { labels: [] };
    byRawCourt[key].labels.push(pr.label);
  }
  const courts = {};
  for (const [raw, info] of Object.entries(byRawCourt)) {
    const canonical = canonicalCourtLabel(raw);
    courts[canonical] = {
      raw,
      canonical,
      duplas: info.labels.sort(),
    };
  }
  return { date: parsed.date, courts, sorteados: parsed.sorteados };
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
  const JUNHO = process.env.JUNHO_PDF || '/Users/Helder/Downloads/Resultados jogos jUNHO_2026.pdf';

  if (fs.existsSync(ABRIL)) {
    group(`Abril/2026 (${ABRIL})`);
    const a = await parseToCanonical(ABRIL);
    assert(a.date === '2026-04-12', `data = 2026-04-12 (got ${a.date})`);
    assert(a.courts['Quadra 4']?.duplas.length === 5, `Abril Quadra 4 tem 5 duplas (got ${a.courts['Quadra 4']?.duplas.length})`);
    assert(a.courts['Quadra 5']?.duplas.length === 6, `Abril Quadra 5 tem 6 duplas (got ${a.courts['Quadra 5']?.duplas.length})`);
    assert(a.courts['Estádio']?.duplas.length === 6, `Abril Estádio tem 6 duplas (got ${a.courts['Estádio']?.duplas.length})`);
    assert(a.courts['Quadra 4']?.raw === '4', `Abril raw label da Quadra 4 = "4" (got "${a.courts['Quadra 4']?.raw}")`);
    assert(a.courts['Estádio']?.raw === 'EST.', `Abril raw label do Estádio = "EST." (got "${a.courts['Estádio']?.raw}")`);
    // Abril usa rótulos explícitos de dupla (6A, 7B, …)
    assert(a.courts['Quadra 4']?.duplas[0] === '6A', `Abril Quadra 4 primeira dupla = 6A (got "${a.courts['Quadra 4']?.duplas[0]}")`);
  } else {
    console.log(`(pulando Abril — arquivo não existe em ${ABRIL})`);
  }

  if (fs.existsSync(MAIO)) {
    group(`Maio/2026 (${MAIO})`);
    const m = await parseToCanonical(MAIO);
    assert(m.date === '2026-05-17', `data = 2026-05-17 (got ${m.date})`);
    assert(m.courts['Estádio']?.duplas.length === 6, `Maio Estádio tem 6 duplas (got ${m.courts['Estádio']?.duplas.length})`);
    assert(m.courts['Quadra 4']?.duplas.length === 7, `Maio Quadra 4 tem 7 duplas — inclui 7G (got ${m.courts['Quadra 4']?.duplas.length}: ${m.courts['Quadra 4']?.duplas.join(',')})`);
    assert(m.courts['Quadra 5']?.duplas.length === 6, `Maio Quadra 5 tem 6 duplas (got ${m.courts['Quadra 5']?.duplas.length})`);
    assert(m.courts['Quadra 4']?.duplas.includes('7G'), `Maio Quadra 4 contém a dupla 7G`);
    assert(m.courts['Estádio']?.raw === 'Est.', `Maio raw label do Estádio = "Est." (got "${m.courts['Estádio']?.raw}")`);
    assert(m.courts['Quadra 4']?.raw === 'Q4', `Maio raw label da Quadra 4 = "Q4" (got "${m.courts['Quadra 4']?.raw}")`);
  } else {
    console.log(`(pulando Maio — arquivo não existe em ${MAIO})`);
  }

  if (fs.existsSync(JUNHO)) {
    group(`Junho/2026 (${JUNHO})`);
    const j = await parseToCanonical(JUNHO);
    assert(j.date === '2026-06-21', `data = 2026-06-21 (got ${j.date})`);
    // Junho não tem coluna "Dupla" — esperamos labels sintéticos #1, #2, …
    assert(j.courts['Quadra 5']?.duplas.length === 6, `Junho Quadra 5 tem 6 duplas (got ${j.courts['Quadra 5']?.duplas.length})`);
    assert(j.courts['Quadra 4']?.duplas.length === 6, `Junho Quadra 4 tem 6 duplas (got ${j.courts['Quadra 4']?.duplas.length})`);
    assert(j.courts['Estádio']?.duplas.length === 6, `Junho Estádio tem 6 duplas (got ${j.courts['Estádio']?.duplas.length})`);
    assert(j.courts['Quadra 5']?.raw === '5', `Junho raw label da Quadra 5 = "5" (got "${j.courts['Quadra 5']?.raw}")`);
    assert(j.courts['Estádio']?.raw === 'EST', `Junho raw label do Estádio = "EST" (got "${j.courts['Estádio']?.raw}")`);
    assert(j.courts['Quadra 5']?.duplas.includes('#1'), `Junho Quadra 5 tem dupla sintética #1 (got ${j.courts['Quadra 5']?.duplas.join(',')})`);
    assert(j.sorteados?.length === 1 && j.sorteados[0].name === 'Tuninho', `Junho tem 1 sorteio (Tuninho) (got ${JSON.stringify(j.sorteados)})`);
  } else {
    console.log(`(pulando Junho — arquivo não existe em ${JUNHO})`);
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
