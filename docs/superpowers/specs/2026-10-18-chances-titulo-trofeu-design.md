# Chances de Título e Troféu — Design

**Data:** 2026-10-18
**Escopo:** F e M, público (sem auth), torneio 2026 (e qualquer torneio futuro)

## Objetivo

Responder, para cada atleta, duas perguntas ao longo da temporada:

1. **Ainda posso ser campeã (1º)?**
2. **Ainda posso ganhar troféu?** (entrar nas posições premiadas do grupo)

Para cada uma: um **status determinístico** (provado pelo regulamento) + uma **probabilidade estimada** (Monte Carlo, rotulada como estimativa) + **o que precisa acontecer**.

Motivação: pergunta real de uma atleta ("ainda tenho chance de terminar em 1º?"). Hoje (18/10/2026) o 2026 está com 8 etapas concluídas e **1 restante** — o título está em jogo na última etapa.

## Decisões aprovadas

1. **Determinístico + probabilidade estimada juntos.** O determinístico é a fonte de confiança; a % é sempre rotulada "estimativa".
2. **Dois objetivos:** título (1º) e troféu (top N premiado do grupo).
3. **Posições premiadas vêm da config** (`trophy_positions_feminino = 4`, `trophy_positions_masculino = 6`), não fixadas no código. **Troféu sênior fora da v1.**
4. **Números e status calculados 100% no backend** a partir do regulamento (reusando o motor de pontuação). A IA só **redige** os fatos já calculados, proibida de alterar números.
5. **Modelo de probabilidade uniforme** (chances iguais de colocação), Monte Carlo.
6. **Dois lugares:** selo compacto na Classificação + seção detalhada na página da atleta.

## Regras do regulamento relevantes (fonte da verdade)

Lidas de settings (não hardcode):

| Regra | Valor (2026) | Efeito no cálculo |
|---|---|---|
| Pontos por colocação | 1º=100, 2º=80, 3º=70, 4º=60, 5º=50, 6º=40, 7º=30 | Teto por etapa = 100 |
| Sorteada / Voluntária | 80 / 60 | Casos de ausência pontuada |
| Descarte | a partir da 5ª etapa | Remove 1 menor pontuação **positiva** do ano |
| Bonificação presença total | +20 | Só se presente em **todas** as `totalRounds` etapas; aplicada no fechamento |
| Penalidade uniforme | −20 | Ignorada na projeção (assume-se que ninguém leva −20) |
| Posições premiadas | F=4, M=6 | Define "top N" do objetivo troféu |
| Desempate | 1ºs lugares → saldo sets → saldo games → … | Fronteiras tratadas como "depende de desempate" |

**Nuance crítica:** descarte e bônus dependem de `completedCount`. A pontuação **final** (que decide campeão/troféu) é calculada com `completedCount = totalRounds`, o que ativa o bônus de +20 para quem tem presença total. A classificação atual exibida usa `completedCount = 8`, então **ainda não** contém o bônus. Na última etapa, **vencer pode valer +120** (100 da vitória + 20 do bônus) para quem tem presença total. Por isso o cálculo precisa reusar o motor de pontuação real, não aproximar.

## Arquitetura

### Backend

**Serviço novo:** `backend/src/services/chancesTituloService.js`
- Exporta `computeChances(group, tournamentId)`.
- Reusa `standingsService` (`getPointsForResult` e a lógica de descarte/bônus) como fonte da verdade do score final.

**Dados de entrada:**
- `totalRounds` (N), etapas COMPLETED (C), restantes `R = N − C`.
- Settings: tabela de pontos, `discard_starts_after_round`, `bonus_full_attendance`, `trophy_positions_<grupo>`.
- Por atleta ativa: resultados das etapas COMPLETED (position/present/absentReason/uniformPenalty) e presença (para elegibilidade de bônus).
- Classificação atual (`getStandings`) para pontos e posição correntes.

#### Pontuação projetada (piso e teto por atleta)

Função auxiliar `finalPoints(scoresDoAno, presencaCompleta, penaltyExistente)` que aplica a regra final com `completedCount = N`:
`raw − descarte(min positivo entre os N) + bônus(+20 se presença total) − penalty`.

- **Teto (ceil) da atleta A** = melhor caso: A joga e **vence** (100) todas as R restantes; presente em todas (bônus se também presente nas C já jogadas). `ceil_A = finalPoints(scoresA + [100]*R, presençaTotalPossível, penaltyA)`.
- **Piso (floor) da atleta B** = pior caso: B **ausente** (0) nas R restantes (perde elegibilidade de bônus). Adicionar zeros não muda o descarte (0 não é positivo) nem reduz o raw. Resultado: `floor_B = pontosValidosAtuais_B`. (Ignora auto-sabotagem de comparecer sem uniforme.)

#### Status determinístico (por atleta A)

Sejam `others` as demais atletas ativas.

- **Título:**
  - `garantido` se `|{ j : ceil_j > floor_A }| == 0` (ninguém pode passar A nem no melhor caso deles) → A já é campeã matemática.
  - `vivo` se não garantido e `ceil_A > max_j floor_j` (no melhor caso de A, ela passa o piso de todas).
  - `depende_desempate` se `ceil_A == max_j floor_j` (fronteira).
  - `fora` caso contrário.
- **Troféu (top K, K = trophy_positions):**
  - `garantido` se `|{ j : ceil_j > floor_A }| < K` (menos de K podem superar A → A não cai do top K).
  - `vivo` se não garantido e `|{ j : floor_j > ceil_A }| < K` (menos de K estão garantidamente acima de A → A ainda alcança o top K).
  - `fora` se `|{ j : floor_j > ceil_A }| >= K`.
  - Fronteiras (`==`) → `depende_desempate`.

#### "O que precisa acontecer" (condições, por template)

Para atletas com título `vivo` (e não líder), calcular os fatos:
- `gap = pontosLíder − pontosA`.
- Resultado necessário de A (em geral: vencer as R restantes) → ponto final projetado de A.
- Restrição sobre os rivais acima: "pontuar no máximo X" → traduzido para colocação ("terminar em Yº ou pior").

Montar 1–2 frases de template a partir desses fatos. Ex. (R=1):
> "Você tem 260 pts. Vencendo a última etapa chega a 360 (com o bônus de presença). Para ser campeã, a Giovana (340) precisa terminar em 5º ou pior."

Para troféu `vivo` (atleta fora do top K): condição análoga em relação ao atleta na posição K.
Para `garantido`: "Troféu/título já garantido." Para `fora`: "Sem chance matemática de troféu nesta temporada."

#### Probabilidade (Monte Carlo uniforme — estimativa)

- `M` simulações (ex.: 20.000).
- Em cada simulação, para cada etapa restante: cada atleta ativa **presente** sorteia pontos **uniformemente** do conjunto da tabela `{100,80,70,60,50,40,30}`, de forma independente. (Premissa declarada: "chances iguais de qualquer colocação"; não impõe unicidade de posição — é uma estimativa.)
- Recalcular o score final (descarte+bônus) de todas, ranquear, registrar quem é 1º e quem está no top K.
- Desempate dentro da simulação: por `pointsValid` e, em empate, pelos critérios existentes que temos agregados (1ºs lugares etc.), aleatório como último recurso.
- `probTitulo_A = #(A é 1º)/M`; `probTrofeu_A = #(A no top K)/M`.

Nota: com R pequeno (1) converge rápido; enumeração exata é possível no futuro. Dataset pequeno → recalcular por GET é aceitável.

**Rota nova:** `backend/src/routes/chances.js`
- `GET /api/tournaments/:slug/chances?group=F` — sem auth, público.
- Registrar em `index.js` no bloco tournament-scoped.

**Resposta:**
```json
{
  "group": "F",
  "totalRounds": 9,
  "remaining": 1,
  "trophyPositions": 4,
  "athletes": [
    {
      "participantId": "…",
      "name": "Natalia",
      "currentPosition": 3,
      "currentPoints": 260,
      "maxPoints": 380,
      "titulo": "vivo",
      "trofeu": "garantido",
      "probTitulo": 0.14,
      "probTrofeu": 0.98,
      "condicoes": ["Vencendo a última etapa chega a 360…", "A Giovana precisa terminar em 5º ou pior."]
    }
  ]
}
```

`titulo`/`trofeu` ∈ `garantido | vivo | depende_desempate | fora`.

### Frontend

**Hook:** `frontend/src/hooks/useChances.js` — `useChances(group) → { data, loading, error }`.

**Classificação (selo na tabela):**
- `StandingsTable` recebe prop opcional `chancesByParticipant` (Map participantId → { titulo, trofeu }). Se ausente, nenhum selo é exibido (mantém o componente reutilizável).
- As páginas `Home.jsx` e `Classificacao.jsx` buscam `/chances` e passam o Map.
- Selo = ícone único **no início da linha, antes da medalha/posição e do nome**:
  - 👑 título ∈ {vivo, garantido} (ainda briga — ou é — pelo título)
  - 🏆 título `fora` **e** troféu `vivo` (ainda briga para entrar na zona de troféu, ainda não garantida)
  - *(sem ícone)* troféu `garantido` ou `fora` — detalhe fica na página da atleta
- Posicionamento: dentro da célula `#`, antes do `span` da medalha/número (um ícone pequeno à esquerda). Tooltip com o significado.

**Página da atleta (`Participante.jsx`):**
- Nova seção "Chances de título e troféu", componente `frontend/src/components/ChancesTitulo.jsx`.
- Recebe `{ participantId, group }`, usa `useChances`.
- Exibe a entrada da atleta:
  - **Status** (badge textual): "Ainda pode ser campeã" / "Título garantido" / "Na disputa pelo troféu" / "Troféu garantido" / "Sem chance de troféu".
  - **Barras de %** título e troféu, **rotuladas "estimativa"**.
  - **"O que precisa acontecer":** texto das `condicoes`. Redação final via `insightService` (IA recebe os fatos e reescreve natural, **proibida de mudar números**); fallback = texto de template puro quando sem `ANTHROPIC_API_KEY`.
- Separação visual clara: bloco "Fato (regulamento)" vs. "Estimativa". Disclaimer curto: "A % assume chances iguais entre as atletas; as condições acima são exatas pelo regulamento."

### Schema

Sem mudança.

## Casos / validações

| Caso | Tratamento |
|---|---|
| Nenhuma etapa restante (R=0) | Tudo `garantido`/`fora` definitivo; prob = 0/1; condições = "Temporada encerrada". |
| Atleta com falta já registrada | Perde elegibilidade de bônus → teto menor; refletido no cálculo. |
| Fronteira de pontos (empate no limite) | Status `depende_desempate`; não afirma vivo/fora. |
| Sem `ANTHROPIC_API_KEY` | Texto de template puro (sem IA). |
| Grupo vazio / sem settings de troféu | `trophyPositions` cai num default seguro (ex.: 3) e segue. |
| Atleta inativa (`active=false`) | Não aparece. |
| Erro do servidor | Frontend: "Não foi possível calcular as chances" sem quebrar a página. |

## Confiabilidade

- O backend é a única fonte de números. A IA nunca calcula.
- A UI separa **fato** (determinístico, "pelo regulamento") de **estimativa** (a %).
- A premissa do modelo de probabilidade é declarada ao usuário.

## Verificação pós-implementação

1. `curl /api/tournaments/2026/chances?group=F` retorna a estrutura esperada.
2. Spot-check determinístico com os dados reais do 2026 (1 etapa restante): o líder atual deve sair `título=garantido` ou `vivo` coerente; quem está matematicamente fora do top 4 deve sair `troféu=fora`.
3. Coerência: `probTitulo ≤ probTrofeu` sempre; soma de `probTitulo` ≈ 1 entre todas; quem é `titulo=fora` tem `probTitulo=0`; quem é `trofeu=garantido` tem `probTrofeu=1`.
4. Selo na Classificação aparece antes da medalha/nome; só 👑/🏆 conforme regra.
5. Página da atleta mostra status + barras rotuladas + condições.
6. Smoke test `CHA-1`: GET 200 com estrutura correta; `CHA-2`: group inválido → 400.

## Fora de escopo (v1)

- Troféu sênior (idade ≥ 65 + vagas extras).
- Modelo de probabilidade ponderado por desempenho.
- Penalidade de uniforme na projeção.
- Árvore exaustiva de cenários (mostra a condição principal, não todas as combinações).
- Enumeração exata de probabilidade (Monte Carlo cobre a v1).
- Persistência/cache server-side.
