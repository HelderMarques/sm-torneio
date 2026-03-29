/**
 * Idempotent seed for tournament_settings table.
 * Run standalone: node prisma/seedSettings.js
 * Or called from seed.js during full reseed.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SETTINGS = [
  // ── Pontuação por Colocação ─────────────────────────────────────────────
  { key: 'points_1st_place',         value: '100', type: 'int',     category: 'pontuacao',        label: 'Pontos — 1º lugar',                       group: 'SHARED' },
  { key: 'points_2nd_place',         value: '80',  type: 'int',     category: 'pontuacao',        label: 'Pontos — 2º lugar',                       group: 'SHARED' },
  { key: 'points_3rd_place',         value: '70',  type: 'int',     category: 'pontuacao',        label: 'Pontos — 3º lugar',                       group: 'SHARED' },
  { key: 'points_4th_place',         value: '60',  type: 'int',     category: 'pontuacao',        label: 'Pontos — 4º lugar',                       group: 'SHARED' },
  { key: 'points_5th_place',         value: '50',  type: 'int',     category: 'pontuacao',        label: 'Pontos — 5º lugar',                       group: 'SHARED' },
  { key: 'points_6th_place',         value: '40',  type: 'int',     category: 'pontuacao',        label: 'Pontos — 6º lugar',                       group: 'SHARED' },
  { key: 'points_7th_place',         value: '30',  type: 'int',     category: 'pontuacao',        label: 'Pontos — 7º lugar',                       group: 'SHARED' },

  // ── Bonificações e Penalidades ──────────────────────────────────────────
  { key: 'bonus_full_attendance',    value: '20',  type: 'int',     category: 'bonificacao',      label: 'Bônus — presença em todas as rodadas',    group: 'SHARED' },
  { key: 'points_sit_out_drawn',     value: '80',  type: 'int',     category: 'bonificacao',      label: 'Pontos — dispensa por sorteio',           group: 'SHARED' },
  { key: 'points_sit_out_volunteer', value: '60',  type: 'int',     category: 'bonificacao',      label: 'Pontos — dispensa voluntária',            group: 'SHARED' },
  { key: 'penalty_wrong_uniform',    value: '20',  type: 'int',     category: 'bonificacao',      label: 'Penalidade — uniforme incorreto (pts)',   group: 'SHARED' },

  // ── Regra de Descarte ───────────────────────────────────────────────────
  { key: 'discard_starts_after_round', value: '5', type: 'int',    category: 'descarte',         label: 'Descarte ativo a partir da rodada nº',    group: 'SHARED' },
  { key: 'discard_zero_points_allowed', value: 'false', type: 'boolean', category: 'descarte',   label: 'Permite descarte de zero pontos',         group: 'SHARED' },

  // ── Formato das Partidas ────────────────────────────────────────────────
  { key: 'games_to_win_set',         value: '5',   type: 'int',     category: 'formato_partida',  label: 'Games para vencer o set',                 group: 'SHARED' },
  { key: 'tiebreak_at_score',        value: '4',   type: 'int',     category: 'formato_partida',  label: 'Game decisivo quando empate em X a X',    group: 'SHARED' },
  { key: 'scoring_mode',             value: 'NO_AD', type: 'string', category: 'formato_partida', label: 'Modo de pontuação (NO_AD / ADVANTAGE)',    group: 'SHARED' },
  { key: 'bracket_format',           value: 'DOUBLE_ELIMINATION', type: 'string', category: 'formato_partida', label: 'Formato da chave', group: 'SHARED' },
  { key: 'warmup_ball_toss_count',   value: '2',   type: 'int',     category: 'formato_partida',  label: 'Saques de aquecimento por jogador',       group: 'SHARED' },
  { key: 'warmup_rally_max_minutes', value: '5',   type: 'int',     category: 'formato_partida',  label: 'Tempo máximo de bate-bola (min)',          group: 'SHARED' },
  { key: 'interval_between_matches_minutes', value: '5', type: 'int', category: 'formato_partida', label: 'Tolerância entre jogos (min)',           group: 'SHARED' },
  { key: 'matches_end_time',         value: '13:30', type: 'string', category: 'formato_partida', label: 'Horário limite para encerramento',        group: 'SHARED' },

  // ── Inscrições e Limites ────────────────────────────────────────────────
  { key: 'max_participants_masculino', value: '30', type: 'int',    category: 'inscricoes',       label: 'Máximo de inscritos (Masculino)',          group: 'MASCULINO' },
  { key: 'max_participants_feminino',  value: '14', type: 'int',    category: 'inscricoes',       label: 'Máximo de inscritas (Feminino)',           group: 'FEMININO' },
  { key: 'min_age_masculino',          value: '40', type: 'int',    category: 'inscricoes',       label: 'Idade mínima (Masculino)',                 group: 'MASCULINO' },
  { key: 'min_age_feminino',           value: '24', type: 'int',    category: 'inscricoes',       label: 'Idade mínima (Feminino)',                  group: 'FEMININO' },
  { key: 'trophy_positions_masculino', value: '6', type: 'int',    category: 'inscricoes',       label: 'Posições premiadas — Masculino',           group: 'MASCULINO' },
  { key: 'trophy_positions_feminino',  value: '4', type: 'int',    category: 'inscricoes',       label: 'Posições premiadas — Feminino',            group: 'FEMININO' },
  { key: 'senior_trophy_min_age',      value: '65', type: 'int',    category: 'inscricoes',       label: 'Idade mínima troféu sênior',               group: 'SHARED' },
  { key: 'senior_trophy_extra_spots',  value: '2',  type: 'int',    category: 'inscricoes',       label: 'Vagas extras troféu sênior',               group: 'SHARED' },
  { key: 'max_absences_before_penalty', value: '3', type: 'int',   category: 'inscricoes',       label: 'Faltas antes de penalidade de re-inscrição', group: 'SHARED' },

  // ── Configuração de Quadras ─────────────────────────────────────────────
  { key: 'max_courts_masculino',       value: '2',  type: 'int',    category: 'quadras',          label: 'Máximo de quadras — Masculino',           group: 'MASCULINO' },
  { key: 'max_courts_feminino',        value: '1',  type: 'int',    category: 'quadras',          label: 'Máximo de quadras — Feminino',            group: 'FEMININO' },
  { key: 'min_pairs_per_court',        value: '3',  type: 'int',    category: 'quadras',          label: 'Mínimo de duplas por quadra',             group: 'SHARED' },
  { key: 'max_pairs_per_court',        value: '8',  type: 'int',    category: 'quadras',          label: 'Máximo de duplas por quadra',             group: 'SHARED' },
  { key: 'min_participants_to_play',   value: '6',  type: 'int',    category: 'quadras',          label: 'Mínimo de participantes para realizar rodada', group: 'SHARED' },
  { key: 'presence_cutoff_time',       value: '07:30', type: 'string', category: 'quadras',      label: 'Horário de encerramento da lista',         group: 'SHARED' },

  // ── Valores Financeiros ─────────────────────────────────────────────────
  { key: 'round_fee',                  value: '30.00',  type: 'float', category: 'financeiro',   label: 'Taxa por rodada (R$)',                     group: 'SHARED' },
  { key: 'annual_fee_total',           value: '765.00', type: 'float', category: 'financeiro',   label: 'Taxa anual total (R$)',                    group: 'SHARED' },
  { key: 'annual_fee_installment',     value: '85.00',  type: 'float', category: 'financeiro',   label: 'Valor da parcela (R$)',                    group: 'SHARED' },
  { key: 'annual_fee_max_installments', value: '9',     type: 'int',   category: 'financeiro',   label: 'Número máximo de parcelas',               group: 'SHARED' },
  { key: 'annual_fee_shirt_events',    value: '495.00', type: 'float', category: 'financeiro',   label: 'Parcela destinada a camisas e festa (R$)', group: 'SHARED' },
  { key: 'annual_fee_operations',      value: '270.00', type: 'float', category: 'financeiro',   label: 'Parcela destinada a operações (R$)',       group: 'SHARED' },
];

async function seedSettings() {
  let created = 0;
  let updated = 0;
  for (const s of SETTINGS) {
    const existing = await prisma.tournamentSetting.findUnique({ where: { key: s.key } });
    if (existing) {
      // Only update metadata fields (label, type, category, group), never overwrite user-changed value
      await prisma.tournamentSetting.update({
        where: { key: s.key },
        data: { type: s.type, category: s.category, label: s.label, group: s.group },
      });
      updated++;
    } else {
      await prisma.tournamentSetting.create({ data: s });
      created++;
    }
  }
  console.log(`Settings: ${created} created, ${updated} updated`);
}

if (require.main === module) {
  seedSettings()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedSettings };
