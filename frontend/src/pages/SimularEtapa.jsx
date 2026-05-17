import { useEffect, useMemo, useState } from 'react';
import { useTournament } from '../hooks/useTournament';
import { useSimulationAvailability } from '../hooks/useSimulationAvailability';
import ViewerSelector from '../components/simulacao/ViewerSelector';
import AusenciasSection from '../components/simulacao/AusenciasSection';
import DuplasSection from '../components/simulacao/DuplasSection';
import SimulationResultView from '../components/simulacao/SimulationResultView';
import { loadState, saveState, clearState, hashInput } from '../components/simulacao/storage';

const GROUP = 'F';

export default function SimularEtapa() {
  const { tApi } = useTournament();
  const { loading: availLoading, available, reason, etapa } = useSimulationAvailability(GROUP);

  const [participants, setParticipants] = useState([]);
  const [viewerId, setViewerId] = useState(null);
  const [absentees, setAbsentees] = useState([]);
  const [duplas, setDuplas] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Carrega atletas F ativas
  useEffect(() => {
    tApi.get('/participants').then((res) => {
      setParticipants((res.data || []).filter((p) => p.group === GROUP && p.active).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, []);

  // Restaura do sessionStorage quando a etapa estiver pronta
  useEffect(() => {
    if (!etapa?.id) return;
    const saved = loadState(etapa.id);
    if (saved?.form) {
      setViewerId(saved.form.viewerId || null);
      setAbsentees(saved.form.absentees || []);
      setDuplas(saved.form.duplas || []);
    }
    if (saved?.result) setResult(saved.result);
  }, [etapa?.id]);

  const inputHash = useMemo(() => hashInput({ viewerId, absentees, duplas }), [viewerId, absentees, duplas]);

  // Salva no storage quando o form muda
  useEffect(() => {
    if (!etapa?.id) return;
    saveState(etapa.id, { form: { viewerId, absentees, duplas }, result, inputHash });
  }, [etapa?.id, viewerId, absentees, duplas, result, inputHash]);

  // Validação básica
  const canSubmit = viewerId && duplas.length >= 2 && duplas.every((d) => d.playerAId && d.playerBId && d.position);

  async function handleSimulate() {
    setError(null);
    setSubmitting(true);
    try {
      // Se o input não mudou e já temos resultado, evita chamada
      if (result?._hash === inputHash) {
        setSubmitting(false);
        return;
      }
      const res = await tApi.post('/simulacao/simular', {
        viewerParticipantId: viewerId,
        group: GROUP,
        absentees,
        duplas,
      });
      setResult({ ...res.data, _hash: inputHash });
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao simular');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    if (etapa?.id) clearState(etapa.id);
    setViewerId(null);
    setAbsentees([]);
    setDuplas([]);
    setResult(null);
    setError(null);
  }

  if (availLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-neutral-500 text-sm">Carregando…</div>;
  }

  if (!available) {
    const messages = {
      desativado: 'A simulação está desativada pelo admin.',
      sem_etapa_hoje: 'A simulação só fica disponível no dia de uma etapa do Feminino.',
      fora_da_janela: 'A simulação está fora da janela horária permitida no dia da etapa.',
      etapa_concluida: 'A etapa de hoje já foi finalizada.',
    };
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold text-neutral-900">Simular Etapa</h1>
        <p className="mt-4 text-neutral-600">{messages[reason] || 'Simulação indisponível.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900">🎯 Simular Etapa</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Etapa de {etapa?.date && new Date(etapa.date + 'T12:00').toLocaleDateString('pt-BR')} — Feminino
        </p>
      </header>

      {result ? (
        <>
          <SimulationResultView standings={result.standings} viewer={result.viewer} insight={result.insight} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Nova simulação
            </button>
            <button
              type="button"
              onClick={handleSimulate}
              disabled={submitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? 'Recalculando…' : 'Recalcular insight'}
            </button>
          </div>
        </>
      ) : (
        <>
          <ViewerSelector participants={participants} value={viewerId} onChange={setViewerId} />
          <AusenciasSection participants={participants} absentees={absentees} onChange={setAbsentees} />
          <DuplasSection participants={participants} absentees={absentees} duplas={duplas} onChange={setDuplas} />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={handleSimulate}
            disabled={!canSubmit || submitting}
            className="w-full rounded-lg bg-rose-600 px-4 py-3 text-base font-semibold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Simulando…' : 'Simular'}
          </button>
        </>
      )}
    </div>
  );
}
