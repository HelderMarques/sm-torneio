export default function ViewerSelector({ participants, value, onChange }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <label className="block text-sm font-semibold text-neutral-900 mb-2">
        Quem é você?
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
      >
        <option value="">Selecione…</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <p className="text-xs text-neutral-500 mt-2">
        A simulação destaca o seu novo ranking e gera um insight personalizado para você.
      </p>
    </section>
  );
}
