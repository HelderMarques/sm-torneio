# Simulação de Etapa — Feminino (Design)

**Data:** 2026-05-10
**Escopo:** público (sem auth), grupo F apenas (MVP), torneio 2026
**Objetivo:** durante o dia da etapa, atletas montam um "what-if" das duplas + colocações e veem como o ranking geral mudaria, com insight personalizado gerado por LLM.

## Visão geral

A atleta abre a Classificação do Feminino no celular, clica em "🎯 Simular Etapa", indica quem é ela, marca quem faltou / foi sorteado, monta as duplas, escolhe a colocação de cada dupla na etapa e vê: (1) sua nova posição no ranking com delta destacado, (2) a tabela completa simulada, (3) um insight textual de 2-3 frases em segunda pessoa gerado por LLM.

O acesso é **time-gated**: só funciona no dia de uma etapa F, entre 7h e 19h America/Sao_Paulo.

## Decisões aprovadas

1. **Substituir a feature existente:** deletar `SimularEtapa.jsx` antiga, remover link na Home, e reaproveitar a rota `/t/:slug/simular` para a nova página F-only. Estruturar para escalar para M depois.
2. **Insight via LLM real:** Anthropic Claude Haiku 4.5, server-side, com prompt caching.
3. **Layout:** tela única scrollável com 3 seções (Quem é você / Ausências / Duplas → Simular).
4. **Personalização:** seletor "Quem é você?" no topo; tudo destaca a viewer (card da dupla dela, delta dela em destaque, insight escrito para ela em segunda pessoa).
5. **Acesso:** botão visível só na Classificação Feminino, dentro da janela 7h-19h do dia de uma etapa F.
6. **Persistência local:** `sessionStorage` com chave `simulacao-{etapaId}` (forma + último resultado). Botão "Nova simulação" reseta. Hash do input detecta mudanças para evitar refazer chamada à LLM.
7. **LLM não fala de sets/games:** input à LLM é apenas posição/ranking/pontos.

## Gating (camadas)

1. **Master switch (admin):** mantém o flag `Tournament.simulateEnabled` no schema, re-significado como kill switch.
2. **Grupo:** F apenas no MVP (chamada GET availability aceita `group` param para o futuro).
3. **Janela temporal:** dia de uma etapa F (`Round` com `group=F` e `date=hoje`) AND horário 7h-19h America/Sao_Paulo.
4. **Endpoint de availability:** `GET /api/tournaments/:slug/simulacao/availability?group=F` retorna `{ available: bool, reason: string, etapa: { id, number, date } | null }`. Frontend chama no mount; backend revalida na rota de simulação.

## Arquitetura

### Backend (`/backend/src/`)

**Novo arquivo `routes/simulacao.js`** (tournament-scoped, montado em `/api/tournaments/:slug/simulacao`):

- `GET /availability?group=F` — sem auth. Retorna janela ativa + etapa do dia. Lógica:
  - Buscar round com `group=F`, `tournamentId=req.tournament.id`, `date=YYYY-MM-DD de hoje em SP`.
  - Se não há round hoje → `{ available: false, reason: 'sem_etapa_hoje' }`.
  - Se há mas status COMPLETED → `{ available: false, reason: 'etapa_concluida', etapa }`.
  - Se há e horário SP fora de [7h, 19h) → `{ available: false, reason: 'fora_da_janela', etapa }`.
  - Se `tournament.simulateEnabled === false` → `{ available: false, reason: 'desativado' }`.
  - Caso contrário → `{ available: true, etapa }`.

- `POST /simular` — sem auth. Body:
  ```json
  {
    "viewerParticipantId": "uuid",
    "group": "F",
    "absentees": [{ "participantId": "uuid", "reason": "FALTA" | "SORTEIO" | "SORTEIO_VOLUNTARIA" }],
    "duplas": [{ "playerAId": "uuid", "playerBId": "uuid", "position": 1 }]
  }
  ```
  - Revalida janela; se não ativo, retorna 403.
  - Expande `duplas` + `absentees` para o formato esperado pelo `simulateStandings()` existente: 1 entrada por participante (jogador presente herda a `position` da dupla; ausentes recebem `position: null` e `absentReason` apropriado).
  - **Sets/games no input à `simulateStandings()`:** zerados (`setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0`). Como a simulação é só de posições, não há dados de jogos individuais. Isso impacta tiebreaker em casos de empate — aceito como limitação do MVP.
  - Chama `simulateStandings('F', tournamentId, simulatedResults)` que retorna o ranking simulado com `oldPosition`, `newPosition`, `positionDelta` para todos.
  - Chama `insightService.generateInsight(...)` para a viewer.
  - Retorna `{ standings, insight, viewer: { oldPosition, newPosition, delta, newPoints, oldPoints, duplaPartner, duplaPosition } }`.

**Novo serviço `services/insightService.js`:**

- Função `generateInsight({ viewer, simulatedStandings, etapa })`:
  - Constrói input para LLM (ver seção LLM abaixo).
  - Chama Anthropic API; usa prompt caching no system prompt.
  - Retorna `{ text: string | null }`. Em caso de erro/falta de API key: log + `null`.
  - Timeout de 8s.

- Lib: `@anthropic-ai/sdk`.
- Env: `ANTHROPIC_API_KEY`.

**Reuso:**
- `simulateStandings()` em `services/standingsService.js` — usado como está.
- Algoritmo de tiebreaker no `getStandings()` — herdado.

**index.js:** registrar `app.use('/api/tournaments/:tournamentSlug/simulacao', tournamentMiddleware, simulacaoRoutes);` antes das rotas mais genéricas.

**Schema:** sem alteração. `simulateEnabled` continua existindo.

**Limpeza:**
- **Manter** endpoint antigo `POST /standings/simulate` (linhas 115-133 de `routes/standings.js`) — confirmei via grep que `EtapaInput.jsx` (admin) usa em `step preview-standings` (linha 780). Removê-lo quebraria o fluxo admin de revisão antes de salvar resultados reais.
- O novo endpoint `POST /tournaments/:slug/simulacao/simular` é específico para o uso público (com gating temporal e LLM); o antigo continua servindo o admin.

### Frontend (`/frontend/src/`)

**Nova página `pages/SimularEtapa.jsx`** (substitui a antiga). Rota `/t/:slug/simular`.

- Componentes internos (mesma arquivo ou splits pequenos no mesmo diretório):
  - `<ViewerSelector>` — select de atletas F ativas. Persistido em sessionStorage.
  - `<AusenciasSection>` — checkboxes por atleta com status (FALTA/SORTEIO/SORTEIO_VOLUNTARIA). Pessoas marcadas saem do pool de duplas.
  - `<DuplasSection>` — lista dinâmica de duplas. Para cada: 2 selects de jogadora (filtradas) + 1 select de posição. Botão "Adicionar dupla". Validação inline: **posição única por dupla** (Etapa F tem 1 quadra com 5 duplas → posições 1-5 distintas, sem repetição), mínimo 2 duplas para simular.
  - `<SimularButton>` — chama `POST /simulacao/simular`. Desabilitado se validação falhar.
  - `<SimulationResultView>` — destaca o card da viewer no topo (delta animado, nova posição, pontos novos vs antigos), texto do insight em card próprio, tabela completa abaixo com indicadores ↑/↓ e cor da linha da viewer destacada.
  - `<NovaSimulacaoButton>` — limpa sessionStorage e form.

- Estado: 1 reducer/contexto local, persistência em `sessionStorage` com chave `simulacao-{etapaId}`. Restaura no mount se houver dados válidos para a etapa atual.

**Hook `hooks/useSimulationAvailability.js`** — chama `GET /simulacao/availability?group=F`, retorna `{ available, reason, etapa, loading }`.

**Componente `<SimulacaoButton group="F" />`** — renderiza só se `available === true`. Inserido na Classificação F.

**Página de Classificação:** localizar onde o card F é renderizado e injetar o `<SimulacaoButton>`. Sem mudanças estruturais.

**Limpeza no frontend:**
- Deletar conteúdo antigo de `pages/SimularEtapa.jsx` (substituído inteiramente).
- Remover botão "Simular Etapa" em `pages/Home.jsx` linhas 103-108.
- Rota mantida.

## LLM — prompt, modelo, restrições

**Modelo:** Claude Haiku 4.5 (preço, latência). Latência típica 1-2s. Custo ~$0.001/simulação.

**System prompt (cacheado):**
- Define papel: assistente de torneio recreativo de tênis em duplas, tom empolgado mas natural, português BR, segunda pessoa, 2-3 frases.
- Regras do torneio (resumo): formato em duplas com double-loss, pontuação por posição (1º=100, 2º=80, 3º=70, 4º=60, 5º=50, 6º=40), sorteio = 80 pts, sorteio voluntário = 60 pts, falta = 0.
- **Restrição explícita:** "NÃO mencione número de sets, games, placares ou saldos. A simulação não tem dados de jogos individuais — apenas posição final das duplas. Foque em posições, pontos, distâncias no ranking e dinâmica de quem ultrapassou quem."

**User prompt (por chamada):**
```
Atleta: {nome}
Posição atual no ranking: {oldPosition}º ({oldPoints} pts)
Resultado simulado: {position label, ex: CAMPEÃ} jogando com {parceira}
Nova posição no ranking: {newPosition}º ({newPoints} pts) — delta {+/-N}
Ultrapassou: {lista de nomes}  // ou: Foi ultrapassada por: {nomes}
Top 3 simulado: 1º {nome} ({pts}), 2º {nome} ({pts}), 3º {nome} ({pts})
Gap até o 3º lugar: {pts} pts
```

**Output esperado:** 2-3 frases em texto puro (sem markdown), tom motivacional/realista, sem emoji exagerado.

**Exemplos:**
- "Você subiria 3 posições! Esse resultado te bota na frente da Mariana e da Letícia. Com a Natalia ainda muito à frente, o pódio agora depende de uma boa colocação nas próximas etapas."
- "A posição se manteria, mas você passaria a fechar a etapa com 130 pontos — só 20 atrás da Núbia. Próxima etapa decide muita coisa pra você."
- "Mesmo com o sorteio, a queda foi pequena: só uma posição. Ainda no top 5 e bem perto da quarta posição."

**Erro/fallback:** `insight: null` → frontend mostra resultado sem texto, sem bloquear UX.

## Persistência local (sessionStorage)

**Chave:** `simulacao-{etapaId}`
**Conteúdo:** `{ form: { viewerId, absentees, duplas }, result: { standings, insight, viewer } | null, inputHash: string }`

**Comportamento:**
- Mount: lê sessionStorage; se existe e `etapaId` bate com a etapa do dia → restaura.
- Submit "Simular": calcula `inputHash` do form atual; se igual ao salvo e `result` existe → renderiza cache sem chamar API. Senão → chama API e atualiza storage.
- "Nova simulação": `sessionStorage.removeItem` + reset state.
- Quando outra etapa começa (diferente `etapaId`), o cache antigo fica ignorado e é sobrescrito naturalmente.

## Validações / casos de erro

| Caso | Tratamento |
|------|------------|
| Janela fechada (fora de 7h-19h) | Botão não aparece na Classificação; rota direta `/simular` mostra mensagem "Simulação disponível apenas no dia da etapa, entre 7h e 19h." |
| Atleta inexistente em `viewerParticipantId` | API retorna 400 |
| Dupla com mesmo jogador 2x | Validação client + server |
| Mesma atleta em 2 duplas | Validação client + server |
| Mesma atleta nas duplas e em ausências | Validação client + server |
| Posição duplicada (2 duplas em 3º lugar) | Validação client; aviso "cada posição só pode ter uma dupla" |
| API LLM indisponível | Retorna `insight: null`; UX continua |
| Sem rounds F hoje | Availability retorna `{available: false}`; botão escondido |

## Limpeza explícita (deletar)

| Item | Path | Motivo |
|------|------|--------|
| Conteúdo antigo de `SimularEtapa.jsx` | `frontend/src/pages/SimularEtapa.jsx` | Substituído pela nova versão F-only |
| Botão "Simular Etapa" no Home | `frontend/src/pages/Home.jsx` linhas 103-108 | Acesso agora pela Classificação |

**Não deletar:** `POST /standings/simulate` é usado pelo admin (`EtapaInput.jsx` linha 780) para preview antes de salvar resultado real. Continua existindo.

## Variáveis de ambiente (Railway)

- **Nova:** `ANTHROPIC_API_KEY` — sem valor default; sem ela, feature funciona sem insight.

## Primeiro setup (após deploy)

1. Admin acessa o Dashboard do torneio 2026.
2. Liga o toggle "Simular etapa" (que agora controla a nova feature F).
3. Se `ANTHROPIC_API_KEY` não estiver configurada no Railway, configurar antes — senão, simulação funciona mas sem insight.
4. Testar acessando `/t/2026` no dia de uma etapa F entre 7h-19h.

## Verificação pós-implementação

1. `GET /api/tournaments/2026/simulacao/availability?group=F` retorna `available:false` hoje (10/05/2026), pois não é dia de etapa F (próxima é 17/05).
2. Em 17/05/2026 às 10h (manualmente testável mudando relógio ou criando round de teste), retorna `available:true`.
3. POST /simular com dados válidos retorna standings simulados + insight de texto não vazio.
4. POST /simular com API key inválida retorna standings + `insight: null`.
5. UI: na Classificação F, botão aparece só no dia da etapa.
6. Form persiste em sessionStorage; reload preserva tudo; "Nova simulação" zera; trocar de aba e voltar preserva.

## Fora de escopo (não fazer agora)

- Simulação para grupo M (deixar a base preparada, mas só ativar quando solicitado).
- Persistência server-side de simulações (cada simulação é ephemeral).
- Histórico de simulações da própria atleta.
- Compartilhamento de simulação por link.
- Notificação push quando a etapa terminar com o resultado real comparado.
