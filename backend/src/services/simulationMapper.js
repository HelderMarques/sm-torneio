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
