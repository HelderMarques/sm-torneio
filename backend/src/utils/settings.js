/**
 * Settings helper — loads tournament settings from DB.
 *
 * Usage:
 *   const s = await loadSettings();
 *   s.int('points_1st_place')     // → 100
 *   s.float('round_fee')          // → 30.0
 *   s.bool('discard_zero_points_allowed') // → false
 *   s.str('scoring_mode')         // → 'NO_AD'
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function loadSettings() {
  const rows = await prisma.tournamentSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

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
