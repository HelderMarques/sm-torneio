const POSITION_LABELS = {
  1: 'CAMPEÃ',
  2: 'VICE-CAMPEÃ',
  3: '3º lugar',
  4: '4º lugar',
  5: '5º lugar',
  6: '6º lugar',
};

export default function DuplasSection({ participants, absentees, duplas, onChange }) {
  const absentIds = new Set((absentees || []).map((a) => a.participantId));
  const usedInDuplas = new Set();
  (duplas || []).forEach((d) => {
    if (d.playerAId) usedInDuplas.add(d.playerAId);
    if (d.playerBId) usedInDuplas.add(d.playerBId);
  });
  const usedPositions = new Set((duplas || []).filter((d) => d.position).map((d) => d.position));

  const available = (excludeId) => participants.filter((p) =>
    !absentIds.has(p.id) && (!usedInDuplas.has(p.id) || p.id === excludeId)
  );

  function updateDupla(idx, patch) {
    const next = (duplas || []).map((d, i) => i === idx ? { ...d, ...patch } : d);
    onChange(next);
  }

  function removeDupla(idx) {
    onChange((duplas || []).filter((_, i) => i !== idx));
  }

  function addDupla() {
    onChange([...(duplas || []), { playerAId: null, playerBId: null, position: null }]);
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900 mb-3">Duplas e posições</h2>
      <p className="text-xs text-neutral-500 mb-4">
        Monte cada dupla e escolha a posição que ela terminaria na etapa.
      </p>
      <div className="space-y-3">
        {(duplas || []).map((d, idx) => (
          <div key={idx} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              <select
                value={d.playerAId || ''}
                onChange={(e) => updateDupla(idx, { playerAId: e.target.value || null })}
                className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
              >
                <option value="">Jogadora 1…</option>
                {available(d.playerAId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={d.playerBId || ''}
                onChange={(e) => updateDupla(idx, { playerBId: e.target.value || null })}
                className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
              >
                <option value="">Jogadora 2…</option>
                {available(d.playerBId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex gap-2 items-center">
                <select
                  value={d.position || ''}
                  onChange={(e) => updateDupla(idx, { position: e.target.value ? Number(e.target.value) : null })}
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm"
                >
                  <option value="">Posição…</option>
                  {[1,2,3,4,5,6].map((pos) => (
                    <option key={pos} value={pos} disabled={usedPositions.has(pos) && d.position !== pos}>
                      {POSITION_LABELS[pos]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeDupla(idx)}
                  className="text-neutral-400 hover:text-rose-600 text-xs px-2 py-1"
                  aria-label="Remover dupla"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addDupla}
        className="mt-3 inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700"
      >
        + Adicionar dupla
      </button>
    </section>
  );
}
