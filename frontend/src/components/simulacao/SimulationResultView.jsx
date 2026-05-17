function DeltaBadge({ delta }) {
  if (delta == null || delta === 0) {
    return <span className="inline-flex items-center gap-1 text-neutral-500 text-sm font-medium">— manteve</span>;
  }
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{delta}
    </span>
  );
}

export default function SimulationResultView({ standings, viewer, insight }) {
  return (
    <div className="space-y-4">
      {viewer && (
        <section className="rounded-xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-rose-600 font-semibold">Você</p>
              <h2 className="text-xl font-bold text-neutral-900">{viewer.name}</h2>
              <p className="text-sm text-neutral-600 mt-1">
                {viewer.oldPosition}º → <strong>{viewer.newPosition}º</strong>
                <span className="ml-2 text-neutral-500">({viewer.oldPoints} → {viewer.newPoints} pts)</span>
              </p>
            </div>
            <DeltaBadge delta={viewer.delta} />
          </div>
          {insight && (
            <p className="mt-4 text-sm text-neutral-700 leading-relaxed bg-white rounded-md p-3 border border-neutral-200">
              {insight}
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <h3 className="text-sm font-semibold text-neutral-900 px-5 py-3 border-b border-neutral-200">
          Ranking simulado
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Pos</th>
              <th className="px-3 py-2 text-left">Atleta</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const isViewer = viewer && s.participantId === viewer.participantId;
              return (
                <tr key={s.participantId} className={`border-t border-neutral-100 ${isViewer ? 'bg-rose-50 font-semibold' : ''}`}>
                  <td className="px-3 py-2">{s.position}º</td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-right">{s.pointsValid}</td>
                  <td className="px-3 py-2 text-right"><DeltaBadge delta={s.positionDelta} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
