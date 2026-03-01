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
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-200">
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Nome</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Pts</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Ganhos</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Perd.</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Desc.</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Bônus</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Part.</th>
            {showDetails && (
              <>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">1º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">2º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">3º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">4º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">5º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">6º</th>
                <th className="px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">7º</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">SV</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">SP</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">SS</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">GV</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">GP</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">SG</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((s, idx) => (
            <tr
              key={s.participantId}
              className={`border-b border-neutral-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
            >
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base ${positionBadge(s.position)}`} title={`${s.position}º lugar`}>
                  {POSITION_EMOJI[s.position] ?? s.position}
                </span>
              </td>
              <td className="px-4 py-3 font-medium">
                <Link
                  to={`/t/${slug}/participante/${s.participantId}`}
                  className="text-neutral-900 hover:text-[#9B2D3E]"
                >
                  {s.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-neutral-900">
                {s.pointsValid}
              </td>
              <td className="px-4 py-3 text-center text-neutral-600">{s.pointsRaw}</td>
              <td className="px-4 py-3 text-center text-red-600/90">{s.pointsPenalty > 0 ? `-${s.pointsPenalty}` : '0'}</td>
              <td className="px-4 py-3 text-center text-neutral-500">{s.pointsDiscard > 0 ? `-${s.pointsDiscard}` : '-'}</td>
              <td className="px-4 py-3 text-center text-emerald-600/90">{s.pointsBonus > 0 ? `+${s.pointsBonus}` : '-'}</td>
              <td className="px-4 py-3 text-center text-neutral-600">{s.roundsPlayed}</td>
              {showDetails && (
                <>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.firstPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.secondPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.thirdPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.fourthPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.fifthPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.sixthPlaces || '-'}</td>
                  <td className="px-2 py-3 text-center text-neutral-600">{s.seventhPlaces || '-'}</td>
                  <td className="px-3 py-3 text-center text-neutral-600">{s.setsWon}</td>
                  <td className="px-3 py-3 text-center text-neutral-600">{s.setsLost}</td>
                  <td className="px-3 py-3 text-center font-medium text-neutral-700">{s.saldoSets}</td>
                  <td className="px-3 py-3 text-center text-neutral-600">{s.gamesWon}</td>
                  <td className="px-3 py-3 text-center text-neutral-600">{s.gamesLost}</td>
                  <td className="px-3 py-3 text-center font-medium text-neutral-700">{s.saldoGames}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
