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
