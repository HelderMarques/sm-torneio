import { useChances } from '../hooks/useChances';

function statusLabel(titulo) {
  if (titulo === 'garantido') return { txt: 'Campeã garantida', cls: 'bg-amber-100 text-amber-800' };
  if (titulo === 'vivo') return { txt: 'Ainda pode ser campeã', cls: 'bg-emerald-100 text-emerald-700' };
  if (titulo === 'depende_desempate') return { txt: 'Título depende de desempate', cls: 'bg-amber-50 text-amber-700' };
  return { txt: 'Não pode mais ser campeã', cls: 'bg-neutral-100 text-neutral-500' };
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

  const st = statusLabel(me.titulo);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
        <h2 className="font-semibold text-neutral-900">Chance de título</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          {data.remaining > 0 ? `${data.remaining} etapa(s) restante(s)` : 'Temporada encerrada'}
        </p>
      </div>
      <div className="p-5 space-y-4">
        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>{st.txt}</span>

        <div className="text-sm text-neutral-700 leading-relaxed">
          {me.resumo || (me.condicoes || []).join(' ')}
        </div>

        <p className="text-xs text-neutral-400 border-t border-neutral-100 pt-3">
          Baseado no regulamento e nos resultados até aqui.
        </p>
      </div>
    </div>
  );
}
