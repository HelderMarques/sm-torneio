const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 300;
const TIMEOUT_MS = 8000;

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `Você é um assistente do Torneio Recreativo Secos & Molhados (Tijuca Tênis Clube), formato em duplas com double-loss. Pontuação por posição na etapa: 1º=100, 2º=80, 3º=70, 4º=60, 5º=50, 6º=40. Sorteio (sit-out): 80 pts. Sorteio voluntário: 60 pts. Falta: 0.

Você recebe o resultado SIMULADO de uma etapa do ponto de vista de uma atleta específica (a "viewer"). Gere um insight em 2-3 frases curtas, em português brasileiro, segunda pessoa ("você"), tom empolgado mas natural. SEM emojis. SEM markdown.

REGRAS:
- NÃO mencione número de sets, games, placares ou saldos. A simulação não tem dados de jogos individuais — apenas posição final das duplas.
- Foque em: variação de posição no ranking geral, pontos, distâncias para vizinhos no ranking, e dinâmica de quem ultrapassou quem.
- Seja específico: use nomes de outras atletas quando relevante (ex: "passaria à frente da Mariana").
- Se a posição não mudou, comente os pontos absolutos e o gap para a próxima posição.`;

function buildUserPrompt({ viewer, simulatedStandings }) {
  const top3 = simulatedStandings.slice(0, 3).map((s, i) => `${i + 1}º ${s.name} (${s.pointsValid} pts)`).join(', ');

  // Quem ultrapassou ou foi ultrapassada
  let movement = '';
  if (viewer.delta > 0) {
    // Subiu — quem ficou pra trás
    const passados = simulatedStandings
      .filter((s) => s.oldPosition < viewer.oldPosition && s.position > viewer.newPosition)
      .map((s) => s.name);
    movement = passados.length ? `Ultrapassou: ${passados.join(', ')}` : 'Subiu sem ultrapassar nome específico.';
  } else if (viewer.delta < 0) {
    const passou = simulatedStandings
      .filter((s) => s.oldPosition > viewer.oldPosition && s.position < viewer.newPosition)
      .map((s) => s.name);
    movement = passou.length ? `Foi ultrapassada por: ${passou.join(', ')}` : 'Caiu sem alguém específico ultrapassar.';
  } else {
    movement = 'Posição mantida.';
  }

  // Gap até o pódio
  const podio = simulatedStandings.find((s) => s.position === 3);
  const gapPodio = podio && viewer.newPosition > 3 ? `Gap até o 3º lugar: ${podio.pointsValid - viewer.newPoints} pts.` : '';

  return `Atleta: ${viewer.name}
Posição anterior: ${viewer.oldPosition}º (${viewer.oldPoints} pts)
Nova posição simulada: ${viewer.newPosition}º (${viewer.newPoints} pts)
Delta: ${viewer.delta > 0 ? '+' : ''}${viewer.delta}
${movement}
Top 3 simulado: ${top3}
${gapPodio}`.trim();
}

async function generateInsight({ viewer, simulatedStandings }) {
  const c = getClient();
  if (!c) {
    console.warn('[insightService] ANTHROPIC_API_KEY não configurada — retornando insight null');
    return null;
  }
  try {
    const userPrompt = buildUserPrompt({ viewer, simulatedStandings });
    // Defensive timeout via Promise.race (in case SDK signal isn't honored)
    const sdkCall = c.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`insight timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    );
    const resp = await Promise.race([sdkCall, timeoutPromise]);
    const text = resp.content?.[0]?.type === 'text' ? resp.content[0].text.trim() : null;
    return text || null;
  } catch (err) {
    console.error('[insightService] Erro ao gerar insight:', err.message);
    return null;
  }
}

module.exports = { generateInsight };
