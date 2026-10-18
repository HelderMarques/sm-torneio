import { useChances } from '../hooks/useChances';

function statusLabel(titulo, trofeu) {
  if (titulo === 'garantido') return { txt: 'Título garantido', cls: 'bg-amber-100 text-amber-800' };
  if (titulo === 'vivo') return { txt: 'Ainda pode ser campeã', cls: 'bg-emerald-100 text-emerald-700' };
  if (titulo === 'depende_desempate') return { txt: 'Título depende de desempate', cls: 'bg-amber-50 text-amber-700' };
  if (trofeu === 'garantido') return { txt: 'Troféu garantido', cls: 'bg-emerald-50 text-emerald-700' };
  if (trofeu === 'vivo') return { txt: 'Na disputa pelo troféu', cls: 'bg-sky-100 text-sky-700' };
  if (trofeu === 'depende_desempate') return { txt: 'Troféu depende de desempate', cls: 'bg-sky-50 text-sky-700' };
  return { txt: 'Sem chance de troféu', cls: 'bg-neutral-100 text-neutral-500' };
}

function Bar({ label, value }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-neutral-600">{label}</span>
        <span className="text-neutral-500">{pct}% <span className="text-neutral-400">(estimativa)</span></span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#9B2D3E] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ChancesTitulo({ participantId, group }) {
  const { data, loading, error } = useChances(group);

  if (loading) {
    return <div className="bg-white rounded-xl border border-neutral-200/80 p-5 animate-pulse h-28" />;
  }
  if (error || !data) {
    return <p className="text-sm text-neutral-400">Não foi possível calcular as chances.</p>;
  }
  const me = data.athletes.find((a) => a.participantId === participantId);
  if (!me) return null;

  const st = statusLabel(me.titulo, me.trofeu);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
        <h2 className="font-semibold text-neutral-900">Chances de título e troféu</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          {data.remaining > 0 ? `${data.remaining} etapa(s) restante(s)` : 'Temporada encerrada'} · troféu = top {data.trophyPositions}
        </p>
      </div>
      <div className="p-5 space-y-4">
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.txt}</span>

        <div className="text-sm text-neutral-700 leading-relaxed">
          {me.resumo || (me.condicoes || []).join(' ')}
        </div>

        <div className="space-y-3 pt-1">
          <Bar label="Chance de título" value={me.probTitulo} />
          <Bar label="Chance de troféu" value={me.probTrofeu} />
        </div>

        <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-3">
          A porcentagem é uma <strong>estimativa</strong> (assume chances iguais entre as atletas). As condições acima são exatas pelo regulamento.
        </p>
      </div>
    </div>
  );
}
