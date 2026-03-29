/**
 * Settings helper — loads tournament settings from DB.
 * Falls back to hardcoded defaults if a key is missing, so the app
 * never crashes even if the seed hasn't run yet on a fresh deployment.
 *
 * Usage:
 *   const s = await loadSettings();
 *   s.int('points_1st_place')               // → 100
 *   s.float('round_fee')                    // → 30.0
 *   s.bool('discard_zero_points_allowed')   // → false
 *   s.str('scoring_mode')                   // → 'NO_AD'
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Hardcoded fallbacks — mirror the values in prisma/seedSettings.js
const DEFAULTS = {
  points_1st_place:            '100',
  points_2nd_place:            '80',
  points_3rd_place:            '70',
  points_4th_place:            '60',
  points_5th_place:            '50',
  points_6th_place:            '40',
  points_7th_place:            '30',
  bonus_full_attendance:       '20',
  points_sit_out_drawn:        '80',
  points_sit_out_volunteer:    '60',
  penalty_wrong_uniform:       '20',
  discard_starts_after_round:  '5',
  discard_zero_points_allowed: 'false',
  games_to_win_set:            '5',
  tiebreak_at_score:           '4',
  scoring_mode:                'NO_AD',
  bracket_format:              'DOUBLE_ELIMINATION',
  warmup_ball_toss_count:      '2',
  warmup_rally_max_minutes:    '5',
  interval_between_matches_minutes: '5',
  matches_end_time:            '13:30',
  max_participants_masculino:  '30',
  max_participants_feminino:   '14',
  min_age_masculino:           '40',
  min_age_feminino:            '24',
  trophy_positions_masculino:  '6',
  trophy_positions_feminino:   '4',
  senior_trophy_min_age:       '65',
  senior_trophy_extra_spots:   '2',
  max_absences_before_penalty: '3',
  max_courts_masculino:        '2',
  max_courts_feminino:         '1',
  min_pairs_per_court:         '3',
  max_pairs_per_court:         '8',
  min_participants_to_play:    '6',
  presence_cutoff_time:        '07:30',
  round_fee:                   '30.00',
  annual_fee_total:            '765.00',
  annual_fee_installment:      '85.00',
  annual_fee_max_installments: '9',
  annual_fee_shirt_events:     '495.00',
  annual_fee_operations:       '270.00',
};

async function loadSettings() {
  let rows = [];
  try {
    rows = await prisma.tournamentSetting.findMany();
  } catch (err) {
    // Table might not exist yet on a fresh deployment — use all defaults
    console.warn('[settings] Could not query tournament_settings, using defaults:', err.message);
  }

  const map = new Map(Object.entries(DEFAULTS)); // start with defaults
  for (const row of rows) {
    map.set(row.key, row.value); // DB values override defaults
  }

  const get = (key) => {
    if (!map.has(key)) throw new Error(`Setting not found: ${key}`);
    return map.get(key);
  };

  return {
    raw: map,
    str:   (key) => get(key),
    int:   (key) => {
      const v = parseInt(get(key), 10);
      if (isNaN(v)) throw new Error(`Setting "${key}" is not a valid integer`);
      return v;
    },
    float: (key) => {
      const v = parseFloat(get(key));
      if (isNaN(v)) throw new Error(`Setting "${key}" is not a valid float`);
      return v;
    },
    bool:  (key) => {
      const v = get(key);
      return v === 'true' || v === '1';
    },
  };
}

module.exports = { loadSettings };
