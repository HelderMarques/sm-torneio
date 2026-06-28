# Ranking por Aproveitamento — Design

**Data:** 2026-05-17
**Escopo:** F e M, público (sem auth), torneio 2026 (e qualquer torneio futuro)

## Objetivo

Adicionar visão alternativa de ranking baseada em **% de aproveitamento** em 3 dimensões — partidas, sets e games — complementar à pontuação atual (que continua sendo a métrica oficial). Aparece em 2 lugares:

1. **Classificação:** toggle "Pontuação | Aproveitamento" no topo.
2. **Página da atleta:** 3 mini-rankings (Partidas / Sets / Games), cada um mostrando 5 linhas em torno da atleta (2 acima + atleta + 2 abaixo, com slide nas bordas).

## Decisões aprovadas

1. **Pontuação continua sendo o modo default.** Aproveitamento é toggle, não substitui.
2. **F e M.** Sem feature flag, sem gating temporal.
3. **Layout Classificação:** tabela única com 3 colunas de % (Partidas / Sets / Games). Sort default por Partidas %; clicar no header de outra coluna reordena.
4. **Mini-ranking na página da atleta:** janela de 5 linhas simétrica 2/2, com **slide nas bordas** (1º → ela + 4 abaixo; penúltima → 3 acima + ela + 1 abaixo).

## Arquitetura

### Backend

**Serviço novo:** `backend/src/services/aproveitamentoService.js`
- Exporta `computeAproveitamento(group, tournamentId)`.
- Retorna `{ partidas, sets, games }`, cada array `[{ participantId, name, played?|won, lost?|played, won, rate, position }]`.

**Cálculos:**

| Dimensão | Fórmula | Origem |
|---|---|---|
| Partidas | `won / played` | `MatchResult` cruzado com `RoundResult.pairId` para mapear atleta → dupla. Match conta como jogada se a atleta estava em pairA ou pairB; vencida se score da sua dupla foi maior. Considera apenas rounds `COMPLETED`. |
| Sets | `Σ setsWon / Σ (setsWon + setsLost)` | `RoundResult` com `round.status='COMPLETED'` |
| Games | `Σ gamesWon / Σ (gamesWon + gamesLost)` | idem |

**Ordenação:** `rate` desc; tiebreaker = total absoluto de vitórias desc (alguém com 100% em 1 jogo não passa alguém com 95% em 20). Atletas com `rate=null` (denominador 0) vão ao final, ordenadas alfabeticamente. `position` = 1-indexed.

**Rota nova:** `backend/src/routes/aproveitamento.js`
- `GET /api/tournaments/:slug/aproveitamento?group=F` — sem auth, público.
- Registrar em `index.js` no bloco tournament-scoped (junto com `simulacao`, `standings`).

### Frontend

**Hook:** `frontend/src/hooks/useAproveitamento.js`
- `useAproveitamento(group) → { data, loading, error }` chamando o endpoint.

**Classificação (`pages/Classificacao.jsx`):**
- Toggle "Pontuação | Aproveitamento" no header, ao lado das tabs F/M.
- Estado local `mode` (sem persistência entre sessões — sempre abre em Pontuação).
- Em modo `aproveitamento`: troca `<StandingsTable>` por `<AproveitamentoTable group={groupKey} />`.

**Componente:** `frontend/src/components/AproveitamentoTable.jsx`
- Colunas: `Pos | Atleta | Partidas % | Sets % | Games %`.
- Cada % renderizada como `XX%` com tooltip `(won/total)` ao hover. Mobile: scroll horizontal ou colunas compactas.
- Header de coluna clicável → reordena por aquela métrica (estado interno). Seta `▼` indica coluna ativa.
- Atletas com `rate=null` mostram `—`.

**Página da atleta (`pages/Participante.jsx`):**
- Nova seção "Aproveitamento" abaixo das stats existentes (a narrativa client-side antiga em Participante.jsx é orgonal — mantém).
- Renderiza `<AproveitamentoMini participantId={id} group={groupKey} />`.

**Componente:** `frontend/src/components/AproveitamentoMini.jsx`
- 3 cards em grid responsivo (3 colunas desktop, empilhados mobile).
- Cada card:
  - Header: nome da métrica + posição da atleta (ex: "🎾 Partidas — 5º lugar").
  - % grande em destaque (ex: `73%`) + denominador pequeno (ex: `(11 de 15)`).
  - Mini-tabela de 5 linhas com Pos | Nome | %; linha da atleta destacada em rose-50.
- **Janela:**
  ```
  start = max(0, position - 1 - 2)        // tenta começar 2 acima
  end = min(total, start + 5)
  if end - start < 5: start = max(0, end - 5)  // ajusta na borda inferior
  ```
- Se `rate=null` para essa atleta nessa métrica: card mostra "Sem dados".
- Se o grupo tem `<5` atletas: mostra todas, atleta destacada.

### Schema

Sem mudança. `RoundResult` e `MatchResult` já contêm tudo.

## Validações / casos

| Caso | Tratamento |
|---|---|
| Atleta sem partidas (denominador=0) | `rate=null`; tabela mostra `—`; card mostra "Sem dados" |
| Round sem MatchResult (importado via `/results` em vez de `/court-results`) | Atleta não contribui pra Partidas %, mas Sets/Games ainda contam |
| Atleta `active=false` | Não aparece em nenhum ranking |
| Grupo vazio | `{ partidas: [], sets: [], games: [] }` |
| Erro do servidor | Frontend mostra "Erro ao carregar aproveitamento" sem quebrar a página |

## Verificação pós-implementação

1. `curl /api/tournaments/2026/aproveitamento?group=F` retorna estrutura esperada.
2. Spot-check manual: para Natalia, posições em Sets/Games batem com agregados de `RoundResult` no banco.
3. Toggle Pontuação ↔ Aproveitamento na Classificação não reloada a página, sort por coluna funciona.
4. Página da Natalia (1ª em pontos): mini-ranking de Partidas mostra ela + 4 abaixo (slide na borda).
5. Página da Valéria (1 participação só): cards de Sets/Games preenchem; Partidas pode ser `—` se nenhum match foi gravado.
6. Smoke test novo `APR-1`: GET 200 com estrutura correta.

## Fora de escopo

- Gráfico histórico de aproveitamento ao longo do tempo.
- Aproveitamento por dupla (parceria).
- Filtros por período.
- Cache server-side / view materializada (dataset pequeno; recalcular per GET é OK).
- Persistir modo escolhido (Pontuação/Aproveitamento) entre sessões.
