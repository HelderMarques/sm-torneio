const REASONS = [
  { value: 'FALTA', label: 'Faltou' },
  { value: 'SORTEIO', label: 'Sorteada' },
  { value: 'SORTEIO_VOLUNTARIA', label: 'Sorteio voluntário' },
];

export default function AusenciasSection({ participants, absentees, onChange }) {
  const byId = Object.fromEntries((absentees || []).map((a) => [a.participantId, a.reason]));

  function toggle(participantId, reason) {
    const current = byId[participantId];
    if (current === reason) {
      onChange((absentees || []).filter((a) => a.participantId !== participantId));
    } else {
      const others = (absentees || []).filter((a) => a.participantId !== participantId);
      onChange([...others, { participantId, reason }]);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900 mb-3">Ausências</h2>
      <p className="text-xs text-neutral-500 mb-4">
        Marque quem não vai jogar a etapa. Quem você não marcar nem incluir em uma dupla é considerada falta automática.
      </p>
      <div className="space-y-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-neutral-700">{p.name}</span>
            <div className="flex gap-1">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggle(p.id, r.value)}
                  className={`text-xs px-2 py-1 rounded-md transition-colors ${
                    byId[p.id] === r.value
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-neutral-50 text-neutral-500 border border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
