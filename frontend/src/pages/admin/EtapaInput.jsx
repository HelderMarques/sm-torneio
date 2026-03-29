import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';

// Games per court: 2N - 1
const gamesForPairs = (n) => Math.max(0, 2 * n - 1);

const PONTOS_POSICAO = { 1: 100, 2: 80, 3: 70, 4: 60, 5: 50, 6: 40, 7: 30 };

// ── Double-loss position algorithm (mirrors backend) ──────────────────
function computePositions(n, games) {
  const losses = new Array(n).fill(0);
  const eliminated = [];
  for (const { pairAIndex: a, pairBIndex: b, scoreA, scoreB } of games) {
    if (a == null || b == null || a >= n || b >= n || scoreA === scoreB) continue;
    const loser = scoreA < scoreB ? a : b;
    losses[loser]++;
    if (losses[loser] >= 2 && !eliminated.includes(loser)) eliminated.push(loser);
  }
  const winners = Array.from({ length: n }, (_, i) => i).filter(
    (i) => !eliminated.includes(i)
  );
  const pos = new Array(n).fill(null);
  let p = 1;
  winners.forEach((i) => { pos[i] = p++; });
  for (let i = eliminated.length - 1; i >= 0; i--) pos[eliminated[i]] = p++;
  return pos;
}

// ── Autocomplete input ────────────────────────────────────────────────
function PlayerInput({ value, onChange, participants, usedNames, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef(null);

  useEffect(() => { setQuery(value); }, [value]);

  const normalize = (s) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = query.length > 0
    ? participants.filter((p) =>
        normalize(p.name).includes(normalize(query)) && !usedNames.has(p.name)
      ).slice(0, 6)
    : [];

  const select = (name) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 150);
    // If typed value matches a participant exactly, accept it
    const exact = participants.find(
      (p) => normalize(p.name) === normalize(query)
    );
    if (exact) { onChange(exact.name); setQuery(exact.name); }
    else if (!participants.find((p) => p.name === value)) {
      // keep whatever was typed for validation error later
      onChange(query);
    }
  };

  const valid = participants.some((p) => p.name === value);

  return (
    <div className="relative flex-1" ref={ref}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] transition-colors ${
          value && !valid ? 'border-red-300 bg-red-50' : 'border-neutral-200'
        }`}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => select(p.name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 text-neutral-800"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Court section ─────────────────────────────────────────────────────
function CourtSection({ court, index, participants, usedNames, onChange, onRemove }) {
  const { label, pairs, games } = court;
  const totalGames = gamesForPairs(pairs.length);

  const updatePair = (pi, field, value) => {
    const next = pairs.map((p, i) => i === pi ? { ...p, [field]: value } : p);
    onChange({ ...court, pairs: next });
  };

  const addPair = () => {
    if (pairs.length >= 7) return;
    const newGamesCount = gamesForPairs(pairs.length + 1);
    const newGames = Array.from({ length: newGamesCount }, (_, i) =>
      games[i] ?? { pairAIndex: null, pairBIndex: null, scoreA: '', scoreB: '' }
    );
    onChange({ ...court, pairs: [...pairs, { playerA: '', playerB: '' }], games: newGames });
  };

  const removePair = () => {
    if (pairs.length <= 2) return;
    const next = pairs.slice(0, -1);
    const newGamesCount = gamesForPairs(next.length);
    onChange({ ...court, pairs: next, games: games.slice(0, newGamesCount) });
  };

  const updateGame = (gi, field, value) => {
    const next = games.map((g, i) => i === gi ? { ...g, [field]: value } : g);
    onChange({ ...court, games: next });
  };

  // Live position preview
  const resolvedGames = games.map((g) => ({
    pairAIndex: g.pairAIndex != null ? Number(g.pairAIndex) : null,
    pairBIndex: g.pairBIndex != null ? Number(g.pairBIndex) : null,
    scoreA: Number(g.scoreA) || 0,
    scoreB: Number(g.scoreB) || 0,
  }));
  const positions = computePositions(pairs.length, resolvedGames);

  const pairLabel = (i) => {
    const { playerA, playerB } = pairs[i] || {};
    if (playerA && playerB) return `${playerA} / ${playerB}`;
    return `Dupla ${i + 1}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
      {/* Court header */}
      <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3">
        <input
          type="text"
          value={label}
          placeholder="Nome da quadra (ex: Quadra 4)"
          onChange={(e) => onChange({ ...court, label: e.target.value })}
          className="flex-1 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-neutral-400 hover:text-red-500 transition-colors p-1"
          title="Remover quadra"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Pairs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Duplas — sorteio na ordem
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={removePair}
                disabled={pairs.length <= 2}
                className="w-6 h-6 rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 flex items-center justify-center text-sm font-bold"
              >
                −
              </button>
              <span className="text-xs text-neutral-400 tabular-nums">{pairs.length}/7</span>
              <button
                type="button"
                onClick={addPair}
                disabled={pairs.length >= 7}
                className="w-6 h-6 rounded-md border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30 flex items-center justify-center text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {pairs.map((pair, pi) => (
              <div key={pi} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-semibold text-neutral-400 shrink-0">
                  {pi + 1}
                </span>
                <PlayerInput
                  value={pair.playerA}
                  onChange={(v) => updatePair(pi, 'playerA', v)}
                  participants={participants}
                  usedNames={usedNames}
                  placeholder="Jogador A (cabeça)"
                />
                <span className="text-neutral-300 text-xs shrink-0">/</span>
                <PlayerInput
                  value={pair.playerB}
                  onChange={(v) => updatePair(pi, 'playerB', v)}
                  participants={participants}
                  usedNames={usedNames}
                  placeholder="Jogador B"
                />
                {positions[pi] != null && (
                  <span className="shrink-0 text-xs font-semibold text-neutral-400 w-12 text-right">
                    {positions[pi]}º · {PONTOS_POSICAO[positions[pi]] ?? '?'} pts
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Games */}
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Jogos ({totalGames} esperados para {pairs.length} duplas)
          </p>
          <div className="space-y-1.5">
            {Array.from({ length: totalGames }, (_, gi) => {
              const g = games[gi] ?? { pairAIndex: null, pairBIndex: null, scoreA: '', scoreB: '' };
              const hasScore = g.scoreA !== '' && g.scoreB !== '';
              const winner = hasScore && Number(g.scoreA) !== Number(g.scoreB)
                ? (Number(g.scoreA) > Number(g.scoreB) ? g.pairAIndex : g.pairBIndex)
                : null;

              return (
                <div key={gi} className="flex items-center gap-2">
                  {/* Game number */}
                  <span className="w-5 text-center text-xs text-neutral-400 font-medium shrink-0">
                    J{gi + 1}
                  </span>

                  {/* Pair A */}
                  <select
                    value={g.pairAIndex ?? ''}
                    onChange={(e) => updateGame(gi, 'pairAIndex', e.target.value === '' ? null : Number(e.target.value))}
                    className="flex-1 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                  >
                    <option value="">— dupla —</option>
                    {pairs.map((_, pi) => (
                      <option key={pi} value={pi}>{pairLabel(pi)}</option>
                    ))}
                  </select>

                  {/* Score A */}
                  <input
                    type="number"
                    min="0"
                    max="9"
                    value={g.scoreA}
                    onChange={(e) => updateGame(gi, 'scoreA', e.target.value)}
                    className={`w-12 text-center border rounded-lg px-1 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] ${
                      winner != null && Number(g.pairAIndex) === winner ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200'
                    }`}
                  />

                  <span className="text-neutral-400 text-xs font-medium shrink-0">×</span>

                  {/* Score B */}
                  <input
                    type="number"
                    min="0"
                    max="9"
                    value={g.scoreB}
                    onChange={(e) => updateGame(gi, 'scoreB', e.target.value)}
                    className={`w-12 text-center border rounded-lg px-1 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] ${
                      winner != null && Number(g.pairBIndex) === winner ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200'
                    }`}
                  />

                  {/* Pair B */}
                  <select
                    value={g.pairBIndex ?? ''}
                    onChange={(e) => updateGame(gi, 'pairBIndex', e.target.value === '' ? null : Number(e.target.value))}
                    className="flex-1 border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                  >
                    <option value="">— dupla —</option>
                    {pairs.map((_, pi) => (
                      <option key={pi} value={pi}>{pairLabel(pi)}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Test data generator ───────────────────────────────────────────────
/**
 * Pairs participants by standings order: 1st with last, 2nd with 2nd-to-last…
 * If odd count, the middle player becomes a sorteado.
 * Generates random valid game scores (no ties).
 */
function buildTestData(orderedNames, group) {
  const n = orderedNames.length;
  const allPairs = [];

  // Pair by rank: top with bottom
  const half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) {
    allPairs.push({ playerA: orderedNames[i], playerB: orderedNames[n - 1 - i] });
  }

  const sorteados = [];
  if (n % 2 !== 0) {
    sorteados.push({
      id: Math.random().toString(36).slice(2),
      name: orderedNames[half],
      type: 'sorteio',
    });
  }

  // Feminino → sempre 1 quadra; Masculino → sempre 2 quadras
  const isMasculino = group === 'M';
  const courtCount = isMasculino ? 2 : 1;

  // Distribute pairs as evenly as possible across courts
  const pairsPerCourt = Math.ceil(allPairs.length / courtCount);
  const courts = [];
  for (let c = 0; c < courtCount; c++) {
    const courtPairs = allPairs.slice(c * pairsPerCourt, (c + 1) * pairsPerCourt);
    if (!courtPairs.length) continue;
    const numGames = gamesForPairs(courtPairs.length);

    // Generate random bracket-style games
    const games = [];
    // Track which pairs are in WB / LB naively for realistic matchups
    const losses = new Array(courtPairs.length).fill(0);
    const eliminated = [];

    for (let g = 0; g < numGames; g++) {
      // Find two pairs that haven't both been eliminated
      const active = courtPairs.map((_, i) => i).filter((i) => !eliminated.includes(i));
      const a = active[g % active.length] ?? 0;
      const b = active[(g + 1) % active.length] ?? (a === 0 ? 1 : 0);
      const actualA = a !== b ? a : (a + 1) % courtPairs.length;

      const winnerIsA = Math.random() > 0.5;
      const winScore = 5;
      const loseScore = Math.floor(Math.random() * 5); // 0–4

      games.push({
        pairAIndex: actualA,
        pairBIndex: b,
        scoreA: winnerIsA ? winScore : loseScore,
        scoreB: winnerIsA ? loseScore : winScore,
      });

      const loser = winnerIsA ? b : actualA;
      losses[loser]++;
      if (losses[loser] >= 2 && !eliminated.includes(loser)) eliminated.push(loser);
    }

    courts.push({
      id: Math.random().toString(36).slice(2),
      label: courtCount === 1 ? 'Quadra Teste' : `Quadra Teste ${c + 1}`,
      pairs: courtPairs,
      games,
    });
  }

  return { courts, sorteados };
}

// ── Main page ─────────────────────────────────────────────────────────
const newCourt = () => ({
  id: Math.random().toString(36).slice(2),
  label: '',
  pairs: [
    { playerA: '', playerB: '' },
    { playerA: '', playerB: '' },
    { playerA: '', playerB: '' },
  ],
  games: Array.from({ length: gamesForPairs(3) }, () => ({
    pairAIndex: null, pairBIndex: null, scoreA: '', scoreB: '',
  })),
});

export default function EtapaInput() {
  const { id } = useParams();
  const { slug, tApi, tournament } = useTournament();
  const navigate = useNavigate();

  const [round, setRound] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [courts, setCourts] = useState([newCourt()]);
  const [sorteados, setSorteados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(null); // success snapshot
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([tApi.get(`/rounds/${id}`), tApi.get('/participants')])
      .then(([rRes, pRes]) => {
        const r = rRes.data;
        setRound(r);
        setParticipants(pRes.data.filter((p) => p.group === r.group && p.active));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  // All names currently in use (for autocomplete filtering)
  const usedNames = new Set([
    ...courts.flatMap((c) => c.pairs.flatMap((p) => [p.playerA, p.playerB])).filter(Boolean),
    ...sorteados.map((s) => s.name).filter(Boolean),
  ]);

  const updateCourt = (idx, updated) =>
    setCourts((prev) => prev.map((c, i) => (i === idx ? updated : c)));

  const removeCourt = (idx) =>
    setCourts((prev) => prev.filter((_, i) => i !== idx));

  const addSorteado = () =>
    setSorteados((prev) => [...prev, { id: Math.random().toString(36).slice(2), name: '', type: 'sorteio' }]);

  const updateSorteado = (idx, field, value) =>
    setSorteados((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));

  const removeSorteado = (idx) =>
    setSorteados((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const errs = [];
    const validNames = new Set(participants.map((p) => p.name));
    const allNames = [];

    courts.forEach((c, ci) => {
      if (!c.label.trim()) errs.push(`Quadra ${ci + 1}: nome obrigatório`);
      c.pairs.forEach((p, pi) => {
        if (!p.playerA) errs.push(`Quadra "${c.label || ci + 1}", Dupla ${pi + 1}: Jogador A vazio`);
        else if (!validNames.has(p.playerA)) errs.push(`Jogador não encontrado: "${p.playerA}"`);
        else allNames.push(p.playerA);

        if (!p.playerB) errs.push(`Quadra "${c.label || ci + 1}", Dupla ${pi + 1}: Jogador B vazio`);
        else if (!validNames.has(p.playerB)) errs.push(`Jogador não encontrado: "${p.playerB}"`);
        else allNames.push(p.playerB);
      });

      const expectedGames = gamesForPairs(c.pairs.length);
      const filledGames = c.games.filter(
        (g) => g.pairAIndex != null && g.pairBIndex != null && g.scoreA !== '' && g.scoreB !== ''
      );
      if (filledGames.length === 0) errs.push(`Quadra "${c.label || ci + 1}": nenhum jogo preenchido`);

      filledGames.forEach((g, gi) => {
        if (Number(g.scoreA) === Number(g.scoreB)) {
          errs.push(`Quadra "${c.label || ci + 1}", Jogo ${gi + 1}: placar empatado não permitido`);
        }
        if (Number(g.scoreA) < 0 || Number(g.scoreB) < 0) {
          errs.push(`Quadra "${c.label || ci + 1}", Jogo ${gi + 1}: placar não pode ser negativo`);
        }
      });
    });

    sorteados.forEach((s, si) => {
      if (!s.name) errs.push(`Sorteado ${si + 1}: nome vazio`);
      else if (!validNames.has(s.name)) errs.push(`Sorteado não encontrado: "${s.name}"`);
      else allNames.push(s.name);
    });

    // Duplicate check
    const seen = new Set();
    allNames.forEach((n) => {
      if (seen.has(n)) errs.push(`Jogador "${n}" aparece mais de uma vez`);
      seen.add(n);
    });

    return errs;
  };

  const handleDeleteResults = async () => {
    if (!window.confirm(
      `Apagar todos os resultados da ${round.number}ª Etapa?\n\nA etapa voltará para "Agendada" e a classificação será recalculada sem essa etapa. Esta ação não pode ser desfeita.`
    )) return;

    setDeleting(true);
    try {
      await tApi.delete(`/rounds/${id}/results`);
      // Reload round to reflect new SCHEDULED status
      const rRes = await tApi.get(`/rounds/${id}`);
      setRound(rRes.data);
      setResult(null);
    } catch (err) {
      setErrors([err.response?.data?.error || 'Erro ao apagar resultados']);
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateTest = async () => {
    setGenerating(true);
    try {
      // Get participants sorted by current standings (1º → último)
      const standingsRes = await tApi.get(`/standings/${round.group}`);
      const standings = standingsRes.data || [];

      let orderedNames;
      if (standings.length > 0) {
        // Standings already sorted by position
        orderedNames = standings
          .map((s) => participants.find((p) => p.id === s.participantId)?.name)
          .filter(Boolean);
        // Append any participants not yet in standings
        const inStandings = new Set(standings.map((s) => s.participantId));
        participants.forEach((p) => {
          if (!inStandings.has(p.id)) orderedNames.push(p.name);
        });
      } else {
        orderedNames = participants.map((p) => p.name);
      }

      const { courts: genCourts, sorteados: genSorteados } = buildTestData(orderedNames, round.group);
      setCourts(genCourts);
      setSorteados(genSorteados);
      setErrors([]);
    } catch (err) {
      setErrors(['Erro ao gerar dados: ' + (err.response?.data?.error || err.message)]);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);

    try {
      const payload = {
        courts: courts.map((c) => ({
          label: c.label,
          pairs: c.pairs.map((p) => ({ playerA: p.playerA, playerB: p.playerB })),
          games: c.games
            .filter((g) => g.pairAIndex != null && g.pairBIndex != null && g.scoreA !== '' && g.scoreB !== '')
            .map((g) => ({
              pairAIndex: Number(g.pairAIndex),
              pairBIndex: Number(g.pairBIndex),
              scoreA: Number(g.scoreA),
              scoreB: Number(g.scoreB),
            })),
        })),
        sorteados: sorteados.map((s) => ({ name: s.name, type: s.type })),
      };

      const res = await tApi.post(`/rounds/${id}/court-results`, payload);
      setResult(res.data);
    } catch (err) {
      setErrors([err.response?.data?.error || 'Erro ao salvar resultados']);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  if (!round) return <div className="text-center py-20 text-neutral-500">Etapa não encontrada</div>;

  // ── Success screen ──────────────────────────────────────────────────
  if (result) {
    const { absents = [], standings = [] } = result;
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-emerald-900">Resultados salvos!</h2>
          <p className="text-sm text-emerald-700 mt-1">Classificação recalculada com sucesso.</p>
        </div>

        {absents.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
            <strong>Ausentes detectados automaticamente:</strong>{' '}
            {absents.join(', ')}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900">Classificação atualizada — {round.group === 'F' ? 'Feminino' : 'Masculino'}</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100 text-xs text-neutral-400 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Atleta</th>
                <th className="px-4 py-2 text-right">Pts Válidos</th>
                <th className="px-4 py-2 text-right">Part.</th>
              </tr>
            </thead>
            <tbody>
              {standings.slice(0, 20).map((s) => (
                <tr key={s.participantId} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                  <td className="px-4 py-2 font-semibold text-neutral-500">{s.position}º</td>
                  <td className="px-4 py-2 font-medium text-neutral-900">{s.name}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#9B2D3E]">{s.pointsValid}</td>
                  <td className="px-4 py-2 text-right text-neutral-500">{s.roundsPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Link
            to={`/admin/t/${slug}/etapas`}
            className="flex-1 text-center border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-neutral-50"
          >
            Voltar às etapas
          </Link>
          <button
            type="button"
            onClick={handleDeleteResults}
            disabled={deleting}
            className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleting ? 'Apagando…' : 'Apagar resultados'}
          </button>
          <Link
            to={`/admin/t/${slug}/etapa/${id}/manual`}
            className="flex-1 text-center bg-[#9B2D3E] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#8B2942]"
          >
            Ajuste manual (avançado)
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
          <Link to={`/admin/t/${slug}/etapas`} className="hover:text-[#9B2D3E] transition-colors">
            Registrar Resultados
          </Link>
          <span>›</span>
          <span>{round.number}ª Etapa — {round.group === 'F' ? 'Feminino' : 'Masculino'}</span>
          <span>›</span>
          <span>Entrada por quadra</span>
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              {round.number}ª Etapa — {round.group === 'F' ? 'Feminino' : 'Masculino'}
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          {round.status === 'COMPLETED' && (
            <button
              type="button"
              onClick={handleDeleteResults}
              disabled={deleting}
              className="shrink-0 flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleting ? 'Apagando…' : 'Apagar resultados'}
            </button>
          )}
        </div>
      </div>

      {/* Test data generator — only when feature flag is on */}
      {tournament?.testResultEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Modo Teste</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Gera duplas automaticamente (1º com último, 2º com penúltimo…) e resultados aleatórios.
              Substitui o conteúdo atual do formulário.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateTest}
            disabled={generating || participants.length < 2}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {generating ? 'Gerando…' : 'Gerar dados'}
          </button>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-red-800 mb-1">Corrija os erros antes de salvar:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e, i) => (
              <li key={i} className="text-sm text-red-700">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Courts */}
      <div className="space-y-4 mb-4">
        {courts.map((court, ci) => (
          <CourtSection
            key={court.id}
            court={court}
            index={ci}
            participants={participants}
            usedNames={usedNames}
            onChange={(updated) => updateCourt(ci, updated)}
            onRemove={() => removeCourt(ci)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setCourts((prev) => [...prev, newCourt()])}
        className="w-full border-2 border-dashed border-neutral-200 rounded-2xl py-3 text-sm font-medium text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors mb-6"
      >
        + Adicionar quadra
      </button>

      {/* Sorteados */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">Sorteados</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Jogadores excluídos por sorteio. Ausentes são detectados automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={addSorteado}
            className="text-sm text-[#9B2D3E] font-medium hover:text-[#8B2942]"
          >
            + Adicionar
          </button>
        </div>

        {sorteados.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-400 text-center">
            Nenhum sorteado. Clique em "+ Adicionar" se houver.
          </p>
        ) : (
          <div className="divide-y divide-neutral-50">
            {sorteados.map((s, si) => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                <PlayerInput
                  value={s.name}
                  onChange={(v) => updateSorteado(si, 'name', v)}
                  participants={participants}
                  usedNames={usedNames}
                  placeholder="Nome do jogador"
                />
                <select
                  value={s.type}
                  onChange={(e) => updateSorteado(si, 'type', e.target.value)}
                  className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                >
                  <option value="sorteio">Sorteio (80 pts)</option>
                  <option value="sorteio_a_pedido">A pedido (60 pts)</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeSorteado(si)}
                  className="text-neutral-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-[#9B2D3E] hover:bg-[#8B2942] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Salvando...' : 'Salvar Resultados'}
      </button>

      <p className="text-xs text-neutral-400 text-center mt-3">
        Posições são calculadas automaticamente pela lógica de dupla derrota.
        Ausentes são detectados a partir da lista de participantes inscritos.
      </p>
    </div>
  );
}
