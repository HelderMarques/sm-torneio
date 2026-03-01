import { useTournament } from '../hooks/useTournament';

export default function Regulamento() {
  const { tournament } = useTournament();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight mb-6">
        Regulamento — Temporada {tournament?.year}
      </h1>

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 space-y-8 text-neutral-600 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">Pontuação por Colocação</h2>
          <div className="overflow-x-auto">
            <table className="text-sm border border-neutral-200 rounded-xl">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="px-4 py-2.5 border-b border-neutral-200 text-left font-medium text-neutral-700">Colocação</th>
                  <th className="px-4 py-2.5 border-b border-neutral-200 text-center font-medium text-neutral-700">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['1º (Campeã)', 100], ['2º', 80], ['3º', 70], ['4º', 60],
                  ['5º', 50], ['6º', 40], ['7º', 30],
                  ['Sorteada (ficou fora)', 80], ['Voluntária (ficou fora)', 60],
                  ['Ausente / Faltou', 0],
                ].map(([pos, pts]) => (
                  <tr key={pos} className="border-b border-neutral-100">
                    <td className="px-4 py-2.5">{pos}</td>
                    <td className="px-4 py-2.5 font-semibold text-neutral-900 text-center">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Regra do Descarte</h2>
          <p>
            Ativa a partir da 5ª etapa. A cada rodada, o sistema identifica o menor ponto positivo
            obtido pela participante ao longo do ano e o subtrai do total bruto. Zero não é descartado.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Bonificação de Presença Total</h2>
          <p>
            +20 pontos para quem comparecer a todas as {tournament?.totalRounds} etapas. Aplicada apenas na classificação final.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Penalidade de Uniforme</h2>
          <p>
            -20 pontos na classificação geral se comparecer sem o uniforme oficial
            (camisa do grupo + short/saia branca + meias brancas).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Critérios de Desempate</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>Maior número de 1ºs lugares no ano</li>
            <li>Saldo de sets (vencidos - perdidos)</li>
            <li>Saldo de games (vencidos - perdidos)</li>
            <li>Total de sets vencidos</li>
            <li>Total de games vencidos</li>
            <li>Sorteio</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Número Ímpar de Participantes</h2>
          <p>
            Se o grupo feminino tiver número ímpar de presentes, uma participante fica de fora do sorteio:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><b>1ª etapa:</b> Pergunta-se se alguém quer ficar fora voluntariamente (60 pts). Se ninguém aceitar, sorteia-se entre todas (80 pts).</li>
            <li><b>2ª a 8ª etapa:</b> Divide-se o grupo em duas metades pela classificação. O sorteio ocorre entre a metade inferior (80 pts).</li>
            <li><b>9ª etapa:</b> Sorteio apenas entre as 5 últimas colocadas (80 pts).</li>
          </ul>
          <p className="mt-2 text-sm text-neutral-500">
            Participante sorteada uma vez não pode ser sorteada novamente no ano.
          </p>
        </section>
      </div>
    </div>
  );
}
