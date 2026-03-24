import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

const POSITION_EMOJI = { 1: '🥇', 2: '🥈', 3: '🥉' };

function positionBadge(pos) {
  if (pos === 1) return 'bg-red-50 text-[#9B2D3E]';
  if (pos === 2) return 'bg-neutral-100 text-neutral-600';
  if (pos === 3) return 'bg-[#F5EDE0] text-[#B8860B]';
  if (pos === 4) return 'bg-neutral-100 text-neutral-600';
  return 'bg-neutral-50 text-neutral-500';
}

export default function StandingsTable({ standings, showDetails = true }) {
  const { slug } = useTournament();

  if (!standings || standings.length === 0) {
    return (
      <div className="text-center py-10 text-neutral-500 text-sm">
        Nenhum resultado registrado ainda.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-neutral-50">
            <th className="sticky left-0 z-20 w-14 bg-neutral-50 px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">#</th>
            <th className="sticky left-14 z-20 bg-neutral-50 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-r border-neutral-200">Nome</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">Pts</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">Ganhos</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">Perd.</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">Desc.</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">Bônus</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">Part.</th>
            {showDetails && (
              <>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">1º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">2º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">3º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">4º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">5º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">6º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">7º</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">SV</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">SP</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">SS</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">GV</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">GP</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">SG</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => {
            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
            return (
            <tr
              key={s.participantId}
              className={rowBg}
            >
              <td className={`sticky left-0 z-10 w-14 px-2 py-3 text-center border-b border-neutral-100 ${rowBg}`}>
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base ${positionBadge(s.position)}`} title={`${s.position}º lugar`}>
                  {POSITION_EMOJI[s.position] ?? s.position}
                </span>
              </td>
              <td className={`sticky left-14 z-10 px-4 py-3 font-medium border-b border-r border-neutral-100 border-r-neutral-200 ${rowBg}`}>
                <Link
                  to={`/t/${slug}/participante/${s.participantId}`}
                  className="text-neutral-900 hover:text-[#9B2D3E]"
                >
                  {s.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-neutral-900 border-b border-neutral-100">
                {s.pointsValid}
              </td>
              <td className="px-4 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.pointsRaw}</td>
              <td className="px-4 py-3 text-center text-red-600/90 border-b border-neutral-100">{s.pointsPenalty > 0 ? `-${s.pointsPenalty}` : '0'}</td>
              <td className="px-4 py-3 text-center text-neutral-500 border-b border-neutral-100">{s.pointsDiscard > 0 ? `-${s.pointsDiscard}` : '-'}</td>
              <td className="px-4 py-3 text-center text-emerald-600/90 border-b border-neutral-100">{s.pointsBonus > 0 ? `+${s.pointsBonus}` : '-'}</td>
              <td className="px-4 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.roundsPlayed}</td>
              {showDetails && (
                <>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.firstPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.secondPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.thirdPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.fourthPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.fifthPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.sixthPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.seventhPlaces || '-'}</td>
                  <td className="px-3 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.setsWon}</td>
                  <td className="px-3 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.setsLost}</td>
                  <td className="px-3 py-3 text-center font-medium text-neutral-700 border-b border-neutral-100">{s.saldoSets}</td>
                  <td className="px-3 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.gamesWon}</td>
                  <td className="px-3 py-3 text-center text-neutral-600 border-b border-neutral-100">{s.gamesLost}</td>
                  <td className="px-3 py-3 text-center font-medium text-neutral-700 border-b border-neutral-100">{s.saldoGames}</td>
                </>
              )}
            </tr>
          );})}
        </tbody>
      </table>
      {showDetails && (
        <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-xs text-neutral-400 flex flex-wrap gap-x-4 gap-y-1">
          <span><strong className="text-neutral-500">PTS</strong> Pontuação válida</span>
          <span><strong className="text-neutral-500">Ganhos</strong> Pontuação bruta</span>
          <span><strong className="text-neutral-500">Perd.</strong> Penalidade de uniforme</span>
          <span><strong className="text-neutral-500">Desc.</strong> Descarte</span>
          <span><strong className="text-neutral-500">Part.</strong> Partidas realizadas</span>
          <span><strong className="text-neutral-500">1º–7º</strong> Colocações por etapa</span>
          <span><strong className="text-neutral-500">SV</strong> Sets Vencidos</span>
          <span><strong className="text-neutral-500">SP</strong> Sets Perdidos</span>
          <span><strong className="text-neutral-500">SS</strong> Saldo de Sets</span>
          <span><strong className="text-neutral-500">GV</strong> Games Vencidos</span>
          <span><strong className="text-neutral-500">GP</strong> Games Perdidos</span>
          <span><strong className="text-neutral-500">SG</strong> Saldo de Games</span>
        </div>
      )}
    </div>
  );
}
