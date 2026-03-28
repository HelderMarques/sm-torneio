import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTournament } from '../../hooks/useTournament';
import { useAdminGroup } from '../../hooks/useAdminGroup';
import GroupToggle from '../../components/GroupToggle';

export default function ClassificacaoAdmin() {
  const { user, logout } = useAuth();
  const { slug, tournament, tApi } = useTournament();
  const { group, setGroup } = useAdminGroup();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    tApi
      .get(`/standings/${group}`)
      .then((res) => setStandings(res.data || []))
      .catch(() => setMessage('Erro ao carregar classificação.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug, group]);

  const startEdit = (row) => {
    setEditingId(row.participantId);
    setForm({
      pointsRaw: row.pointsRaw,
      pointsDiscard: row.pointsDiscard,
      pointsBonus: row.pointsBonus,
      pointsPenalty: row.pointsPenalty,
      pointsValid: row.pointsValid,
      roundsPlayed: row.roundsPlayed,
      firstPlaces: row.firstPlaces,
      secondPlaces: row.secondPlaces,
      thirdPlaces: row.thirdPlaces,
      fourthPlaces: row.fourthPlaces,
      fifthPlaces: row.fifthPlaces,
      sixthPlaces: row.sixthPlaces,
      seventhPlaces: row.seventhPlaces,
      setsWon: row.setsWon,
      setsLost: row.setsLost,
      gamesWon: row.gamesWon,
      gamesLost: row.gamesLost,
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const payload = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') payload[k] = Number(v);
      });
      await tApi.put(`/standings/${editingId}`, payload);
      setMessage('Classificação atualizada.');
      setEditingId(null);
      setForm({});
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading && standings.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Editar Classificação</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {tournament?.name} — grupo {group === 'F' ? 'Feminino' : 'Masculino'}. Edição manual, não altera resultados das etapas.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <GroupToggle group={group} onChange={(g) => { setGroup(g); setEditingId(null); setForm({}); }} />
            <Link
              to={`/admin/t/${slug}`}
              className="text-sm text-neutral-500 hover:text-neutral-900 font-medium"
            >
              ← Voltar ao painel
            </Link>
            <button
              onClick={logout}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sair
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl mb-4 text-sm ${
              message.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
          <div className="p-5 border-b border-neutral-100 bg-neutral-50/60 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Classificação Atual</h2>
            <p className="text-[11px] text-neutral-500">
              Clique em “Editar” numa atleta para forçar os números da linha.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Pos
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Atleta
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Pts Válidos
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Ganhos
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Desc.
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Bônus
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Perd.
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Part.
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr key={s.participantId} className="border-b border-neutral-100">
                    <td className="px-3 py-2 text-neutral-700 font-semibold">{s.position}º</td>
                    <td className="px-3 py-2 text-neutral-900 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-center text-neutral-800">{s.pointsValid}</td>
                    <td className="px-3 py-2 text-center text-neutral-600">{s.pointsRaw}</td>
                    <td className="px-3 py-2 text-center text-neutral-600">
                      {s.pointsDiscard > 0 ? `-${s.pointsDiscard}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-neutral-600">
                      {s.pointsBonus > 0 ? `+${s.pointsBonus}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-red-600/90">
                      {s.pointsPenalty > 0 ? `-${s.pointsPenalty}` : '0'}
                    </td>
                    <td className="px-3 py-2 text-center text-neutral-600">{s.roundsPlayed}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="text-xs font-medium text-[#9B2D3E] hover:text-[#8B2942]"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editingId && (
          <div className="mt-6 bg-white rounded-2xl border border-neutral-200/80 p-6">
            <h2 className="font-semibold text-neutral-900 mb-3 text-sm">
              Edição manual —{' '}
              {standings.find((s) => s.participantId === editingId)?.name || 'Atleta'}
            </h2>
            <p className="text-[11px] text-neutral-500 mb-4">
              Estes ajustes são diretos na tabela de classificação. Se voltar a recalcular a partir das etapas,
              os valores podem ser sobrescritos.
            </p>
            <div className="grid md:grid-cols-4 gap-4 mb-4 text-xs">
              <NumericField label="Pts Ganhos" value={form.pointsRaw} onChange={(v) => handleChange('pointsRaw', v)} />
              <NumericField label="Descarte" value={form.pointsDiscard} onChange={(v) => handleChange('pointsDiscard', v)} />
              <NumericField label="Bônus" value={form.pointsBonus} onChange={(v) => handleChange('pointsBonus', v)} />
              <NumericField label="Penalidades" value={form.pointsPenalty} onChange={(v) => handleChange('pointsPenalty', v)} />
              <NumericField label="Pts Válidos" value={form.pointsValid} onChange={(v) => handleChange('pointsValid', v)} />
              <NumericField label="Participações" value={form.roundsPlayed} onChange={(v) => handleChange('roundsPlayed', v)} />
              <NumericField label="1º lugares" value={form.firstPlaces} onChange={(v) => handleChange('firstPlaces', v)} />
              <NumericField label="2º lugares" value={form.secondPlaces} onChange={(v) => handleChange('secondPlaces', v)} />
              <NumericField label="3º lugares" value={form.thirdPlaces} onChange={(v) => handleChange('thirdPlaces', v)} />
              <NumericField label="4º lugares" value={form.fourthPlaces} onChange={(v) => handleChange('fourthPlaces', v)} />
              <NumericField label="5º lugares" value={form.fifthPlaces} onChange={(v) => handleChange('fifthPlaces', v)} />
              <NumericField label="6º lugares" value={form.sixthPlaces} onChange={(v) => handleChange('sixthPlaces', v)} />
              <NumericField label="7º lugares" value={form.seventhPlaces} onChange={(v) => handleChange('seventhPlaces', v)} />
              <NumericField label="Sets Vencidos" value={form.setsWon} onChange={(v) => handleChange('setsWon', v)} />
              <NumericField label="Sets Perdidos" value={form.setsLost} onChange={(v) => handleChange('setsLost', v)} />
              <NumericField label="Games Vencidos" value={form.gamesWon} onChange={(v) => handleChange('gamesWon', v)} />
              <NumericField label="Games Perdidos" value={form.gamesLost} onChange={(v) => handleChange('gamesLost', v)} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({});
                }}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NumericField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-neutral-500 mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="border border-neutral-200 rounded-lg px-3 py-1.5 text-xs w-full focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
      />
    </div>
  );
}

