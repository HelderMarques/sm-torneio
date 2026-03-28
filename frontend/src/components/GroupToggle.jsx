export default function GroupToggle({ group, onChange }) {
  return (
    <div className="flex rounded-xl border border-neutral-200 overflow-hidden text-sm font-medium">
      {['F', 'M'].map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={`px-4 py-1.5 transition-colors ${
            group === g ? 'bg-[#9B2D3E] text-white' : 'text-neutral-500 hover:bg-neutral-50'
          }`}
        >
          {g === 'F' ? 'Feminino' : 'Masculino'}
        </button>
      ))}
    </div>
  );
}
