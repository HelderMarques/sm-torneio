import { useEffect, useState } from 'react';
import api from '../../api/client';

const CATEGORY_LABELS = {
  pontuacao: 'Pontuação por Colocação',
  bonificacao: 'Bonificações e Penalidades',
  descarte: 'Regra de Descarte',
  formato_partida: 'Formato das Partidas',
  inscricoes: 'Inscrições e Limites',
  quadras: 'Configuração de Quadras',
  financeiro: 'Valores Financeiros',
};

const CATEGORY_ORDER = [
  'pontuacao',
  'bonificacao',
  'descarte',
  'formato_partida',
  'inscricoes',
  'quadras',
  'financeiro',
];

const SCORING_MODE_OPTIONS = ['NO_AD', 'ADVANTAGE'];
const BRACKET_FORMAT_OPTIONS = ['DOUBLE_ELIMINATION', 'SINGLE_ELIMINATION', 'ROUND_ROBIN'];

function SettingInput({ setting, value, onChange }) {
  if (setting.type === 'boolean') {
    const checked = value === 'true' || value === true;
    return (
      <button
        type="button"
        onClick={() => onChange(checked ? 'false' : 'true')}
        aria-label={`Toggle ${setting.label}`}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[#9B2D3E]' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    );
  }

  if (setting.key === 'scoring_mode') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50 w-40"
      >
        {SCORING_MODE_OPTIONS.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (setting.key === 'bracket_format') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50 w-52"
      >
        {BRACKET_FORMAT_OPTIONS.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={setting.type === 'int' || setting.type === 'float' ? 'number' : 'text'}
      step={setting.type === 'float' ? '0.01' : '1'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50 w-28 text-right"
    />
  );
}

export default function ConfiguracoesTorneio() {
  const [grouped, setGrouped] = useState({});
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // category key being saved
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const flash = (setFn, text, ms = 4000) => {
    setFn(text);
    setTimeout(() => setFn(''), ms);
  };

  useEffect(() => {
    api.get('/settings')
      .then((r) => {
        setGrouped(r.data);
        const d = {};
        for (const settings of Object.values(r.data)) {
          for (const s of settings) d[s.key] = s.value;
        }
        setDraft(d);
      })
      .catch(() => flash(setErr, 'Erro ao carregar configurações.'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveCategory = async (category) => {
    const settings = grouped[category] || [];
    const payload = settings.map((s) => ({ key: s.key, value: draft[s.key] ?? s.value }));
    setSaving(category);
    try {
      await api.put('/settings/bulk', { settings: payload });
      // Update grouped state with new values
      setGrouped((prev) => ({
        ...prev,
        [category]: prev[category].map((s) => ({ ...s, value: draft[s.key] ?? s.value })),
      }));
      flash(setMsg, 'Configurações salvas com sucesso.');
    } catch (e) {
      flash(setErr, e.response?.data?.error || 'Erro ao salvar configurações.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    const payload = Object.keys(draft).map((key) => ({ key, value: draft[key] }));
    setSaving('all');
    try {
      await api.put('/settings/bulk', { settings: payload });
      flash(setMsg, 'Todas as configurações foram salvas.');
    } catch (e) {
      flash(setErr, e.response?.data?.error || 'Erro ao salvar configurações.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped[c]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Regras do Torneio</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Configurações de pontuação, formatos, limites e valores financeiros
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving !== null}
          className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {saving === 'all' ? 'Salvando…' : 'Salvar tudo'}
        </button>
      </div>

      {msg && (
        <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
          {err}
        </div>
      )}

      {orderedCategories.map((category) => {
        const settings = grouped[category];
        const sharedSettings = settings.filter((s) => s.group === 'SHARED');
        const masculinoSettings = settings.filter((s) => s.group === 'MASCULINO');
        const femininoSettings = settings.filter((s) => s.group === 'FEMININO');
        const hasGrouped = masculinoSettings.length > 0 || femininoSettings.length > 0;

        return (
          <section key={category} className="mb-8">
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[category] || category}
            </h2>

            <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
              {/* SHARED settings */}
              {sharedSettings.map((s) => (
                <div key={s.key} className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 last:border-b-0">
                  <p className="text-sm text-neutral-700">{s.label}</p>
                  <SettingInput
                    setting={s}
                    value={draft[s.key] ?? s.value}
                    onChange={(v) => handleChange(s.key, v)}
                  />
                </div>
              ))}

              {/* Group-specific settings: Masculino + Feminino side by side */}
              {hasGrouped && (
                <div className="border-t border-neutral-100">
                  {/* Pair rows by base key */}
                  {(() => {
                    // Group masculino/feminino by their base label (strip group suffix from label)
                    const allGrouped = [...masculinoSettings, ...femininoSettings];
                    // Find unique base labels by pairing M and F with matching label patterns
                    const mKeys = masculinoSettings.map((s) => s.key);
                    const fKeys = femininoSettings.map((s) => s.key);
                    const maxRows = Math.max(mKeys.length, fKeys.length);

                    return Array.from({ length: maxRows }, (_, i) => {
                      const mSetting = masculinoSettings[i];
                      const fSetting = femininoSettings[i];
                      return (
                        <div key={i} className="px-5 py-3.5 border-b border-neutral-100 last:border-b-0">
                          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2.5">
                            {/* Use the base label, stripping the group part */}
                            {mSetting?.label.replace(/ \(Masculino\)$/, '').replace(/ — Masculino$/, '') ||
                             fSetting?.label.replace(/ \(Feminino\)$/, '').replace(/ — Feminino$/, '')}
                          </p>
                          <div className="flex gap-6">
                            {mSetting && (
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs text-neutral-400 w-20">Masculino</span>
                                <SettingInput
                                  setting={mSetting}
                                  value={draft[mSetting.key] ?? mSetting.value}
                                  onChange={(v) => handleChange(mSetting.key, v)}
                                />
                              </div>
                            )}
                            {fSetting && (
                              <div className="flex items-center gap-2.5">
                                <span className="text-xs text-neutral-400 w-20">Feminino</span>
                                <SettingInput
                                  setting={fSetting}
                                  value={draft[fSetting.key] ?? fSetting.value}
                                  onChange={(v) => handleChange(fSetting.key, v)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Save button for this category */}
              <div className="px-5 py-3 bg-neutral-50/50 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => handleSaveCategory(category)}
                  disabled={saving !== null}
                  className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942] disabled:opacity-50"
                >
                  {saving === category ? 'Salvando…' : 'Salvar seção'}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
